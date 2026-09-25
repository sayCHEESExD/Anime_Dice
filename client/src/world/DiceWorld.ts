import {
  DICE_MONUMENT,
  FOUNTAIN,
  PLOTS,
  STALLS,
  TERRACE,
  TERRACE_ESCALATORS,
  AVENUE,
  AVENUE_DIRS,
  LOOP,
  LOOP_SEGMENTS,
  LOOP_WAYPOINTS,
  PLOT,
  TERRACE_STAIRS,
  TOWER,
  WORLD_HALF,
  ESCALATOR_SPEED,
  plotEscalator,
  type StallDef,
} from '@dice/shared';
import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  AdditiveBlending,
  type Material,
  type BufferGeometry,
  type Texture,
} from 'three';
import { PALETTE } from '../config/worldVisuals.js';
import { PartBuilder } from '../render/PartBuilder.js';
import { CanvasSign } from './CanvasSign.js';
import { EscalatorSteps, buildEscalatorFrame } from './Escalators.js';
import { Scoreboard } from './Scoreboard.js';
import { texturedBox } from './texturedBox.js';
import { worldTextures } from './WorldTextures.js';

/**
 * THE HUB: everything static that is not a plot - the island, the plaza, the
 * terrace and its escalators, the TOWER, the shops, the boards, the dice
 * monument and the fountain garden, palms and lamps. Built once from the
 * shared map data, merged into a handful of meshes.
 */
export class DiceWorld {
  readonly root = new Group();
  readonly scoreboard = new Scoreboard();
  readonly steps: EscalatorSteps;
  /** The loop track: the same treads, scrolled at the loop speed. */
  readonly loop: EscalatorSteps;

  private readonly disposables: (BufferGeometry | Material | Texture)[] = [];
  private readonly signs: CanvasSign[] = [];
  private readonly dice: Group;
  private readonly portalTexture: Texture;
  private readonly beacon: Mesh;
  private time = 0;

  constructor() {
    const parts = new PartBuilder();
    this.buildGround();
    this.buildTerrace(parts);
    this.buildTower(parts);
    for (const stall of STALLS) this.buildStall(parts, stall);
    this.buildFountain(parts);
    this.buildPalms(parts);
    this.buildLamps(parts);
    for (const e of TERRACE_ESCALATORS) buildEscalatorFrame(parts, e);
    this.buildLoop(parts);
    const merged = parts.build('hub-parts');
    this.root.add(merged);

    this.steps = new EscalatorSteps([...TERRACE_ESCALATORS, ...PLOTS.map(plotEscalator)]);
    this.root.add(this.steps.mesh);
    this.loop = new EscalatorSteps(LOOP_SEGMENTS);
    this.root.add(this.loop.mesh);

    this.portalTexture = worldTextures.portal('#7a3cff', '#3ad8ff').clone();
    this.portalTexture.needsUpdate = true;
    this.disposables.push(this.portalTexture);
    this.buildDoors();
    this.beacon = this.buildBeacon();
    this.dice = this.buildDiceMonument();
    this.root.add(this.scoreboard.root);
  }

  update(delta: number): void {
    this.time += delta;
    this.steps.update(delta, ESCALATOR_SPEED);
    this.loop.update(delta, LOOP.speed);
    this.portalTexture.offset.y = (this.time * 0.35) % 1;
    this.dice.rotation.y += delta * 0.35;
    this.dice.rotation.x = Math.sin(this.time * 0.5) * 0.25 + 0.6;
    this.dice.position.y = DICE_MONUMENT.size * 0.5 + 5 + Math.sin(this.time * 1.2) * 0.6;
    const pulse = 0.75 + Math.sin(this.time * 2.2) * 0.25;
    this.beacon.scale.setScalar(pulse);
  }

  // ---------------------------------------------------------------- ground

