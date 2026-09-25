import type { Aabb } from '../types/math.js';
import { DISPLAY_SLOTS } from './display.js';

/**
 * THE MAP, as data shared by the server (authority) and the client (prediction
 * and rendering). Every solid is an axis-aligned box; the escalators are RAMPS
 * (a sloped floor) with a CONVEYOR (a push along the slope).
 *
 *            N plots (4)
 *   W plots  [ plaza  [terrace+TOWER]  plaza ]  E plots
 *            S plots (4)
 *
 *  - The TOWER stands on a raised terrace in the centre; escalators climb the
 *    terrace from the north and south, stairs from the east and west. Walking
 *    into a tower door opens the Tower.
 *  - Sixteen PLOTS face the centre, four per side. Each is a two-storey display
 *    hall: 10 stands on the ground, 10 on the upper galleries, reached by the
 *    plot's own escalator.
 *  - Shops (Upgrades, Sell Units) south of the terrace; leaderboards north; the
 *    dice monument east; the fountain garden west.
 *  - ONE LOOP TRACK (a flat moving conveyor) runs round the island in front of
 *    every plot.
 */

// ------------------------------------------------------------------ world

export const WORLD_HALF = 225;
export const KILL_Y = -40;

export const TERRACE = { half: 40, top: 5 } as const;

export const TOWER = {
  radius: 16,
  height: 150,
  /** Door zones (in front of each door, on the terrace). */
  doors: [
    { x: 0, z: 20, facing: 0 },
    { x: 0, z: -20, facing: Math.PI },
  ],
  doorHalfWidth: 5,
  doorDepth: 5,
} as const;

/** Escalator geometry, for the terrace pair and every plot's own. */
export interface EscalatorDef {
  /** Footprint of the moving steps (the ramp). */
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  /** Axis the ramp rises along, and the coordinate of its low and high ends. */
  readonly axis: 'x' | 'z';
  readonly low: number;
  readonly high: number;
  readonly y0: number;
  readonly y1: number;
  /** Conveyor speed, world units per second (carried toward `high`). */
  readonly speed: number;
}

/** A sloped floor: height rises linearly from `low` to `high` along `axis`. */
export type Ramp = EscalatorDef;

export const ESCALATOR_SPEED = 9;
/** Height of an escalator's side panels above the steps. */
export const ESCALATOR_RAIL = 1.3;

export const TERRACE_ESCALATORS: readonly EscalatorDef[] = [
  { minX: -5, maxX: 5, minZ: 40, maxZ: 56, axis: 'z', low: 56, high: 40, y0: 0, y1: TERRACE.top, speed: ESCALATOR_SPEED },
  { minX: -5, maxX: 5, minZ: -56, maxZ: -40, axis: 'z', low: -56, high: -40, y0: 0, y1: TERRACE.top, speed: ESCALATOR_SPEED },
];

/** The east and west terrace stairs: four treads each, 1 unit rise, 2.5 deep. */
export const TERRACE_STAIRS = { halfWidth: 10, treads: 4, rise: 1, depth: 2.5 } as const;

// ------------------------------------------------------------------ plots

export const PLOT_COUNT = 16;

export const PLOT = {
  width: 40,
  depth: 46,
  /** Top of the plot's floor slab (one step up from the grass). */
  floorTop: 1,
  /** Distance from the centre to a plot's front edge. */
  inner: 150,
  /** Centre-to-centre spacing along a side. */
  spacing: 64,
  /** Stand pedestals: size and height above the floor. */
  standSize: 5,
  standHeight: 1.4,
  /** Stand column x (+-) and row z, in plot space. */
  columnX: 13,
  rowsZ: [8, 16, 24, 32, 40] as readonly number[],
  /** The level-up pad, on the carpet side of each stand. */
  padOffset: 4.6,
  padHalf: 1.3,
  /** Upper deck: galleries from |x| = galleryInner to width/2, from z = deckFront to depth. */
  deckTop: 10,
  deckThickness: 0.8,
  galleryInner: 5,
  deckFront: 2,
  /** The back bridge joining the galleries (where the escalator arrives). */
  bridgeFrontZ: 40,
  railHeight: 1.2,
  /** The plot's own escalator, in plot space, up the carpet to the bridge. */
  escalator: { halfWidth: 3, fromZ: 21, toZ: 40 },
  carpetHalf: 4,
} as const;

