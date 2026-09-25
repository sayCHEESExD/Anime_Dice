import { STAND_POSES } from '../config/animationConfig.js';
import { characterById } from '@dice/shared';
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';
import { PoseBuffer } from '../animation/PoseBuffer.js';
import { PlayerRig } from '../animation/rig/PlayerRig.js';
import { createCharacterBody } from '../characters/CharacterModels.js';

const SIZE = 256;
/** Portraits rendered per frame at most: each is a render and a read-back. */
const PER_FRAME = 2;

/** A transparent 1x1, shown until a portrait is ready. */
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

/**
 * CARD ART FROM THE REAL MODELS. Each character is rendered once, in its
 * trophy pose, through the game's own renderer into an offscreen target and
 * kept as an object URL - so every card, the roll strip and the battle show
 * exactly the character that stands on the plots, and no image ships for any
 * of them.
 *
 * Rendering is QUEUED, a couple per frame: a backpack full of new characters
 * fills in over a few frames instead of freezing one. `<img>` elements asked
 * for a portrait that is not ready yet are handed a blank and upgraded in place
 * when it lands.
 */
export class CharacterPortraits {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(26, 1, 0.1, 60);
  private readonly target = new WebGLRenderTarget(SIZE, SIZE);
  private readonly holder = new Group();
  private readonly urls = new Map<string, string>();
  private readonly queue: string[] = [];
  private readonly waiting = new Map<string, Set<HTMLImageElement>>();
  private readonly pixels = new Uint8Array(SIZE * SIZE * 4);
  private readonly canvas: HTMLCanvasElement;
  private readonly pose = new PoseBuffer();

  constructor(private readonly renderer: WebGLRenderer) {
    this.target.texture.colorSpace = SRGBColorSpace;
    this.scene.add(new HemisphereLight(0xffffff, 0xc8c0e0, 1.5));
    this.scene.add(new AmbientLight(0xffffff, 0.55));
    const key = new DirectionalLight(0xffffff, 1.9);
    key.position.set(2.5, 4, 6);
    this.scene.add(key);
    this.scene.add(this.holder);
    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
  }

  /** The portrait URL, or a blank while it is queued. */
  url(charId: string): string {
    const ready = this.urls.get(charId);
    if (ready) return ready;
    if (!this.queue.includes(charId)) this.queue.push(charId);
    return BLANK;
  }

  /** Point an image at a character's portrait now, or as soon as it exists. */
  bind(image: HTMLImageElement, charId: string): void {
    image.dataset['char'] = charId;
    const ready = this.urls.get(charId);
    if (ready) {
      image.src = ready;
      return;
    }
    image.src = BLANK;
    let set = this.waiting.get(charId);
    if (!set) {
      set = new Set();
      this.waiting.set(charId, set);
    }
    set.add(image);
    if (!this.queue.includes(charId)) this.queue.push(charId);
  }

  /** Warm the cache for characters that will be needed soon. */
  prefetch(ids: readonly string[]): void {
    for (const id of ids) if (!this.urls.has(id) && !this.queue.includes(id)) this.queue.push(id);
  }

  /** Render a few queued portraits. Call once per frame. */
  update(): void {
    for (let i = 0; i < PER_FRAME && this.queue.length > 0; i += 1) {
      const id = this.queue.shift()!;
      if (this.urls.has(id)) continue;
      this.render(id);
    }
  }

  private render(charId: string): void {
    const body = createCharacterBody(charId);
    const character = characterById(charId);
    if (!body || !character) {
      this.urls.set(charId, BLANK);
      return;
    }
    const visual = new Group();
    visual.add(body.model);
    const rig = new PlayerRig(body.model, body.model);
    this.pose.applyDefinition(STAND_POSES[character.role ?? 'balanced']);
    rig.applyPose(this.pose);
    visual.rotation.y = -0.4;
    const scale = body.scale;
    this.holder.add(visual);
    // Frame the whole figure, head a little above centre.
    this.camera.position.set(0, 2.0 * scale, 8.8 * scale);
    this.camera.lookAt(0, 1.72 * scale, 0);
    this.camera.aspect = 1;
    this.camera.updateProjectionMatrix();

    const previousTarget = this.renderer.getRenderTarget();
    const previousColor = new Color();
    this.renderer.getClearColor(previousColor);
    const previousAlpha = this.renderer.getClearAlpha();
    const previousShadows = this.renderer.shadowMap.enabled;
    this.renderer.shadowMap.enabled = false;
    this.renderer.setRenderTarget(this.target);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear(true, true, true);
    this.renderer.render(this.scene, this.camera);
    this.renderer.readRenderTargetPixels(this.target, 0, 0, SIZE, SIZE, this.pixels);
    this.renderer.setRenderTarget(previousTarget);
    this.renderer.setClearColor(previousColor, previousAlpha);
    this.renderer.shadowMap.enabled = previousShadows;
    this.holder.remove(visual);

    const ctx = this.canvas.getContext('2d')!;
    const image = ctx.createImageData(SIZE, SIZE);
    // The target is bottom-up; the canvas is top-down.
    for (let y = 0; y < SIZE; y += 1) {
      image.data.set(this.pixels.subarray((SIZE - 1 - y) * SIZE * 4, (SIZE - y) * SIZE * 4), y * SIZE * 4);
    }
    ctx.putImageData(image, 0, 0);
    // A synchronous URL, so the image can be handed out at once.
    const url = this.canvas.toDataURL('image/png');
    this.urls.set(charId, url);
    const waiting = this.waiting.get(charId);
    if (waiting) {
      for (const img of waiting) if (img.dataset['char'] === charId) img.src = url;
      this.waiting.delete(charId);
    }
  }

  dispose(): void {
    this.target.dispose();
    this.urls.clear();
  }
}