  private buildGround(): void {
    const grass = this.lambert(worldTextures.stud(PALETTE.grass));
    const ground = new Mesh(this.geometry(texturedBox(WORLD_HALF * 2, 2, WORLD_HALF * 2, 6)), grass);
    ground.position.y = -1;
    ground.receiveShadow = true;
    this.root.add(ground);

    const sand = this.lambert(worldTextures.stud(PALETTE.sand));
    const beach = new Mesh(this.geometry(texturedBox(WORLD_HALF * 2 + 50, 2, WORLD_HALF * 2 + 50, 6)), sand);
    beach.position.y = -1.45;
    this.root.add(beach);

    // The tiled plaza: from the terrace out to the plots.
    const tiles = worldTextures.tiles(PALETTE.plaza, PALETTE.plazaLine, PALETTE.plazaAccent);
    const span = (PLOT.inner - 3) * 2;
    const plaza = new Mesh(this.geometry(texturedBox(span, 0.1, span, 4)), this.lambert(tiles));
    plaza.position.y = 0.03;
    plaza.receiveShadow = true;
    this.root.add(plaza);

    // The avenues: a pale-blue tiled path out to each plot row, and a ring path
    // round the foot of the terrace joining them.
    const pathTiles = this.lambert(worldTextures.tiles('#dfeafc', '#aebfe6', '#ffffff'));
    const A = AVENUE;
    const pathLength = PLOT.inner - TERRACE.half;
    const pathMid = (PLOT.inner + TERRACE.half) / 2;
    const pathWidth = A.pathHalf * 2;
    for (const dir of AVENUE_DIRS) {
      const alongZ = dir.uz !== 0;
      const w = alongZ ? pathWidth : pathLength;
      const d = alongZ ? pathLength : pathWidth;
      const path = new Mesh(this.geometry(texturedBox(w, 0.08, d, 4)), pathTiles);
      path.position.set(dir.ux * pathMid, 0.1, dir.uz * pathMid);
      path.receiveShadow = true;
      this.root.add(path);
    }
    const ring = TERRACE.half + 14;
    for (const [w, d, x, z] of [
      [ring * 2, 12, 0, ring - 6],
      [ring * 2, 12, 0, -(ring - 6)],
      [12, ring * 2 - 24, ring - 6, 0],
      [12, ring * 2 - 24, -(ring - 6), 0],
    ] as const) {
      const band = new Mesh(this.geometry(texturedBox(w, 0.06, d, 4)), pathTiles);
      band.position.set(x, 0.09, z);
      band.receiveShadow = true;
      this.root.add(band);
    }
  }

  // ------------------------------------------------------------------ loop

  /**
   * The loop track: a low deck under the scrolling treads, edged on both sides
   * by one unbroken light curb. The curbs follow the track's two edges round
   * every corner; each is laid as butt-jointed straights (the x-running piece
   * takes an outside corner, the z-running piece an inside one) so no two
   * pieces overlap. Visual only: the track is open to walk on and off.
   */
  private buildLoop(b: PartBuilder): void {
    const top = LOOP.top;
    for (const e of LOOP_SEGMENTS) {
      b.box(e.maxX - e.minX, top, e.maxZ - e.minZ, 0x3a4058, 'smooth', { x: (e.minX + e.maxX) / 2, y: top / 2, z: (e.minZ + e.maxZ) / 2 });
    }
    const w = 0.6;
    const height = top + 0.06;
    const n = LOOP_WAYPOINTS.length;
    const dirs = LOOP_WAYPOINTS.map((p, i) => {
      const q = LOOP_WAYPOINTS[(i + 1) % n]!;
      return { x: Math.sign(q.x - p.x), z: Math.sign(q.z - p.z) };
    });
    for (const side of [1, -1]) {
      // This edge's outward normal for a straight heading d.
      const normal = (d: { x: number; z: number }) => ({ x: side * d.z, z: -side * d.x });
      const corners = LOOP_WAYPOINTS.map((p, i) => {
        const a = normal(dirs[(i + n - 1) % n]!);
        const c = normal(dirs[i]!);
        return { x: p.x + LOOP.half * (a.x + c.x), z: p.z + LOOP.half * (a.z + c.z) };
      });
      for (let i = 0; i < n; i += 1) {
        const d = dirs[i]!;
        const out = normal(d);
        const from = corners[i]!;
        const to = corners[(i + 1) % n]!;
        // Convex where the edge's outward normal turns away from the next/previous straight.
        const startConvex = out.x * dirs[(i + n - 1) % n]!.x + out.z * dirs[(i + n - 1) % n]!.z > 0;
        const endConvex = out.x * dirs[(i + 1) % n]!.x + out.z * dirs[(i + 1) % n]!.z < 0;
        const alongX = d.x !== 0;
        let lo = alongX ? Math.min(from.x, to.x) : Math.min(from.z, to.z);
        let hi = alongX ? Math.max(from.x, to.x) : Math.max(from.z, to.z);
        if (alongX) {
          const grow = (convex: boolean): number => (convex ? w : -w);
          const [loConvex, hiConvex] = d.x > 0 ? [startConvex, endConvex] : [endConvex, startConvex];
          lo -= grow(loConvex);
          hi += grow(hiConvex);
        }
        const across = (alongX ? from.z : from.x) + (alongX ? out.z : out.x) * (w / 2);
        const length = hi - lo;
        b.box(alongX ? length : w, height, alongX ? w : length, PALETTE.escalatorSide, 'smooth', {
          x: alongX ? (lo + hi) / 2 : across,
          y: height / 2,
          z: alongX ? across : (lo + hi) / 2,
        });
      }
    }
  }