/** One plot's placement: the front-centre origin and the yaw its +Z (into the plot) faces. */
export interface PlotPlacement {
  readonly index: number;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly side: 'n' | 'e' | 's' | 'w';
}

const SIDE_YAW = { n: 0, e: Math.PI / 2, s: Math.PI, w: -Math.PI / 2 } as const;

export const PLOTS: readonly PlotPlacement[] = (() => {
  const out: PlotPlacement[] = [];
  const offsets = [-1.5, -0.5, 0.5, 1.5].map((k) => k * PLOT.spacing);
  const sides = ['n', 'e', 's', 'w'] as const;
  let index = 0;
  for (const side of sides) {
    const yaw = SIDE_YAW[side];
    for (const offset of offsets) {
      // The plot's local +X is world (cos yaw, -sin yaw); its local +Z is (sin yaw, cos yaw).
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);
      out.push({
        index,
        x: round(fx * PLOT.inner + rx * offset),
        z: round(fz * PLOT.inner + rz * offset),
        yaw,
        side,
      });
      index += 1;
    }
  }
  return out;
})();

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Plot space -> world space. */
export const plotToWorld = (plot: PlotPlacement, lx: number, lz: number): { x: number; z: number } => {
  const c = Math.cos(plot.yaw);
  const s = Math.sin(plot.yaw);
  return { x: round(plot.x + lx * c + lz * s), z: round(plot.z - lx * s + lz * c) };
};

/** World space -> plot space. */
export const worldToPlot = (plot: PlotPlacement, x: number, z: number): { x: number; z: number } => {
  const dx = x - plot.x;
  const dz = z - plot.z;
  const c = Math.cos(plot.yaw);
  const s = Math.sin(plot.yaw);
  return { x: dx * c - dz * s, z: dx * s + dz * c };
};

/** A plot-space box as a world AABB (plots only turn in quarter turns). */
export const plotBox = (plot: PlotPlacement, minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): Aabb => {
  const a = plotToWorld(plot, minX, minZ);
  const b = plotToWorld(plot, maxX, maxZ);
  return {
    minX: Math.min(a.x, b.x),
    maxX: Math.max(a.x, b.x),
    minY,
    maxY,
    minZ: Math.min(a.z, b.z),
    maxZ: Math.max(a.z, b.z),
  };
};

/** Where display slot `index` stands in plot space, and which way its character faces. */
export interface StandSpot {
  readonly slot: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Plot-space yaw of the character (facing the carpet). */
  readonly yaw: number;
  /** The level pad's centre, in plot space. */
  readonly padX: number;
  readonly padZ: number;
  readonly upper: boolean;
}

/**
 * Slot order follows the reference layout: ground floor left column first
 * (the five free slots), then the ground right column (rebirths 1-5), then the
 * upper left and upper right columns (rebirths 6-15).
 */
export const STAND_SPOTS: readonly StandSpot[] = (() => {
  const out: StandSpot[] = [];
  const columns: { side: -1 | 1; upper: boolean }[] = [
    { side: 1, upper: false },
    { side: -1, upper: false },
    { side: 1, upper: true },
    { side: -1, upper: true },
  ];
  let slot = 0;
  for (const column of columns) {
    for (const z of PLOT.rowsZ) {
      const floor = column.upper ? PLOT.deckTop : PLOT.floorTop;
      out.push({
        slot,
        x: column.side * PLOT.columnX,
        y: floor + PLOT.standHeight,
        z,
        // Facing the carpet: a stand on the -X side looks toward +X.
        yaw: column.side < 0 ? Math.PI / 2 : -Math.PI / 2,
        padX: column.side * (PLOT.columnX - PLOT.padOffset),
        padZ: z,
        upper: column.upper,
      });
      slot += 1;
    }
  }
  return out.slice(0, DISPLAY_SLOTS);
})();

