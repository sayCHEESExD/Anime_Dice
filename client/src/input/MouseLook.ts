import { CAMERA } from '@dice/shared';

/** Radians of rotation per pixel of LOCKED mouse movement (raw movementX/Y). */
const SENSITIVITY = 0.0028;
/** Radians per pixel for the drag fallback, where the cursor travels further per turn. */
const DRAG_SENSITIVITY = 0.0055;

/** Pitch limits, so the camera can never flip over the player. */
const MIN_PITCH = -0.55;
const MAX_PITCH = 1.15;

/** Pixels a fallback drag may travel and still count as a click. */
const DRAG_THRESHOLD = 4;

/** One wheel notch, per `WheelEvent.deltaMode`. */
const NOTCH_PER_DELTA = [1 / 100, 1 / 3, 1] as const;

/**
 * Mouse look for the third-person camera, with the POINTER LOCKED to it the
 * way other games do it: the cursor disappears and moving the mouse turns the
 * camera, no button held.
 *
 *   gameplay         -> cursor hidden, the mouse steers the camera
 *   a window opens   -> lock released, cursor free for its buttons
 *   the window closes-> lock taken straight back
 *   Escape           -> the player wants their cursor (for the HUD's buttons):
 *                       it stays free until they click the game world again
 *
 * A browser only grants the lock after a user gesture, so it is ARMED by the
 * player's first keypress or click (pressing W to walk is enough) - there is no
 * click-to-play step. Where the lock is refused outright (a sandboxed frame),
 * dragging on the world steers instead, so the camera always works.
 *
 * It owns nothing but two angles and a zoom: the camera reads them and the
 * player controller rotates its movement input by the yaw. Touch drags come
 * through `addLookDelta`, so the pitch clamp and yaw wrap exist once.
 *
 * Ported from the reference project's MouseLook, which solved the same
 * portal-embedded lock lifecycle.
 */
export class MouseLook {
  private canvas: HTMLElement | null = null;
  private yawValue = 0;
  private pitchValue = 0.32;
  private zoomValue = 0;
  private sensitivityScale = 1;
  private suppressed = false;
  /** A click on the world that was not a look. Consumed once per frame. */
  private clickPulse = false;
  /** True while the left button is down and the lock is NOT held (the fallback). */
  private dragging = false;
  private dragTravel = 0;
  /** Whether this browser has ever granted the lock; until it has, dragging steers. */
  private lockEverGranted = false;
  /** The player has made a gesture, so the lock may be taken (and retaken). */
  private armed = false;
  /** A re-lock the browser refused (its post-Escape cooldown), paid off on the next gesture. */
  private pendingLock = false;
  /** The player asked for their cursor (Escape) and keeps it until they click the world. */
  private cursorFree = false;

  get yaw(): number {
    return this.yawValue;
  }

  get pitch(): number {
    return this.pitchValue;
  }

  get zoom(): number {
    return this.zoomValue;
  }

  /** True while the browser has the pointer captured. */
  get locked(): boolean {
    return !!this.canvas && document.pointerLockElement === this.canvas;
  }

  /** True once after a click on the world that was not a look. */
  consumeClick(): boolean {
    const pulse = this.clickPulse;
    this.clickPulse = false;
    return pulse && !this.suppressed;
  }

  /** Hand the cursor back, or take it again. The portal's menu drives this too. */
  setCursorFree(free: boolean): void {
    if (this.cursorFree === free) return;
    this.cursorFree = free;
    if (free) {
      this.dragging = false;
      this.pendingLock = false;
      if (this.locked) document.exitPointerLock();
    } else if (this.armed && !this.suppressed) {
      this.requestLock();
    }
    this.applyCursor();
  }

  setYaw(yaw: number): void {
    if (Number.isFinite(yaw)) this.yawValue = Math.atan2(Math.sin(yaw), Math.cos(yaw));
  }

  setSensitivityScale(scale: number): void {
    this.sensitivityScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  }

  attach(canvas: HTMLElement): void {
    this.canvas = canvas;
    canvas.addEventListener('mousedown', this.onMouseDown);
    // On the CANVAS: every window is DOM above it and stops the event first,
    // so a wheel over a scrolling list never also zooms the camera.
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('keydown', this.onKey);
    document.addEventListener('pointerlockchange', this.onLockChange);
  }

  detach(): void {
    this.canvas?.removeEventListener('mousedown', this.onMouseDown);
    this.canvas?.removeEventListener('wheel', this.onWheel);
    this.canvas?.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('keydown', this.onKey);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    document.body.classList.remove('dice-cursor-hidden', 'dice-dragging');
    this.canvas = null;
  }

