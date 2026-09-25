import { buildRamps, buildStaticSolids, worldBounds, type Ramp } from '../config/map.js';
import { MOVEMENT } from '../config/movement.js';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from '../constants/world.js';
import type { Aabb } from '../types/math.js';

/** Grid cell for the broad phase, in world units. */
const CELL = 16;
const EPS = 1e-4;

/**
 * THE WORLD AS THE SIMULATION SEES IT: axis-aligned boxes, RAMPS (the
 * escalators' sloped floors) and a floor at y = 0, shared by the server
 * (authority) and the client (prediction), so the two collide against the
 * exact same shapes.
 *
 * The player is a box of `PLAYER_RADIUS` half-width and `PLAYER_HEIGHT`
 * height. Horizontal moves are resolved one axis at a time; a face no higher
 * than `MOVEMENT.stepHeight` above the feet is STEPPED ONTO rather than
 * blocking. A ramp is a floor whose height depends on where you stand on it:
 * walking onto it lifts you smoothly, and the space UNDER it blocks like a
 * wall once the surface is more than a step above your feet.
 */
export class WorldCollision {
  private readonly solids: Aabb[] = [];
  private readonly ramps: Ramp[];
  private readonly grid = new Map<number, number[]>();
  private readonly bounds: Aabb;
  private readonly seen: number[] = [];
  private stamp = 1;
  private readonly marks: number[] = [];

  constructor() {
    for (const solid of buildStaticSolids()) this.add(solid);
    this.ramps = buildRamps();
    this.bounds = worldBounds();
  }

  /** Every static solid, for diagnostics and the verification scripts. */
  get boxes(): readonly Aabb[] {
    return this.solids;
  }

  get rampList(): readonly Ramp[] {
    return this.ramps;
  }

  private add(box: Aabb): void {
    const index = this.solids.length;
    this.solids.push(box);
    this.marks.push(0);
    for (let cx = Math.floor(box.minX / CELL); cx <= Math.floor(box.maxX / CELL); cx += 1) {
      for (let cz = Math.floor(box.minZ / CELL); cz <= Math.floor(box.maxZ / CELL); cz += 1) {
        const key = cellKey(cx, cz);
        let list = this.grid.get(key);
        if (!list) {
          list = [];
          this.grid.set(key, list);
        }
        list.push(index);
      }
    }
  }