/** Where a player spawns on their plot (plot space), facing into the plot. */
export const PLOT_SPAWN = { x: 0, z: 4 } as const;

/** Plot-space escalator of every plot, turned into world space. */
export const plotEscalator = (plot: PlotPlacement): EscalatorDef => {
  const e = PLOT.escalator;
  const box = plotBox(plot, -e.halfWidth, e.halfWidth, 0, 0, e.fromZ, e.toZ);
  const lowPoint = plotToWorld(plot, 0, e.fromZ);
  const highPoint = plotToWorld(plot, 0, e.toZ);
  const axis: 'x' | 'z' = Math.abs(Math.sin(plot.yaw)) > 0.5 ? 'x' : 'z';
  return {
    minX: box.minX,
    maxX: box.maxX,
    minZ: box.minZ,
    maxZ: box.maxZ,
    axis,
    low: axis === 'x' ? lowPoint.x : lowPoint.z,
    high: axis === 'x' ? highPoint.x : highPoint.z,
    y0: PLOT.floorTop,
    y1: PLOT.deckTop,
    speed: ESCALATOR_SPEED,
  };
};

// ------------------------------------------------------------------ plaza

/** Stalls: a counter building whose front zone opens a window. */
export interface StallDef {
  readonly id: 'upgrades' | 'sell';
  readonly name: string;
  readonly x: number;
  readonly z: number;
  /** Yaw the stall front faces. */
  readonly yaw: number;
  readonly width: number;
  readonly depth: number;
}

export const STALLS: readonly StallDef[] = [
  { id: 'upgrades', name: 'UPGRADES', x: -40, z: -96, yaw: 0, width: 16, depth: 9 },
  { id: 'sell', name: 'SELL UNITS', x: 40, z: -96, yaw: 0, width: 16, depth: 9 },
];

/** How close to the front of a stall its window opens. */
export const STALL_REACH = { front: 6, halfWidth: 8 } as const;

export const BOARDS = [
  { id: 'rarest', title: 'Rarest', x: -74, z: 100, yaw: Math.PI },
  { id: 'rolls', title: 'Rolls', x: -42, z: 104, yaw: Math.PI },
  { id: 'money', title: 'Money', x: 42, z: 104, yaw: Math.PI },
  { id: 'tower', title: 'Tower', x: 74, z: 100, yaw: Math.PI },
] as const;

export const BOARD_SIZE = { width: 20, height: 26, depth: 1.6 } as const;

export const DICE_MONUMENT = { x: 94, z: 44, size: 12, pool: 14 } as const;
export const FOUNTAIN = { x: -94, z: -44, radius: 12 } as const;

// -------------------------------------------------------------- avenues

/**
 * THE FOUR AVENUES: tiled walking paths from the terrace out between the plot
 * rows. The loop track crosses every one of them.
 */
export const AVENUE = {
  /** Half-width of the tiled path. */
  pathHalf: 18,
} as const;

export interface AvenueDir {
  /** Outward unit vector. */
  readonly ux: number;
  readonly uz: number;
  /** Sideways unit vector. */
  readonly lx: number;
  readonly lz: number;
}

export const AVENUE_DIRS: readonly AvenueDir[] = [
  { ux: 0, uz: 1, lx: 1, lz: 0 },
  { ux: 1, uz: 0, lx: 0, lz: -1 },
  { ux: 0, uz: -1, lx: -1, lz: 0 },
  { ux: -1, uz: 0, lx: 0, lz: 1 },
];

// ------------------------------------------------------------ loop track

/**
 * THE LOOP: ONE closed, one-way moving track: a square round the island,
 * running clockwise past the front of every plot, a little way out from them.
 * No ends, so no dead end.
 *
 * It is a flat conveyor a step high with NO side walls: walk on or off
 * anywhere along it. It is built from the same ramp + conveyor as the
 * escalators (flat `EscalatorDef`s), so the simulation needs nothing new.
 */