  // --------------------------------------------------------------- terrace

  private buildTerrace(b: PartBuilder): void {
    const T = TERRACE.half;
    const H = TERRACE.top;
    b.box(T * 2, H, T * 2, PALETTE.terrace, 'stud', { y: H / 2 });
    // A light rim round the top edge (inset so no face is coplanar with the top).
    for (const [w, d, x, z] of [
      [T * 2 + 0.4, 0.8, 0, T],
      [T * 2 + 0.4, 0.8, 0, -T],
      [0.8, T * 2 + 0.4, T, 0],
      [0.8, T * 2 + 0.4, -T, 0],
    ] as const) {
      b.box(w, 0.5, d, PALETTE.terraceTop, 'stud', { x, y: H - 0.2, z });
    }
    const S = TERRACE_STAIRS;
    for (let i = 1; i <= S.treads; i += 1) {
      const height = H - i * S.rise;
      if (height <= 0) break;
      for (const side of [-1, 1]) {
        const inner = T + (i - 1) * S.depth;
        const outer = T + i * S.depth;
        b.box(outer - inner, height, S.halfWidth * 2, i % 2 === 0 ? PALETTE.terraceTop : PALETTE.terrace, 'stud', {
          x: side * (inner + outer) / 2,
          y: height / 2,
        });
      }
    }
    // The terrace top: a tile disc under the tower.
    const tiles = worldTextures.tiles('#e9eefc', '#b7c3ea', '#ffffff');
    const top = new Mesh(this.geometry(texturedBox(T * 2 - 1.8, 0.1, T * 2 - 1.8, 5)), this.lambert(tiles));
    top.position.y = H + 0.03;
    top.receiveShadow = true;
    this.root.add(top);
  }

  // ----------------------------------------------------------------- tower

