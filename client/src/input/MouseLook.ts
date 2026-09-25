import { CAMERA } from '@dice/shared';

/** Radians of rotation per pixel of mouse drag. */
const SENSITIVITY = 0.0055;

/** Pitch limits, so the camera can never flip over the player. */
const MIN_PITCH = -0.55;
const MAX_PITCH = 1.15;

/** Pixels a press may travel before it counts as a drag rather than a click. */
const DRAG_THRESHOLD = 4;

/** One wheel notch, per `WheelEvent.deltaMode`. */
const NOTCH_PER_DELTA = [1 / 100, 1 / 3, 1] as const;

/**
 * Mouse look for the third-person camera, Roblox-style: the CURSOR IS ALWAYS
 * FREE (this is a menu-heavy game - the dice, the backpack, the stands), and
 * dragging on the world with either button orbits the camera. The wheel zooms.
 *
 * It owns nothing but two angles and a zoom: the camera reads them and the
 * player controller rotates its movement input by the yaw, so looking around
 * never moves the character. Touch drags come through `addLookDelta`, so the
 * pitch clamp and yaw wrap exist once.
 */
export class MouseLook {
  private yawValue = 0;
  private pitchValue = 0.32;
  private zoomValue = 0;
  private sensitivity = 1;
  private suppressed = false;
  private canvas: HTMLElement | null = null;
  private dragging = false;
  private pressed = false;
  private travelled = 0;
  private lastX = 0;
  private lastY = 0;
  private clickPulse = false;

  get yaw(): number {
    return this.yawValue;
  }

  get pitch(): number {
    return this.pitchValue;
  }

  get zoom(): number {
    return this.zoomValue;
  }

  /** True once after a click on the world that was not a drag. */
  consumeClick(): boolean {
    const pulse = this.clickPulse;
    this.clickPulse = false;
    return pulse && !this.suppressed;
  }

  /** Kept for the portal's API: the cursor is never captured in this game. */
  setCursorFree(_free: boolean): void {}

  setYaw(yaw: number): void {
    if (Number.isFinite(yaw)) this.yawValue = yaw;
  }

  setSensitivityScale(scale: number): void {
    if (Number.isFinite(scale) && scale > 0) this.sensitivity = scale;
  }

  setSuppressed(suppressed: boolean): void {
    this.suppressed = suppressed;
    if (suppressed) this.dragging = false;
  }

  attach(canvas: HTMLElement): void {
    this.canvas = canvas;
    canvas.addEventListener('mousedown', this.onDown);
    window.addEventListener('mousemove', this.onMove);
    window.addEventListener('mouseup', this.onUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    this.canvas?.removeEventListener('mousedown', this.onDown);
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('mouseup', this.onUp);
    this.canvas?.removeEventListener('wheel', this.onWheel);
    this.canvas?.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('blur', this.onBlur);
    this.canvas = null;
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

  private readonly onDown = (event: MouseEvent): void => {
    if (this.suppressed) return;
    this.pressed = true;
    this.dragging = false;
    this.travelled = 0;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
  };

  private readonly onMove = (event: MouseEvent): void => {
    if (!this.pressed || this.suppressed) return;
    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.travelled += Math.abs(dx) + Math.abs(dy);
    if (!this.dragging && this.travelled < DRAG_THRESHOLD) return;
    this.dragging = true;
    document.body.classList.add('dice-dragging');
    this.addLookDelta(dx * SENSITIVITY * this.sensitivity, dy * SENSITIVITY * this.sensitivity);
  };

  private readonly onUp = (): void => {
    if (this.pressed && !this.dragging) this.clickPulse = true;
    this.pressed = false;
    this.dragging = false;
    document.body.classList.remove('dice-dragging');
  };

  private readonly onWheel = (event: WheelEvent): void => {
    if (this.suppressed) return;
    event.preventDefault();
    const notches = event.deltaY * (NOTCH_PER_DELTA[event.deltaMode] ?? NOTCH_PER_DELTA[0]);
    this.addZoomDelta(notches * CAMERA.zoomStep);
  };

  private readonly onContextMenu = (event: Event): void => event.preventDefault();

  private readonly onBlur = (): void => {
    this.pressed = false;
    this.dragging = false;
  };
}