export const LOOP = {
  /** Centre line of the square, from the island centre. Plot fronts are at 150, so its outer edge is 17 from them. */
  outer: 128,
  /** Half the track's width. */
  half: 5,
  /** Deck height above the plaza: one easy step. */
  top: 0.3,
  speed: 15,
} as const;

/** The loop's centre line, corner to corner, in travel order (it closes back to the first). */
export const LOOP_WAYPOINTS: readonly { readonly x: number; readonly z: number }[] = (() => {
  const O = LOOP.outer;
  return [
    { x: -O, z: O },
    { x: O, z: O },
    { x: O, z: -O },
    { x: -O, z: -O },
  ];
})();

/** A flat conveyor over [x0,x1] x [z0,z1] carrying along `axis` from `low` to `high`. */
const flatConveyor = (x0: number, x1: number, z0: number, z1: number, axis: 'x' | 'z', low: number, high: number): EscalatorDef => ({
  minX: Math.min(x0, x1),
  maxX: Math.max(x0, x1),
  minZ: Math.min(z0, z1),
  maxZ: Math.max(z0, z1),
  axis,
  low,
  high,
  y0: LOOP.top,
  y1: LOOP.top,
  speed: LOOP.speed,
});

/**
 * The loop as flat conveyors: per corner-to-corner run, the STRAIGHT (from the
 * far side of its first corner square to the middle of the next one) and the
 * CORNER PIECE (the rest of that square, carrying the new way). A rider is
 * turned exactly on the next straight's centre line, so however far to one
 * side they rode in, every corner hands them on in the middle of the track.
 */
export const LOOP_SEGMENTS: readonly EscalatorDef[] = LOOP_WAYPOINTS.flatMap((p, i) => {
  const n = LOOP_WAYPOINTS.length;
  const q = LOOP_WAYPOINTS[(i + 1) % n]!;
  const r = LOOP_WAYPOINTS[(i + 2) % n]!;
  const h = LOOP.half;
  if (p.z === q.z) {
    // Running along x; the next run is along z.
    const dir = Math.sign(q.x - p.x);
    const turn = Math.sign(r.z - q.z);
    return [
      flatConveyor(p.x + dir * h, q.x, p.z - h, p.z + h, 'x', p.x + dir * h, q.x),
      flatConveyor(q.x, q.x + dir * h, q.z - h, q.z + h, 'z', q.z - turn * h, q.z + turn * h),
    ];
  }
  const dir = Math.sign(q.z - p.z);
  const turn = Math.sign(r.x - q.x);
  return [
    flatConveyor(p.x - h, p.x + h, p.z + dir * h, q.z, 'z', p.z + dir * h, q.z),
    flatConveyor(q.x - h, q.x + h, q.z, q.z + dir * h, 'x', q.x - turn * h, q.x + turn * h),
  ];
});

// ---------------------------------------------------------------- solids

const box = (minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): Aabb => ({
  minX,
  maxX,
  minY,
  maxY,
  minZ,
  maxZ,
});