  private buildTower(b: PartBuilder): void {
    const base = TERRACE.top;
    const R = TOWER.radius;
    const glass = worldTextures.windows('#3d8ae6', '#a6dcff', '#e9f2ff').clone();
    glass.repeat.set(12, 34);
    glass.needsUpdate = true;
    this.disposables.push(glass);
    const shaft = new Mesh(
      this.geometry(new CylinderGeometry(R, R, TOWER.height, 24, 1, true)),
      this.track(new MeshStandardMaterial({ map: glass, roughness: 0.25, metalness: 0.2 })),
    );
    shaft.position.y = base + TOWER.height / 2;
    shaft.castShadow = true;
    this.root.add(shaft);

    // Plinth, trim rings, and the crown.
    b.add(new CylinderGeometry(R + 1.6, R + 2.2, 2.4, 24), PALETTE.towerTrim, 'smooth', { y: base + 1.2 });
    for (let y = 16; y < TOWER.height; y += 18) {
      b.add(new CylinderGeometry(R + 0.5, R + 0.5, 1.1, 24), PALETTE.towerTrim, 'smooth', { y: base + y });
    }
    const top = base + TOWER.height;
    b.add(new CylinderGeometry(R + 2.5, R + 0.4, 3, 24), PALETTE.towerTrim, 'smooth', { y: top + 1.5 });
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      b.box(2.4, 3.2, 2.4, PALETTE.towerGold, 'smooth', { x: Math.sin(a) * (R + 1.6), y: top + 4.4, z: Math.cos(a) * (R + 1.6), ry: a });
    }
    b.add(new CylinderGeometry(R * 0.5, R * 0.9, 8, 12), PALETTE.towerGlass, 'smooth', { y: top + 6 });
    b.add(new CylinderGeometry(0.2, R * 0.5, 16, 12), PALETTE.towerGold, 'smooth', { y: top + 18 });