  /**
   * Stop looking while a window owns the screen, and hand the cursor back.
   * Called EVERY frame, so only a real change (a window opening or closing)
   * does anything.
   */
  setSuppressed(suppressed: boolean): void {
    const wasSuppressed = this.suppressed;
    this.suppressed = suppressed;
    if (suppressed) {
      if (wasSuppressed) return;
      this.dragging = false;
      this.pendingLock = false;
      if (this.locked) document.exitPointerLock();
      this.applyCursor();
      return;
    }
    if (!wasSuppressed) return;
    // A window CLOSED: the player is back to playing, so the lock comes back.
    this.cursorFree = false;
    if (this.armed) {
      this.pendingLock = true;
      this.requestLock();
    }
    this.applyCursor();
  }

  /** Apply a look delta already scaled to RADIANS. The one place yaw and pitch are written. */
  addLookDelta(deltaYaw: number, deltaPitch: number): void {
    if (this.suppressed) return;
    if (!Number.isFinite(deltaYaw) || !Number.isFinite(deltaPitch)) return;
    this.yawValue -= deltaYaw;
    this.pitchValue += deltaPitch;
    if (this.yawValue > Math.PI) this.yawValue -= Math.PI * 2;
    else if (this.yawValue < -Math.PI) this.yawValue += Math.PI * 2;
    this.pitchValue = Math.min(MAX_PITCH, Math.max(MIN_PITCH, this.pitchValue));
  }

  /** Apply a zoom delta already scaled to WORLD UNITS. The one place zoom is clamped. */
  addZoomDelta(delta: number): void {
    if (this.suppressed || !Number.isFinite(delta)) return;
    this.zoomValue = Math.min(CAMERA.zoomMax, Math.max(CAMERA.zoomMin, this.zoomValue + delta));
  }

  /** Any keypress is a gesture: the first one arms the lock (Escape never re-traps). */
  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') return;
    if (!this.armed) {
      this.armed = true;
      this.requestLock();
      this.applyCursor();
      return;
    }
    // Typing does not take back a cursor the player asked for; clicking the world does.
    if (this.cursorFree) return;
    if (this.pendingLock && !this.locked && !this.suppressed) this.requestLock();
  };

  /** A click on the world: take (or retake) the lock; where it is refused, drag to look. */
  private readonly onMouseDown = (event: MouseEvent): void => {
    if (this.suppressed || event.button !== 0) return;
    this.armed = true;
    this.cursorFree = false;
    if (this.locked) {
      this.clickPulse = true;
      return;
    }
    this.dragTravel = 0;
    this.dragging = !this.lockEverGranted;
    this.requestLock();
    this.applyCursor();
  };

  private readonly onMouseUp = (): void => {
    if (this.dragging && this.dragTravel < DRAG_THRESHOLD && !this.suppressed) this.clickPulse = true;
    this.dragging = false;
    document.body.classList.remove('dice-dragging');
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (this.suppressed) return;
    if (this.locked) {
      const k = SENSITIVITY * this.sensitivityScale;
      this.addLookDelta(event.movementX * k, event.movementY * k);
      return;
    }
    if (!this.dragging) return;
    this.dragTravel += Math.abs(event.movementX) + Math.abs(event.movementY);
    if (this.dragTravel < DRAG_THRESHOLD) return;
    document.body.classList.add('dice-dragging');
    const k = DRAG_SENSITIVITY * this.sensitivityScale;
    this.addLookDelta(event.movementX * k, event.movementY * k);
  };

  /**
   * The lock was gained or lost. Lost with no window up means Escape, an
   * alt-tab or the browser's own release: the player wants their cursor, and
   * keeps it until they click the world.
   */
  private readonly onLockChange = (): void => {
    if (this.locked) {
      this.lockEverGranted = true;
      this.pendingLock = false;
      this.dragging = false;
      document.body.classList.remove('dice-dragging');
    } else {
      this.dragging = false;
      if (!this.suppressed && this.armed) this.cursorFree = true;
    }
    this.applyCursor();
  };

  /**
   * Hide the cursor only while playing with the lock. Guarded on
   * `lockEverGranted` so a frame that refuses the lock keeps its cursor (the
   * HUD buttons are then the only way into the windows).
   */
  private applyCursor(): void {
    const hide = this.armed && this.lockEverGranted && !this.suppressed && !this.cursorFree;
    document.body.classList.toggle('dice-cursor-hidden', hide);
  }

  /** Ask for the lock, tolerating every way a browser can say no. */
  private requestLock(): void {
    if (!this.canvas || this.locked || this.suppressed || this.cursorFree) return;
    try {
      const request = this.canvas.requestPointerLock?.() as unknown;
      if (request instanceof Promise) request.catch(() => undefined);
    } catch {
      // A sandboxed frame throws instead of rejecting; dragging still steers.
    }
  }

  private readonly onWheel = (event: WheelEvent): void => {
    if (this.suppressed) return;
    event.preventDefault();
    const notches = event.deltaY * (NOTCH_PER_DELTA[event.deltaMode] ?? NOTCH_PER_DELTA[0]);
    this.addZoomDelta(notches * CAMERA.zoomStep);
  };

  private readonly onContextMenu = (event: Event): void => event.preventDefault();

  private readonly onBlur = (): void => {
    this.dragging = false;
    document.body.classList.remove('dice-dragging');
  };
}
