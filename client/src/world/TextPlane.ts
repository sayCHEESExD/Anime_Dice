import { CanvasTexture, DoubleSide, FrontSide, LinearFilter, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';

export const UI_FONT = '"Fredoka", "Baloo 2", "Nunito", "Segoe UI", system-ui, sans-serif';

/**
 * A flat canvas-textured panel in the world whose picture is drawn by a
 * callback: the level pads, the stand price boards, the plot banners. Redrawn
 * only when the caller's `key` changes, so a panel whose text never moves costs
 * one upload, ever.
 */
export class TextPlane {
  readonly mesh: Mesh;
  private readonly canvas: HTMLCanvasElement;
  private readonly texture: CanvasTexture;
  private key = '';

  constructor(width: number, height: number, pixelsPerUnit = 48, doubleSided = false) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.max(8, Math.round(width * pixelsPerUnit));
    this.canvas.height = Math.max(8, Math.round(height * pixelsPerUnit));
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = LinearFilter;
    this.texture.anisotropy = 4;
    this.mesh = new Mesh(
      new PlaneGeometry(width, height),
      new MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false, side: doubleSided ? DoubleSide : FrontSide }),
    );
  }

  /** Redraw when `key` differs from the last draw. */
  draw(key: string, paint: (ctx: CanvasRenderingContext2D, width: number, height: number) => void): void {
    if (key === this.key) return;
    this.key = key;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    paint(ctx, this.canvas.width, this.canvas.height);
    this.texture.needsUpdate = true;
  }

  /** Force the next `draw` to repaint (an image it drew has loaded). */
  invalidate(): void {
    this.key = '';
  }

  dispose(): void {
    this.texture.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
    this.mesh.geometry.dispose();
    this.mesh.removeFromParent();
  }
}

/** Outlined chunky text, the house style for every world label. */
export const outlinedText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  fill: string,
  maxWidth: number,
  stroke = '#141822',
  align: CanvasTextAlign = 'center',
): void => {
  let px = size;
  ctx.font = `700 ${px}px ${UI_FONT}`;
  const width = ctx.measureText(text).width + px * 0.2;
  if (width > maxWidth) {
    px *= maxWidth / width;
    ctx.font = `700 ${px}px ${UI_FONT}`;
  }
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = px * 0.22;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
};

/** A rounded rectangle path. */
export const roundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};