    // "TOWERS" signs over both doors, as in the reference.
    for (const door of TOWER.doors) {
      const sign = new CanvasSign(22, 6, [{ text: 'TOWERS', size: 1, fill: '#ffffff', stroke: '#1d2a5c', strokeWidth: 0.18 }]);
      const dz = Math.sign(door.z);
      sign.mesh.position.set(0, base + 19, dz * (R + 0.8));
      sign.mesh.rotation.y = door.facing;
      this.root.add(sign.mesh);
      this.signs.push(sign);
      const castle = new CanvasSign(7, 7, [{ text: '♜', size: 1, fill: '#dfe6f6', stroke: '#1d2a5c', strokeWidth: 0.12 }]);
      castle.mesh.position.set(0, base + 25.5, dz * (R + 0.8));
      castle.mesh.rotation.y = door.facing;
      this.root.add(castle.mesh);
      this.signs.push(castle);
    }
  }

  /** The glowing doorways: step in to open the Tower. */
  private buildDoors(): void {
    const base = TERRACE.top;
    const frame = this.lambert(worldTextures.stud(PALETTE.towerTrim));
    const portal = this.track(
      new MeshBasicMaterial({ map: this.portalTexture, transparent: true, opacity: 0.9, side: DoubleSide, depthWrite: false }),
    );
    for (const door of TOWER.doors) {
      const dz = Math.sign(door.z);
      const group = new Group();
      group.position.set(0, base, dz * (TOWER.radius + 0.2));
      group.rotation.y = door.facing;
      for (const side of [-1, 1]) {
        const post = new Mesh(this.geometry(texturedBox(1.6, 10, 1.6, 2)), frame);
        post.position.set(side * 5.2, 5, 0.6);
        group.add(post);
      }
      const lintel = new Mesh(this.geometry(texturedBox(12, 1.8, 1.8, 2)), frame);
      lintel.position.set(0, 10.6, 0.6);
      group.add(lintel);
      const glow = new Mesh(this.geometry(new PlaneGeometry(8.8, 9.6)), portal);
      glow.position.set(0, 4.9, 0.7);
      group.add(glow);
      this.root.add(group);
    }
  }

  private buildBeacon(): Mesh {
    const material = this.track(new MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false }));
    const beacon = new Mesh(this.geometry(new SphereGeometry(3.2, 16, 12)), material);
    beacon.position.y = TERRACE.top + TOWER.height + 27;
    this.root.add(beacon);
    return beacon;
  }

  // ---------------------------------------------------------------- stalls

  /** A market stall like the reference: posts, a counter, a striped awning and a sign. */
  private buildStall(b: PartBuilder, stall: StallDef): void {
    const w = stall.width;
    const d = stall.depth;
    const cz = stall.z - d / 2;
    b.box(w, 1.2, d, PALETTE.stallWood, 'stud', { x: stall.x, y: 0.6, z: cz });
    b.box(w, 1.6, 1.6, PALETTE.stallCounter, 'stud', { x: stall.x, y: 2, z: stall.z - 0.8 });
    for (const sx of [-1, 1]) {
      for (const sz of [0, -1]) {
        b.box(0.8, 9, 0.8, PALETTE.stallWood, 'stud', { x: stall.x + sx * (w / 2 - 0.4), y: 5.7, z: stall.z - 0.4 + sz * (d - 0.8) });
      }
    }
    b.box(w, 1.6, d, 0xdfe5f7, 'stud', { x: stall.x, y: 1.9, z: cz - 0.4 });
    const colors = stall.id === 'upgrades' ? ['#3fbf5a', '#e9fbe9'] : ['#ec3b5a', '#f6f3f4'];
    const awning = worldTextures.stripes(colors[0]!, colors[1]!, 6);
    const roof = new Mesh(this.geometry(texturedBox(w + 1.4, 0.6, d + 1.6, w + 1.4)), this.lambert(awning));
    roof.position.set(stall.x, 10.4, cz);
    roof.rotation.x = -0.18;
    roof.castShadow = true;
    this.root.add(roof);
    const sign = new CanvasSign(w + 2, 3.4, [{ text: stall.name, size: 1, fill: '#ffffff', stroke: '#1d2a5c', strokeWidth: 0.2 }]);
    sign.mesh.position.set(stall.x, 13.4, stall.z + 0.2);
    this.root.add(sign.mesh);
    this.signs.push(sign);
  }

  // -------------------------------------------------------------- monument

  /** The giant dice floating over its pool, east of the tower. */
  private buildDiceMonument(): Group {
    const D = DICE_MONUMENT;
    const pool = new Mesh(
      this.geometry(new CylinderGeometry(D.pool / 2, D.pool / 2, 0.4, 28)),
      this.track(new MeshLambertMaterial({ color: PALETTE.water, emissive: 0x1a6aa0, emissiveIntensity: 0.25 })),
    );
    pool.position.set(D.x, 0.9, D.z);
    this.root.add(pool);
    const rim = new Mesh(this.geometry(new CylinderGeometry(D.pool / 2 + 1, D.pool / 2 + 1.2, 1, 28, 1, true)), this.lambert(worldTextures.stud(0xdfe5f7)));
    rim.position.set(D.x, 0.5, D.z);
    rim.material.side = DoubleSide;
    this.root.add(rim);
    const plinth = new Mesh(this.geometry(texturedBox(D.size + 2, 2.4, D.size + 2, 2)), this.lambert(worldTextures.stud(PALETTE.terrace)));
    plinth.position.set(D.x, 2, D.z);
    this.root.add(plinth);

    const faces = [1, 6, 2, 5, 3, 4].map((pips) => this.track(new MeshLambertMaterial({ map: worldTextures.diceFace(pips) })));
    const cube = new Mesh(this.geometry(new BoxGeometry(D.size, D.size, D.size)), faces);
    cube.castShadow = true;
    const group = new Group();
    group.position.set(D.x, D.size * 0.5 + 5, D.z);
    group.add(cube);
    this.root.add(group);
    const sign = new CanvasSign(20, 3.6, [{ text: 'ANIME DICE', size: 1, fill: '#ffe066', stroke: '#1d2a5c', strokeWidth: 0.2 }]);
    sign.mesh.position.set(D.x - D.pool / 2 - 1.5, 4.5, D.z);
    sign.mesh.rotation.y = -Math.PI / 2;
    this.root.add(sign.mesh);
    this.signs.push(sign);
    return group;
  }

  private buildFountain(b: PartBuilder): void {
    const F = FOUNTAIN;
    b.add(new CylinderGeometry(F.radius, F.radius + 0.6, 1.4, 28), 0xdfe5f7, 'stud', { x: F.x, y: 0.7, z: F.z });
    b.add(new CylinderGeometry(F.radius - 1, F.radius - 1, 0.2, 28), PALETTE.water, 'glow', { x: F.x, y: 1.35, z: F.z });
    b.add(new CylinderGeometry(3, 3.4, 5, 12), 0xdfe5f7, 'stud', { x: F.x, y: 2.5, z: F.z });
    b.add(new CylinderGeometry(5, 3, 1, 16), 0xdfe5f7, 'stud', { x: F.x, y: 5.4, z: F.z });
    b.add(new SphereGeometry(2, 12, 8), PALETTE.water, 'glow', { x: F.x, y: 6.6, z: F.z, sy: 0.6 });
  }

  // ---------------------------------------------------------------- nature

  private buildPalms(b: PartBuilder): void {
    const spots: [number, number][] = [];
    // Two tidy rows of palms along every avenue, between the loop's rings.
    for (const dir of AVENUE_DIRS) {
      for (const r of [86, 106, 126]) {
        for (const lateral of [-(AVENUE.pathHalf + 5), AVENUE.pathHalf + 5]) spots.push([dir.ux * r + dir.lx * lateral, dir.uz * r + dir.lz * lateral]);
      }
    }
    // The four corners of the terrace, and the four corners of the island beyond the plots.
    const T = TERRACE.half + 7;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) spots.push([sx * T, sz * T], [sx * 190, sz * 190], [sx * 205, sz * 150], [sx * 150, sz * 205]);
    for (const [x, z] of spots) this.palm(b, x, z);
  }

  private palm(b: PartBuilder, x: number, z: number): void {
    const height = 9 + ((Math.abs(Math.round(x * 13 + z * 7))) % 8) * 0.5;
    const lean = (Math.abs(Math.round(x + z)) % 3) * 0.08;
    for (let i = 0; i < 5; i += 1) {
      b.add(new CylinderGeometry(0.55 - i * 0.05, 0.62 - i * 0.05, height / 5, 7), i % 2 === 0 ? PALETTE.trunk : 0x7f5530, 'smooth', {
        x: x + lean * i,
        y: (height / 5) * (i + 0.5),
        z,
      });
    }
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      b.box(1.4, 0.3, 5.5, i % 2 === 0 ? PALETTE.palm : PALETTE.palmDark, 'smooth', {
        x: x + lean * 5 + Math.sin(a) * 2.4,
        y: height + 0.3,
        z: z + Math.cos(a) * 2.4,
        ry: a,
        rx: 0.35,
      });
    }
    b.add(new SphereGeometry(0.9, 8, 6), PALETTE.palmDark, 'smooth', { x: x + lean * 5, y: height + 0.4, z });
  }

  /** Lamps line the avenues, so the way to the tower reads from anywhere. */
  private buildLamps(b: PartBuilder): void {
    const spots: [number, number][] = [];
    for (const dir of AVENUE_DIRS) {
      for (const r of [76, 96, 116]) {
        for (const lateral of [-(AVENUE.pathHalf + 2), AVENUE.pathHalf + 2]) spots.push([dir.ux * r + dir.lx * lateral, dir.uz * r + dir.lz * lateral]);
      }
    }
    for (const [x, z] of spots) {
      b.add(new CylinderGeometry(0.3, 0.4, 7, 8), 0x2c3a66, 'smooth', { x, y: 3.5, z });
      b.add(new SphereGeometry(0.9, 10, 8), 0xfff2c0, 'glow', { x, y: 7.4, z });
    }
  }

  // --------------------------------------------------------------- helpers

  private geometry<T extends BufferGeometry>(geometry: T): T {
    this.disposables.push(geometry);
    return geometry;
  }

  private track<T extends Material>(material: T): T {
    this.disposables.push(material);
    return material;
  }

  private lambert(map: Texture): MeshLambertMaterial {
    return this.track(new MeshLambertMaterial({ map }));
  }

  dispose(): void {
    this.scoreboard.dispose();
    this.steps.dispose();
    this.loop.dispose();
    for (const sign of this.signs) sign.dispose();
    for (const item of this.disposables) item.dispose();
    this.root.removeFromParent();
  }
}
