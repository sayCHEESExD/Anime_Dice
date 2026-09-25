import { PLOT, STAND_SPOTS } from '@dice/shared';
import type { BufferGeometry } from 'three';
import { PALETTE } from '../config/worldVisuals.js';
import { PartBuilder, type PartKind } from '../render/PartBuilder.js';

/**
 * THE DISPLAY HALL, in plot space: a navy studded floor with a light rim and
 * a red carpet up the middle, twenty stand pedestals (ten on the ground, ten on
 * the upper galleries), white pillars, the galleries and back bridge with their
 * rails, and the plot's own escalator frame. There is no entrance arch: the
 * owner's banner hangs free over the front (see PlotView).
 *
 * Built ONCE and shared by all sixteen plots (each is the same geometry at its
 * own transform): the static part of a plot costs three draw calls.
 */
let cached: Partial<Record<PartKind, BufferGeometry>> | null = null;

export const plotShellGeometry = (): Partial<Record<PartKind, BufferGeometry>> => {
  if (cached) return cached;
  const b = new PartBuilder();
  const P = PLOT;
  const W = P.width / 2;
  const D = P.depth;

  // Floor, rim and carpet. NO TWO PARTS SHARE A FACE anywhere in this shell:
  // coplanar overlapping faces z-fight (flicker) at the corners, so parts that
  // meet either butt end to end or are inset a few centimetres.
  b.box(P.width, P.floorTop, D, PALETTE.plotBase, 'stud', { y: P.floorTop / 2, z: D / 2 });
  // The rim sits ON the slab; the side pieces run between the front and back ones.
  for (const [w, d, x, z] of [
    [P.width, 0.9, 0, 0.45],
    [P.width, 0.9, 0, D - 0.45],
    [0.9, D - 1.8, -W + 0.45, D / 2],
    [0.9, D - 1.8, W - 0.45, D / 2],
  ] as const) {
    b.box(w, 0.3, d, PALETTE.plotRim, 'stud', { x, y: P.floorTop + 0.15, z });
  }
  b.box(P.carpetHalf * 2, 0.08, D - 1.8, PALETTE.carpet, 'stud', { y: P.floorTop + 0.04, z: D / 2 });
  for (const side of [-1, 1]) b.box(0.3, 0.1, D - 1.8, PALETTE.carpetEdge, 'smooth', { x: side * P.carpetHalf, y: P.floorTop + 0.05, z: D / 2 });

  // Stand pedestals, both floors.
  for (const spot of STAND_SPOTS) {
    const floor = spot.upper ? P.deckTop : P.floorTop;
    b.box(P.standSize, P.standHeight - 0.2, P.standSize, PALETTE.stand, 'stud', { x: spot.x, y: floor + (P.standHeight - 0.2) / 2, z: spot.z });
    b.box(P.standSize + 0.3, 0.2, P.standSize + 0.3, PALETTE.plotEdge, 'smooth', { x: spot.x, y: floor + P.standHeight - 0.1, z: spot.z });
  }

  // Galleries and the back bridge.
  const deckBottom = P.deckTop - P.deckThickness;
  const galleryW = W - P.galleryInner;
  for (const side of [-1, 1]) {
    b.box(galleryW, P.deckThickness, D - P.deckFront, PALETTE.deck, 'stud', {
      x: side * (P.galleryInner + galleryW / 2),
      y: deckBottom + P.deckThickness / 2,
      z: (P.deckFront + D) / 2,
    });
  }
  b.box(P.galleryInner * 2, P.deckThickness, D - P.bridgeFrontZ, PALETTE.deck, 'stud', {
    y: deckBottom + P.deckThickness / 2,
    z: (P.bridgeFrontZ + D) / 2,
  });
  // A white trim under the gallery lips: the front beam across, and the side
  // pieces running back from behind it (so they never overlap at the corner).
  const inset = 0.05;
  const trimFrom = P.deckFront + 0.5;
  for (const side of [-1, 1]) {
    b.box(0.5, 0.5, D - trimFrom - inset, PALETTE.pillar, 'smooth', {
      x: side * (P.galleryInner + 0.25 + inset),
      y: deckBottom - 0.2,
      z: (trimFrom + D - inset) / 2,
    });
  }
  b.box(P.width - inset * 4, 0.5, 0.5, PALETTE.pillar, 'smooth', { y: deckBottom - 0.2, z: P.deckFront + 0.25 });

  // Pillars, inset from the slab edges and the trim's faces.
  const pillar = 0.7;
  for (const x of [-W + pillar + inset, W - pillar - inset]) {
    for (const z of [P.deckFront + pillar + inset, 24, D - pillar - inset]) {
      b.box(pillar * 2, deckBottom - P.floorTop, pillar * 2, PALETTE.pillar, 'stud', { x, y: (P.floorTop + deckBottom) / 2, z });
    }
  }
  for (const x of [-P.galleryInner - 0.3, P.galleryInner + 0.3]) {
    b.box(1, deckBottom - P.floorTop, 1, PALETTE.pillar, 'stud', { x, y: (P.floorTop + deckBottom) / 2, z: P.deckFront + 0.5 + inset });
  }

  // Rails: posts and a top bar along every open gallery edge. Where two rails
  // meet, the one running BETWEEN them is trimmed to butt against the other's
  // bars (`trim` at each end) and leaves the corner post to it.
  const railTop = P.deckTop + P.railHeight;
  const rail = (x0: number, z0: number, x1: number, z1: number, trim = 0): void => {
    const length = Math.hypot(x1 - x0, z1 - z0);
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const bar = length - trim * 2;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    b.box(alongX ? bar : 0.3, 0.3, alongX ? 0.3 : bar, PALETTE.rail, 'smooth', { x: cx, y: railTop - 0.15, z: cz });
    b.box(alongX ? bar : 0.12, 0.12, alongX ? 0.12 : bar, PALETTE.rail, 'smooth', { x: cx, y: P.deckTop + 0.5, z: cz });
    const posts = Math.max(1, Math.round(length / 3));
    for (let i = trim > 0 ? 1 : 0; i <= (trim > 0 ? posts - 1 : posts); i += 1) {
      const t = i / posts;
      b.box(0.25, P.railHeight, 0.25, PALETTE.rail, 'smooth', { x: x0 + (x1 - x0) * t, y: P.deckTop + P.railHeight / 2, z: z0 + (z1 - z0) * t });
    }
  };
  for (const side of [-1, 1]) {
    rail(side * (P.galleryInner + 0.15), P.deckFront, side * (P.galleryInner + 0.15), P.bridgeFrontZ);
    rail(side * (W - 0.15), P.deckFront, side * (W - 0.15), D);
    // Between the atrium rail and the side rail.
    rail(side * P.galleryInner, P.deckFront + 0.15, side * W, P.deckFront + 0.15, 0.3);
  }
  // Between the two side rails.
  rail(-W, D - 0.15, W, D - 0.15, 0.3);

  // The plot's escalator frame (the steps are the world's shared scrolling mesh).
  const e = P.escalator;
  const panel = P.deckTop + 1.3;
  for (const side of [-1, 1]) {
    // Stopping just short of the bridge's front face.
    b.box(0.6, panel, e.toZ - e.fromZ - 0.05, PALETTE.escalatorSide, 'smooth', { x: side * (e.halfWidth + 0.3), y: panel / 2, z: (e.fromZ + e.toZ - 0.05) / 2 });
    const run = e.toZ - e.fromZ;
    const rise = P.deckTop - P.floorTop;
    b.box(0.34, 0.3, Math.hypot(run, rise) + 0.6, PALETTE.escalatorRail, 'smooth', {
      x: side * (e.halfWidth + 0.3),
      y: (P.floorTop + P.deckTop) / 2 + 1.45,
      z: (e.fromZ + e.toZ) / 2,
      rx: -Math.atan2(rise, run),
    });
  }

  cached = b.geometries();
  return cached;
};