/** Every solid in the world. Built once; the collision grid indexes it. */
export const buildStaticSolids = (): Aabb[] => {
  const solids: Aabb[] = [];
  const T = TERRACE.half;

  // The terrace, split around its two escalator mouths so their tops sit flush.
  solids.push(box(-T, T, 0, TERRACE.top, -T, T));

  // East / west stairs: treads stepping down away from the terrace.
  const S = TERRACE_STAIRS;
  for (let i = 1; i <= S.treads; i += 1) {
    const height = TERRACE.top - i * S.rise;
    if (height <= 0) break;
    const inner = T + (i - 1) * S.depth;
    const outer = T + i * S.depth;
    solids.push(box(inner, outer, 0, height, -S.halfWidth, S.halfWidth));
    solids.push(box(-outer, -inner, 0, height, -S.halfWidth, S.halfWidth));
  }

  // The tower: an octagon of two crossed boxes.
  const R = TOWER.radius;
  const r = R * 0.7;
  solids.push(box(-R, R, TERRACE.top, TERRACE.top + TOWER.height, -r, r));
  solids.push(box(-r, r, TERRACE.top, TERRACE.top + TOWER.height, -R, R));

  // Terrace escalators: side panels. The loop track has none: it is open along its length.
  for (const e of TERRACE_ESCALATORS) solids.push(...escalatorSides(e));

  // Stalls: the counter building behind the front zone.
  for (const stall of STALLS) {
    const halfW = stall.width / 2;
    solids.push(box(stall.x - halfW, stall.x + halfW, 0, 6, stall.z - stall.depth, stall.z));
  }

  // Leaderboards.
  for (const board of BOARDS) {
    const halfW = BOARD_SIZE.width / 2;
    solids.push(box(board.x - halfW, board.x + halfW, 0, BOARD_SIZE.height, board.z - BOARD_SIZE.depth / 2, board.z + BOARD_SIZE.depth / 2));
  }

  // Dice monument plinth and the fountain basin rim.
  const D = DICE_MONUMENT;
  solids.push(box(D.x - D.pool / 2, D.x + D.pool / 2, 0, 1, D.z - D.pool / 2, D.z + D.pool / 2));
  solids.push(box(D.x - D.size / 2 - 1, D.x + D.size / 2 + 1, 1, 1 + D.size + 2, D.z - D.size / 2 - 1, D.z + D.size / 2 + 1));
  const F = FOUNTAIN;
  solids.push(box(F.x - 3, F.x + 3, 0, 5, F.z - 3, F.z + 3));

  for (const plot of PLOTS) solids.push(...plotSolids(plot));
  return solids;
};

/** Side panels along an escalator's length. */
const escalatorSides = (e: EscalatorDef): Aabb[] => {
  const top = Math.max(e.y0, e.y1) + ESCALATOR_RAIL;
  const t = 0.6;
  if (e.axis === 'z') {
    return [box(e.minX - t, e.minX, 0, top, e.minZ, e.maxZ), box(e.maxX, e.maxX + t, 0, top, e.minZ, e.maxZ)];
  }
  return [box(e.minX, e.maxX, 0, top, e.minZ - t, e.minZ), box(e.minX, e.maxX, 0, top, e.maxZ, e.maxZ + t)];
};

/** A plot's floor, stands, pillars, galleries, rails and escalator sides. */
export const plotSolids = (plot: PlotPlacement): Aabb[] => {
  const P = PLOT;
  const W = P.width / 2;
  const out: Aabb[] = [];
  // Floor slab.
  out.push(plotBox(plot, -W, W, 0, P.floorTop, 0, P.depth));
  // Stand pedestals, both floors.
  const half = P.standSize / 2;
  for (const spot of STAND_SPOTS) {
    const floor = spot.upper ? P.deckTop : P.floorTop;
    out.push(plotBox(plot, spot.x - half, spot.x + half, floor, floor + P.standHeight, spot.z - half, spot.z + half));
  }
  // Upper galleries and the back bridge.
  const deckBottom = P.deckTop - P.deckThickness;
  out.push(plotBox(plot, P.galleryInner, W, deckBottom, P.deckTop, P.deckFront, P.depth));
  out.push(plotBox(plot, -W, -P.galleryInner, deckBottom, P.deckTop, P.deckFront, P.depth));
  out.push(plotBox(plot, -P.galleryInner, P.galleryInner, deckBottom, P.deckTop, P.bridgeFrontZ, P.depth));
  // Pillars holding the deck up.
  const pillar = 0.7;
  for (const x of [-W + pillar, W - pillar]) {
    for (const z of [P.deckFront + pillar, 24, P.depth - pillar]) {
      out.push(plotBox(plot, x - pillar, x + pillar, P.floorTop, deckBottom, z - pillar, z + pillar));
    }
  }
  for (const x of [-P.galleryInner - 0.3, P.galleryInner + 0.3]) {
    out.push(plotBox(plot, x - 0.5, x + 0.5, P.floorTop, deckBottom, P.deckFront, P.deckFront + 1));
  }
  // Gallery rails: the atrium edge (low enough to hop over), the front and the sides.
  const railTop = P.deckTop + P.railHeight;
  const rail = 0.3;
  out.push(plotBox(plot, P.galleryInner, P.galleryInner + rail, P.deckTop, railTop, P.deckFront, P.bridgeFrontZ));
  out.push(plotBox(plot, -P.galleryInner - rail, -P.galleryInner, P.deckTop, railTop, P.deckFront, P.bridgeFrontZ));
  out.push(plotBox(plot, -W, -P.galleryInner, P.deckTop, railTop, P.deckFront, P.deckFront + rail));
  out.push(plotBox(plot, P.galleryInner, W, P.deckTop, railTop, P.deckFront, P.deckFront + rail));
  out.push(plotBox(plot, -W, -W + rail, P.deckTop, railTop, P.deckFront, P.depth));
  out.push(plotBox(plot, W - rail, W, P.deckTop, railTop, P.deckFront, P.depth));
  out.push(plotBox(plot, -W, W, P.deckTop, railTop, P.depth - rail, P.depth));
  // The escalator's side panels (the ramp itself is not a box).
  out.push(...escalatorSides(plotEscalator(plot)));
  return out;
};

