import { ESCALATOR_RAIL, type EscalatorDef } from '@dice/shared';
import { BufferAttribute, BufferGeometry, Mesh, MeshLambertMaterial, type Texture } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE } from '../config/worldVisuals.js';
import type { PartBuilder } from '../render/PartBuilder.js';
import { worldTextures } from './WorldTextures.js';

/** World units one tread image covers along the slope. */
const TREAD = 1.6;

/**
 * THE ESCALATORS, drawn from the same `EscalatorDef` the simulation rides:
 * glass-and-steel side panels with black handrails (into the caller's
 * PartBuilder, so they merge with everything else), and ONE merged mesh of
 * sloped tread strips for every escalator in the world whose texture scrolls
 * toward each top - the steps visibly carry you up, at one uniform per frame.
 */
export class EscalatorSteps {
  readonly mesh: Mesh;
  private readonly texture: Texture;
  private offset = 0;

  constructor(escalators: readonly EscalatorDef[]) {
    this.texture = worldTextures.escalatorSteps().clone();
    this.texture.needsUpdate = true;
    const parts = escalators.map((e) => stepStrip(e));
    const merged = mergeGeometries(parts, false) ?? new BufferGeometry();
    for (const part of parts) part.dispose();
    this.mesh = new Mesh(merged, new MeshLambertMaterial({ map: this.texture }));
    this.mesh.receiveShadow = true;
    this.mesh.name = 'escalator-steps';
  }

  /** Scroll every tread toward its escalator's top at the ride speed. */
  update(delta: number, speed: number): void {
    this.offset = (this.offset - (delta * speed) / TREAD) % 1;
    this.texture.offset.y = this.offset;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshLambertMaterial).dispose();
    this.texture.dispose();
  }
}

/**
 * A quad lying on the ramp, 5 cm above it, with V running from the low end
 * to the high end in tread units - so scrolling V backwards moves the steps up.
 */
const stepStrip = (e: EscalatorDef): BufferGeometry => {
  const lift = 0.05;
  const lowY = e.y0 + lift;
  const highY = e.y1 + lift;
  const length = Math.hypot(Math.abs(e.high - e.low), e.y1 - e.y0);
  const repeats = length / TREAD;
  // Corners: (across 0/1) x (low/high).
  let corners: [number, number, number][];
  if (e.axis === 'z') {
    corners = [
      [e.minX, lowY, e.low],
      [e.maxX, lowY, e.low],
      [e.minX, highY, e.high],
      [e.maxX, highY, e.high],
    ];
  } else {
    corners = [
      [e.low, lowY, e.minZ],
      [e.low, lowY, e.maxZ],
      [e.high, highY, e.minZ],
      [e.high, highY, e.maxZ],
    ];
  }
  const [a, b, c, d] = corners as [[number, number, number], [number, number, number], [number, number, number], [number, number, number]];
  const positions = new Float32Array([...a, ...b, ...c, ...b, ...d, ...c]);
  const across = e.axis === 'z' ? (e.maxX - e.minX) / 4 : (e.maxZ - e.minZ) / 4;
  const uvs = new Float32Array([0, 0, across, 0, 0, repeats, across, 0, across, repeats, 0, repeats]);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  // Face up whichever way the corners wound.
  const normal = geometry.getAttribute('normal');
  if (normal.getY(0) < 0) {
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([...a, ...c, ...b, ...b, ...c, ...d]), 3));
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 0, repeats, across, 0, across, 0, 0, repeats, across, repeats]), 2));
    geometry.computeVertexNormals();
  }
  return geometry;
};

/** The side panels, balustrade glass, handrails and landing plates of one escalator. */
export const buildEscalatorFrame = (b: PartBuilder, e: EscalatorDef): void => {
  const top = Math.max(e.y0, e.y1);
  const panelHeight = top + ESCALATOR_RAIL;
  const t = 0.6;
  const run = Math.abs(e.high - e.low);
  const rise = e.y1 - e.y0;
  const slope = Math.atan2(rise, run);
  const dir = Math.sign(e.high - e.low);
  const mid = (e.high + e.low) / 2;
  const railY = (e.y0 + e.y1) / 2 + ESCALATOR_RAIL;
  const railLength = Math.hypot(run, rise) + 0.6;
  if (e.axis === 'z') {
    for (const x of [e.minX - t / 2, e.maxX + t / 2]) {
      b.box(t, panelHeight, e.maxZ - e.minZ, PALETTE.escalatorSide, 'smooth', { x, y: panelHeight / 2, z: (e.minZ + e.maxZ) / 2 });
      b.box(0.34, 0.3, railLength, PALETTE.escalatorRail, 'smooth', { x, y: railY + 0.15, z: mid, rx: -dir * slope });
    }
    b.box(e.maxX - e.minX + t * 2, 0.08, 1.2, 0xc8ced8, 'smooth', { x: (e.minX + e.maxX) / 2, y: e.y0 + 0.04, z: e.low + dir * -0.6 });
  } else {
    for (const z of [e.minZ - t / 2, e.maxZ + t / 2]) {
      b.box(e.maxX - e.minX, panelHeight, t, PALETTE.escalatorSide, 'smooth', { x: (e.minX + e.maxX) / 2, y: panelHeight / 2, z });
      b.box(railLength, 0.3, 0.34, PALETTE.escalatorRail, 'smooth', { x: mid, y: railY + 0.15, z, rz: dir * slope });
    }
    b.box(1.2, 0.08, e.maxZ - e.minZ + t * 2, 0xc8ced8, 'smooth', { x: e.low + dir * -0.6, y: e.y0 + 0.04, z: (e.minZ + e.maxZ) / 2 });
  }
};