  /** Candidate solids overlapping an XZ rectangle, each once. Reuses one array. */
  private query(minX: number, maxX: number, minZ: number, maxZ: number): readonly number[] {
    const out = this.seen;
    out.length = 0;
    this.stamp += 1;
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx += 1) {
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz += 1) {
        const list = this.grid.get(cellKey(cx, cz));
        if (!list) continue;
        for (const index of list) {
          if (this.marks[index] === this.stamp) continue;
          this.marks[index] = this.stamp;
          const b = this.solids[index]!;
          if (b.maxX <= minX || b.minX >= maxX || b.maxZ <= minZ || b.minZ >= maxZ) continue;
          out.push(index);
        }
      }
    }
    return out;
  }

  /** The ramp surface under a point (centre of the feet), or -Infinity when not on a ramp. */
  rampHeight(x: number, z: number): number {
    let best = Number.NEGATIVE_INFINITY;
    for (const ramp of this.ramps) {
      if (x < ramp.minX || x > ramp.maxX || z < ramp.minZ || z > ramp.maxZ) continue;
      const along = ramp.axis === 'x' ? x : z;
      const t = clamp01((along - ramp.low) / (ramp.high - ramp.low));
      const height = ramp.y0 + (ramp.y1 - ramp.y0) * t;
      if (height > best) best = height;
    }
    return best;
  }

  /** The ramp a player standing at (x, y, z) rides, or null. */
  rampUnder(x: number, y: number, z: number): Ramp | null {
    for (const ramp of this.ramps) {
      if (x < ramp.minX || x > ramp.maxX || z < ramp.minZ || z > ramp.maxZ) continue;
      const along = ramp.axis === 'x' ? x : z;
      const t = clamp01((along - ramp.low) / (ramp.high - ramp.low));
      const height = ramp.y0 + (ramp.y1 - ramp.y0) * t;
      if (Math.abs(y - height) <= 0.35) return ramp;
    }
    return null;
  }

  /** True when a player box standing at (x, y, z) overlaps any solid. */
  private blocked(x: number, y: number, z: number): boolean {
    const r = PLAYER_RADIUS;
    for (const index of this.query(x - r, x + r, z - r, z + r)) {
      const b = this.solids[index]!;
      if (b.maxY > y + EPS && b.minY < y + PLAYER_HEIGHT - EPS) return true;
    }
    return false;
  }

  /** True when the space under a ramp at (x, z) is a wall for feet at `y`. */
  private underRamp(x: number, y: number, z: number): boolean {
    const surface = this.rampHeight(x, z);
    return surface !== Number.NEGATIVE_INFINITY && surface > y + MOVEMENT.stepHeight;
  }

  /**
   * Move horizontally along one axis, stepping up low faces.
   *
   * @returns the new coordinate on that axis in `out.value`, and writes a
   *          raised `y` into `out.y` when a step was taken.
   */
  moveAxis(axis: 'x' | 'z', x: number, y: number, z: number, delta: number, out: { value: number; y: number; hit: boolean }): void {
    out.y = y;
    out.hit = false;
    const r = PLAYER_RADIUS;
    let nx = axis === 'x' ? x + delta : x;
    let nz = axis === 'z' ? z + delta : z;
    let ny = y;

    for (let pass = 0; pass < 3; pass += 1) {
      let collided = false;
      for (const index of this.query(nx - r, nx + r, nz - r, nz + r)) {
        const b = this.solids[index]!;
        if (b.maxY <= ny + EPS || b.minY >= ny + PLAYER_HEIGHT - EPS) continue;
        // A low face: step onto it, if there is headroom up there.
        const rise = b.maxY - ny;
        if (rise <= MOVEMENT.stepHeight && !this.blocked(nx, b.maxY, nz)) {
          ny = b.maxY;
          collided = true;
          break;
        }
        // A wall: stop against its face.
        if (axis === 'x') nx = delta > 0 ? b.minX - r - EPS : b.maxX + r + EPS;
        else nz = delta > 0 ? b.minZ - r - EPS : b.maxZ + r + EPS;
        out.hit = true;
        collided = true;
        break;
      }
      if (!collided) break;
    }

    // The space under an escalator is solid once its steps are above a step's height.
    if (!out.hit && this.underRamp(nx, ny, nz) && !this.underRamp(x, y, z)) {
      nx = x;
      nz = z;
      out.hit = true;
    }

    // Never let the step or the push leave the player further than asked.
    if (axis === 'x') {
      if ((delta > 0 && nx < x) || (delta < 0 && nx > x)) nx = x;
    } else if ((delta > 0 && nz < z) || (delta < 0 && nz > z)) nz = z;

    out.value = axis === 'x' ? nx : nz;
    out.y = ny;
  }

  /** The highest floor under the footprint at or below `y + tolerance`: a box top, a ramp, or the ground. */
  floorBelow(x: number, y: number, z: number, tolerance = EPS): number {
    const r = PLAYER_RADIUS * 0.92;
    let floor = 0;
    for (const index of this.query(x - r, x + r, z - r, z + r)) {
      const b = this.solids[index]!;
      if (b.maxY <= y + tolerance && b.maxY > floor) floor = b.maxY;
    }
    const ramp = this.rampHeight(x, z);
    if (ramp <= y + tolerance && ramp > floor) floor = ramp;
    return floor;
  }

  /** The lowest ceiling above a head at `headY`, or +Infinity. */
  ceilingAbove(x: number, headY: number, z: number): number {
    const r = PLAYER_RADIUS * 0.92;
    let ceiling = Number.POSITIVE_INFINITY;
    for (const index of this.query(x - r, x + r, z - r, z + r)) {
      const b = this.solids[index]!;
      if (b.minY >= headY - EPS && b.minY < ceiling) ceiling = b.minY;
    }
    return ceiling;
  }

  /**
   * The first solid along a segment: 0..1 of the way from (ox, oy, oz) along
   * (dx, dy, dz), or 1 when it is clear. The camera uses it to stay out of walls.
   */
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): number {
    let best = 1;
    const minX = Math.min(ox, ox + dx);
    const maxX = Math.max(ox, ox + dx);
    const minZ = Math.min(oz, oz + dz);
    const maxZ = Math.max(oz, oz + dz);
    for (const index of this.query(minX - 0.01, maxX + 0.01, minZ - 0.01, maxZ + 0.01)) {
      const b = this.solids[index]!;
      let t0 = 0;
      let t1 = best;
      const axes: [number, number, number, number][] = [
        [ox, dx, b.minX, b.maxX],
        [oy, dy, b.minY, b.maxY],
        [oz, dz, b.minZ, b.maxZ],
      ];
      let hit = true;
      for (const [o, d, lo, hi] of axes) {
        if (Math.abs(d) < 1e-9) {
          if (o < lo || o > hi) hit = false;
          continue;
        }
        let a = (lo - o) / d;
        let c = (hi - o) / d;
        if (a > c) [a, c] = [c, a];
        t0 = Math.max(t0, a);
        t1 = Math.min(t1, c);
        if (t0 > t1) hit = false;
      }
      if (hit && t0 > 0 && t0 < best) best = t0;
    }
    return best;
  }

  /** Keep a position inside the world, whatever displacement produced it. */
  clampToBounds(position: { x: number; z: number }): void {
    const r = PLAYER_RADIUS;
    const b = this.bounds;
    if (position.x < b.minX + r) position.x = b.minX + r;
    if (position.x > b.maxX - r) position.x = b.maxX - r;
    if (position.z < b.minZ + r) position.z = b.minZ + r;
    if (position.z > b.maxZ - r) position.z = b.maxZ - r;
  }
}

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

const cellKey = (cx: number, cz: number): number => (cx + 4096) * 8192 + (cz + 4096);