/** Every ramp (escalator) in the world. */
export const buildRamps = (): EscalatorDef[] => [...TERRACE_ESCALATORS, ...LOOP_SEGMENTS, ...PLOTS.map(plotEscalator)];

export const worldBounds = (): Aabb => box(-WORLD_HALF, WORLD_HALF, -100, 400, -WORLD_HALF, WORLD_HALF);

// ------------------------------------------------------------------ zones

export interface Placement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
}

/** Where a player spawns on their plot. */
export const plotSpawn = (plotIndex: number): Placement => {
  const plot = PLOTS[plotIndex] ?? PLOTS[0]!;
  const at = plotToWorld(plot, PLOT_SPAWN.x, PLOT_SPAWN.z);
  return { x: at.x, y: PLOT.floorTop, z: at.z, yaw: plot.yaw };
};

/** True when a position is at one of the tower's doors (on the terrace). */
export const atTowerDoor = (x: number, y: number, z: number): boolean => {
  if (y < TERRACE.top - 0.5 || y > TERRACE.top + 4) return false;
  for (const door of TOWER.doors) {
    if (Math.abs(x - door.x) <= TOWER.doorHalfWidth && Math.abs(z - door.z) <= TOWER.doorDepth) return true;
  }
  return false;
};

/**
 * The server's looser check for a fight request: anywhere on the terrace. The
 * client opens the Tower at a door; the server only needs to know the player
 * really is at the tower and not across the map.
 */
export const onTowerTerrace = (x: number, y: number, z: number): boolean =>
  Math.abs(x) <= TERRACE.half + 1 && Math.abs(z) <= TERRACE.half + 14 && y >= TERRACE.top - 1.5;

/** The stall whose front zone a position is in, or null. */
export const stallAt = (x: number, z: number): StallDef | null => {
  for (const stall of STALLS) {
    if (Math.abs(x - stall.x) <= STALL_REACH.halfWidth && z > stall.z && z < stall.z + STALL_REACH.front) return stall;
  }
  return null;
};

/** The plot a position is on (inside its footprint), or -1. */
export const plotAt = (x: number, z: number): number => {
  for (const plot of PLOTS) {
    const local = worldToPlot(plot, x, z);
    if (Math.abs(local.x) <= PLOT.width / 2 && local.z >= 0 && local.z <= PLOT.depth) return plot.index;
  }
  return -1;
};

/** The level pad of your own plot a position stands on, or -1. */
export const padAt = (plotIndex: number, x: number, y: number, z: number): number => {
  const plot = PLOTS[plotIndex];
  if (!plot) return -1;
  const local = worldToPlot(plot, x, z);
  for (const spot of STAND_SPOTS) {
    const floor = spot.upper ? PLOT.deckTop : PLOT.floorTop;
    if (Math.abs(y - floor) > 1.2) continue;
    if (Math.abs(local.x - spot.padX) <= PLOT.padHalf && Math.abs(local.z - spot.padZ) <= PLOT.padHalf) return spot.slot;
  }
  return -1;
};
