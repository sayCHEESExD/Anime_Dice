import type { AccessoryId, CharacterLook, HairStyle } from '@dice/shared';
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
} from 'three';
import type { PartBuilder, PartKind, Transform } from '../render/PartBuilder.js';
import { shade } from './HeroPainter.js';

/**
 * HAIR AND GEAR, BUILT FROM DATA. Every hair style and accessory id in
 * `characterTypes.ts` has one generic builder here, coloured by the
 * character's look. The builders work in CHARACTER space around their mount
 * (x = the character's left, y up, z forward), sized by the measured body.
 */
export interface MountContext {
  /** Head box height. */
  readonly head: number;
  readonly torsoW: number;
  readonly torsoD: number;
  readonly torsoH: number;
  /** Arm box width. */
  readonly limb: number;
}

export type MountSlot = 'head' | 'back' | 'hip' | 'handR' | 'handL';

type Builder = (b: PartBuilder, c: MountContext, look: CharacterLook) => void;

// ------------------------------------------------------------- helpers

/** A cone whose BASE sits at (x, y, z), leaning by rx (forward+) and rz (toward -x+). */
const spike = (
  b: PartBuilder,
  color: number,
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
  rx: number,
  rz: number,
  kind: PartKind = 'smooth',
): void => {
  // Direction of the apex for Euler(YXZ) with ry = 0.
  const dx = -Math.sin(rz);
  const dy = Math.cos(rz) * Math.cos(rx);
  const dz = Math.cos(rz) * Math.sin(rx);
  b.add(new ConeGeometry(radius, height, 5), color, kind, {
    x: x + (dx * height) / 2,
    y: y + (dy * height) / 2,
    z: z + (dz * height) / 2,
    rx,
    rz,
  });
};

const box = (b: PartBuilder, w: number, h: number, d: number, color: number, t: Transform, kind: PartKind = 'smooth'): void => {
  b.add(new BoxGeometry(w, h, d), color, kind, t);
};

/** A tiny deterministic generator per character, so "messy" hair is the same on every client. */
const random = (seed: string): (() => number) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
};

/** The cap every hairstyle starts from: the top of the head, slightly oversized. */
const cap = (b: PartBuilder, s: number, color: number, drop = 0): void => {
  box(b, s * 2.12, s * 0.42 + drop, s * 2.12, color, { y: s * 0.86 - drop / 2 });
};

/** Head gear colours, falling back to the general gear colours. */
const hat = (look: CharacterLook): number | undefined => look.hatColor ?? look.accColor;
const hat2 = (look: CharacterLook): number | undefined => look.hatColor2 ?? look.accColor2;
/** Capes and scarves. */
const capeOf = (look: CharacterLook): number | undefined => look.capeColor ?? look.accColor;

// ---------------------------------------------------------------- hair

const HAIR: Readonly<Record<HairStyle, (b: PartBuilder, s: number, look: CharacterLook, seed: string) => void>> = {
  none: () => {},
  spiky: (b, s, look) => {
    const c = look.hair.color;
    const tip = look.hair.color2 ?? c;
    cap(b, s, c);
    spike(b, c, 0, s * 1.02, -s * 0.1, s * 0.42, s * 1.35, -0.55, 0);
    for (let i = -2; i <= 2; i += 1) spike(b, i % 2 === 0 ? c : tip, i * s * 0.4, s * 0.75, -s * 0.75, s * 0.36, s * 1.25, -1.15, -i * 0.28);
    for (const side of [-1, 1]) {
      spike(b, c, side * s * 0.9, s * 0.62, -s * 0.15, s * 0.32, s * 1.0, -0.35, -side * 1.05);
      spike(b, tip, side * s * 0.45, s * 1.0, s * 0.2, s * 0.3, s * 1.1, -0.2, -side * 0.55);
    }
    for (const x of [-0.45, 0, 0.45]) spike(b, c, x * s, s * 0.86, s * 0.92, s * 0.2, s * 0.7, 2.55, x * 0.6);
  },
  super: (b, s, look) => {
    const c = look.hair.color;
    cap(b, s, c);
    for (let i = -2; i <= 2; i += 1) spike(b, c, i * s * 0.42, s * 1.0, -s * 0.2, s * 0.4, s * 1.9 - Math.abs(i) * s * 0.25, -0.35, -i * 0.26);
    for (let i = -1; i <= 1; i += 1) spike(b, c, i * s * 0.5, s * 0.7, -s * 0.8, s * 0.36, s * 1.5, -0.95, -i * 0.3);
    for (const side of [-1, 1]) spike(b, c, side * s * 0.95, s * 0.55, 0, s * 0.3, s * 1.1, -0.2, -side * 0.9);
    spike(b, c, s * 0.2, s * 0.9, s * 0.95, s * 0.16, s * 0.9, 2.7, -0.3);
  },
  flame: (b, s, look) => {
    const c = look.hair.color;
    const tip = look.hair.color2 ?? c;
    cap(b, s, c);
    for (let i = -2; i <= 2; i += 1) spike(b, i === 0 ? tip : c, i * s * 0.36, s * 1.0, -s * 0.15, s * 0.36, s * 2.0 - Math.abs(i) * s * 0.3, -0.18, -i * 0.12);
    for (let i = -1; i <= 1; i += 1) spike(b, tip, i * s * 0.4, s * 1.0, -s * 0.6, s * 0.3, s * 1.6, -0.45, -i * 0.15);
    // The widow's peak.
    spike(b, c, 0, s * 0.95, s * 0.95, s * 0.2, s * 0.55, 2.7, 0);
  },
  messy: (b, s, look, seed) => {
    const c = look.hair.color;
    const tip = look.hair.color2 ?? c;
    const rand = random(seed);
    cap(b, s, c, s * 0.1);
    for (let i = 0; i < 12; i += 1) {
      const angle = rand() * Math.PI * 2;
      const r = 0.3 + rand() * 0.7;
      const x = Math.sin(angle) * r * s;
      const z = Math.cos(angle) * r * s - s * 0.1;
      const lean = 0.5 + rand() * 0.6;
      spike(b, i % 3 === 0 ? tip : c, x, s * 0.9, z, s * 0.28, s * (0.65 + rand() * 0.4), (z / s) * lean, (-x / s) * lean);
    }
    for (const x of [-0.5, 0, 0.5]) spike(b, c, x * s, s * 0.85, s * 0.9, s * 0.2, s * 0.6, 2.6, x * 0.5);
  },
  spikyShort: (b, s, look, seed) => {
    const c = look.hair.color;
    const tip = look.hair.color2 ?? c;
    const rand = random(seed);
    cap(b, s, c);
    for (let i = 0; i < 11; i += 1) {
      const angle = (i / 11) * Math.PI * 2;
      const r = 0.55 + rand() * 0.35;
      spike(b, i % 2 === 0 ? c : tip, Math.sin(angle) * r * s, s * 0.95, Math.cos(angle) * r * s - s * 0.1, s * 0.28, s * (0.6 + rand() * 0.3), Math.cos(angle) * 0.6, -Math.sin(angle) * 0.6);
    }
    spike(b, c, 0, s * 1.05, 0, s * 0.3, s * 0.8, 0, 0);
  },
  long: (b, s, look) => {
    const c = look.hair.color;
    cap(b, s, c);
    box(b, s * 2.16, s * 2.8, s * 0.36, c, { y: -s * 0.45, z: -s * 1.1 });
    for (const side of [-1, 1]) box(b, s * 0.32, s * 1.9, s * 1.5, c, { x: side * s * 1.1, y: -s * 0.2, z: -s * 0.3 });
    box(b, s * 2.1, s * 0.3, s * 0.2, c, { y: s * 0.82, z: s * 1.02 });
  },
  longSpiky: (b, s, look) => {
    const c = look.hair.color;
    cap(b, s, c);
    box(b, s * 2.2, s * 2.2, s * 0.4, c, { y: -s * 0.2, z: -s * 1.1 });
    for (let i = -2; i <= 2; i += 1) spike(b, c, i * s * 0.42, -s * 0.6, -s * 1.1, s * 0.34, s * 1.8, -2.75, i * 0.18);
    for (let i = -2; i <= 2; i += 1) spike(b, c, i * s * 0.4, s * 0.8, -s * 0.6, s * 0.36, s * 1.2, -1.2, -i * 0.3);
    for (const side of [-1, 1]) spike(b, c, side * s * 1.0, s * 0.3, -s * 0.1, s * 0.3, s * 1.3, -0.8, -side * 1.4);
    for (const x of [-0.5, 0.1, 0.55]) spike(b, c, x * s, s * 0.85, s * 0.95, s * 0.22, s * 0.8, 2.55, x * 0.6);
  },
  slick: (b, s, look) => {
    const c = look.hair.color;
    box(b, s * 2.12, s * 0.46, s * 2.2, c, { y: s * 0.9, z: -s * 0.08, rx: 0.12 });
    box(b, s * 2.12, s * 1.0, s * 0.34, c, { y: s * 0.35, z: -s * 1.08 });
    for (const side of [-1, 1]) box(b, s * 0.26, s * 0.7, s * 1.4, c, { x: side * s * 1.06, y: s * 0.5, z: -s * 0.3 });
    spike(b, c, 0, s * 0.8, -s * 0.9, s * 0.3, s * 0.8, -1.9, 0);
  },
  bowl: (b, s, look) => {
    const c = look.hair.color;
    cap(b, s, c, s * 0.15);
    box(b, s * 2.16, s * 0.5, s * 0.24, c, { y: s * 0.72, z: s * 1.04 });
    for (const side of [-1, 1]) box(b, s * 0.26, s * 1.0, s * 2.16, c, { x: side * s * 1.06, y: s * 0.45 });
    box(b, s * 2.16, s * 1.0, s * 0.26, c, { y: s * 0.45, z: -s * 1.06 });
  },
  bob: (b, s, look) => {
    const c = look.hair.color;
    cap(b, s, c);
    for (const side of [-1, 1]) box(b, s * 0.32, s * 1.6, s * 2.1, c, { x: side * s * 1.1, y: s * 0.1, z: -s * 0.04 });
    box(b, s * 2.2, s * 1.6, s * 0.32, c, { y: s * 0.1, z: -s * 1.1 });
    box(b, s * 1.4, s * 0.42, s * 0.22, c, { x: s * 0.3, y: s * 0.72, z: s * 1.02 });
  },
  ponytail: (b, s, look) => {
    const c = look.hair.color;
    cap(b, s, c);
    box(b, s * 2.14, s * 1.1, s * 0.3, c, { y: s * 0.4, z: -s * 1.06 });
    b.add(new SphereGeometry(s * 0.34, 8, 6), look.hair.color2 ?? shade(c, 0.8), 'smooth', { y: s * 0.35, z: -s * 1.3 });
    b.add(new CylinderGeometry(s * 0.3, s * 0.12, s * 2.6, 6), c, 'smooth', { y: -s * 1.0, z: -s * 1.45, rx: 0.18 });
    for (const side of [-1, 1]) box(b, s * 0.26, s * 1.4, s * 0.3, c, { x: side * s * 0.9, y: s * 0.05, z: s * 0.95 });
  },
  topknot: (b, s, look) => {
    const c = look.hair.color;
    cap(b, s, c);
    b.add(new SphereGeometry(s * 0.5, 8, 6), c, 'smooth', { y: s * 1.4, z: -s * 0.2 });
  },
  twinTails: (b, s, look) => {
    const c = look.hair.color;
    cap(b, s, c);
    for (const side of [-1, 1]) {
      b.add(new SphereGeometry(s * 0.3, 8, 6), look.hair.color2 ?? 0xd02a4a, 'smooth', { x: side * s * 1.15, y: s * 0.6, z: -s * 0.3 });
      b.add(new CylinderGeometry(s * 0.34, s * 0.1, s * 2.6, 6), c, 'smooth', { x: side * s * 1.35, y: -s * 0.7, z: -s * 0.35, rz: side * 0.15 });
    }
  },
  mohawk: (b, s, look) => {
    box(b, s * 0.45, s * 1.0, s * 2.2, look.hair.color, { y: s * 1.25, z: -s * 0.1 });
  },
  afro: (b, s, look) => {
    b.add(new SphereGeometry(s * 1.55, 10, 8), look.hair.color, 'smooth', { y: s * 0.55, z: -s * 0.15 });
  },
  boar: (b, s, look) => {
    const c = look.hair.color;
    box(b, s * 2.3, s * 2.3, s * 2.3, c, { y: s * 0.05 });
    box(b, s * 1.1, s * 0.9, s * 0.9, shade(c, 0.85), { y: -s * 0.25, z: s * 1.5 });
    box(b, s * 0.7, s * 0.4, s * 0.12, 0x2a2a30, { y: -s * 0.25, z: s * 1.96 });
    for (const side of [-1, 1]) {
      spike(b, shade(c, 0.9), side * s * 0.8, s * 1.0, -s * 0.2, s * 0.32, s * 0.8, -0.2, -side * 0.5);
      spike(b, 0xf4f0e0, side * s * 0.45, -s * 0.7, s * 1.7, s * 0.1, s * 0.5, 0.6, -side * 0.3);
      b.add(new SphereGeometry(s * 0.16, 6, 4), 0x9ad8ff, 'glow', { x: side * s * 0.55, y: s * 0.3, z: s * 1.16 });
    }
  },
  fringe: (b, s, look) => {
    const c = look.hair.color;
    const c2 = look.hair.color2 ?? c;
    // Split colours: the character's right half in color2 (x < 0 is their right).
    box(b, s * 1.06, s * 0.44, s * 2.12, c2, { x: -s * 0.53, y: s * 0.86 });
    box(b, s * 1.06, s * 0.44, s * 2.12, c, { x: s * 0.53, y: s * 0.86 });
    box(b, s * 1.06, s * 0.56, s * 0.24, c2, { x: -s * 0.53, y: s * 0.6, z: s * 1.04 });
    box(b, s * 1.06, s * 0.56, s * 0.24, c, { x: s * 0.53, y: s * 0.6, z: s * 1.04 });
    box(b, s * 0.26, s * 1.2, s * 1.9, c2, { x: -s * 1.06, y: s * 0.35, z: -s * 0.08 });
    box(b, s * 0.26, s * 1.2, s * 1.9, c, { x: s * 1.06, y: s * 0.35, z: -s * 0.08 });
    box(b, s * 2.12, s * 1.1, s * 0.28, c, { y: s * 0.35, z: -s * 1.07 });
  },
};

// ------------------------------------------------------------ head gear

const HEAD_GEAR: Partial<Record<AccessoryId, (b: PartBuilder, s: number, look: CharacterLook) => void>> = {
  headband: (b, s, look) => {
    const cloth = hat(look) ?? 0x2f3f8f;
    const plate = hat2(look) ?? 0xcfd6e0;
    box(b, s * 2.14, s * 0.32, s * 2.14, cloth, { y: s * 0.6 });
    box(b, s * 0.95, s * 0.36, s * 0.1, plate, { y: s * 0.6, z: s * 1.09 });
    box(b, s * 0.2, s * 0.26, s * 0.9, cloth, { x: s * 0.25, y: s * 0.4, z: -s * 1.4, rx: 0.5 });
  },
  strawHat: (b, s, look) => {
    const straw = hat(look) ?? 0xf0d27a;
    const band = hat2(look) ?? 0xd82a2a;
    b.add(new CylinderGeometry(s * 2.0, s * 2.05, s * 0.12, 16), straw, 'smooth', { y: s * 1.02 });
    b.add(new CylinderGeometry(s * 1.08, s * 1.14, s * 0.8, 14), straw, 'smooth', { y: s * 1.45 });
    b.add(new CylinderGeometry(s * 1.16, s * 1.16, s * 0.22, 14), band, 'smooth', { y: s * 1.18 });
  },
  scouter: (b, s, look) => {
    box(b, s * 0.6, s * 0.46, s * 0.06, hat(look) ?? 0x40d060, { x: s * 0.52, y: s * 0.1, z: s * 1.12 }, 'glow');
    box(b, s * 0.18, s * 0.62, s * 0.62, 0xf4f4f8, { x: s * 1.08, y: s * 0.05, z: s * 0.3 });
    box(b, s * 0.12, s * 0.12, s * 0.9, 0xf4f4f8, { x: s * 1.08, y: s * 0.25, z: s * 0.75 });
  },
  horns: (b, s, look) => {
    for (const side of [-1, 1]) spike(b, hat(look) ?? 0xe8e4d8, side * s * 0.75, s * 0.95, 0, s * 0.26, s * 1.25, -0.2, -side * 0.5);
  },
  domeHead: (b, s, look) => {
    b.add(new SphereGeometry(s * 1.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hat(look) ?? 0x8b3bd6, 'smooth', { y: s * 0.55, z: -s * 0.08, sy: 0.9 });
  },
  crown: (b, s, look) => {
    const gold = hat2(look) ?? 0xe8c040;
    b.add(new CylinderGeometry(s * 1.12, s * 1.12, s * 0.3, 12), gold, 'smooth', { y: s * 1.05 });
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      spike(b, gold, Math.sin(a) * s * 1.0, s * 1.18, Math.cos(a) * s * 1.0, s * 0.18, s * 0.55, 0, 0);
    }
  },
  halo: (b, s, look) => {
    b.add(new TorusGeometry(s * 0.95, s * 0.1, 6, 20), hat(look) ?? 0xfff2a0, 'glow', { y: s * 1.75, rx: Math.PI / 2 });
  },
  hood: (b, s, look) => {
    // A peaked cap with a badge.
    const cloth = hat(look) ?? 0x16161c;
    b.add(new CylinderGeometry(s * 1.12, s * 1.1, s * 0.7, 14), cloth, 'smooth', { y: s * 1.05 });
    box(b, s * 1.7, s * 0.1, s * 0.9, cloth, { y: s * 0.78, z: s * 1.3 });
    box(b, s * 0.5, s * 0.3, s * 0.08, hat2(look) ?? 0xe8c040, { y: s * 1.1, z: s * 1.12 });
  },
  helmet: (b, s, look) => {
    const main = hat(look) ?? 0xf4f4f8;
    box(b, s * 2.24, s * 0.95, s * 2.24, main, { y: s * 0.75 });
    box(b, s * 0.6, s * 0.4, s * 0.6, hat2(look) ?? shade(main, 0.8), { y: s * 1.35 });
    for (const side of [-1, 1]) box(b, s * 0.14, s * 1.1, s * 1.6, shade(main, 0.9), { x: side * s * 1.14, y: s * 0.1, z: -s * 0.15 });
  },
  bandana: (b, s, look) => {
    const cloth = hat(look) ?? 0x16161c;
    box(b, s * 2.18, s * 0.6, s * 2.18, cloth, { y: s * 0.9 });
    b.add(new SphereGeometry(s * 0.22, 6, 4), cloth, 'smooth', { y: s * 0.75, z: -s * 1.2 });
    box(b, s * 0.2, s * 0.7, s * 0.14, cloth, { x: s * 0.15, y: s * 0.35, z: -s * 1.25, rz: 0.3 });
  },
  ears: (b, s, look) => {
    for (const side of [-1, 1]) {
      spike(b, hat(look) ?? 0x9a7ac8, side * s * 0.65, s * 0.95, 0, s * 0.42, s * 1.05, 0, -side * 0.3);
      spike(b, hat2(look) ?? 0x6a4a98, side * s * 0.65, s * 1.0, s * 0.12, s * 0.24, s * 0.75, 0, -side * 0.3);
    }
  },
  antennae: (b, s, look) => {
    for (const side of [-1, 1]) {
      b.add(new CylinderGeometry(s * 0.07, s * 0.1, s * 1.3, 5), hat2(look) ?? look.skin, 'smooth', {
        x: side * s * 0.35,
        y: s * 1.55,
        z: s * 0.4,
        rx: 0.35,
        rz: -side * 0.25,
      });
    }
  },
  earrings: (b, s, look) => {
    for (const side of [-1, 1]) b.add(new SphereGeometry(s * 0.14, 6, 4), hat(look) ?? 0xffd23a, 'smooth', { x: side * s * 1.08, y: -s * 0.42, z: s * 0.1 });
  },
};

// ------------------------------------------------------------ body gear

const cape = (b: PartBuilder, c: MountContext, color: number, length = 2.0): void => {
  const h = c.torsoH * length;
  box(b, c.torsoW * 1.25, h, 0.08, color, { y: -h / 2 + 0.1, z: -0.1, rx: 0.12 });
  box(b, c.torsoW * 1.28, 0.18, 0.26, color, { y: 0.08, z: 0.02 });
};

const katana = (b: PartBuilder, blade: number, handle: number): void => {
  box(b, 0.1, 0.1, 0.55, handle, { y: -0.1, z: 0.12 });
  box(b, 0.3, 0.06, 0.3, 0xe8c040, { y: -0.1, z: 0.42 });
  box(b, 0.05, 0.15, 1.9, blade, { y: -0.1, z: 1.42 });
};

const BACK_GEAR: Partial<Record<AccessoryId, Builder>> = {
  cape: (b, c, look) => cape(b, c, capeOf(look) ?? 0xd02a2a),
  wings: (b, c, look) => {
    for (const side of [-1, 1]) {
      box(b, 1.5, 1.8, 0.06, look.accColor2 ?? 0x16161c, { x: side * 0.9, y: -0.3, z: -0.3, ry: side * 0.5, rz: side * -0.35 });
    }
  },
  gourd: (b, c, look) => {
    const clay = look.accColor ?? 0xc8a06a;
    b.add(new SphereGeometry(0.62, 10, 8), clay, 'smooth', { x: 0.25, y: -0.75, z: -0.55 });
    b.add(new SphereGeometry(0.4, 10, 8), clay, 'smooth', { x: 0.1, y: 0.05, z: -0.5 });
    box(b, c.torsoW * 1.1, 0.12, 0.12, 0x6a4a2a, { y: -0.3, z: c.torsoD * 0.1, rz: 0.6 });
  },
  swordBack: (b, c, look) => {
    const blade = look.accColor ?? 0xdfe4ea;
    box(b, 0.14, 3.0, 0.6, blade, { x: 0.1, y: -0.6, z: -0.4, rz: 0.55 });
    box(b, 0.18, 0.7, 0.18, look.accColor2 ?? 0x2a2a2a, { x: -0.72, y: 0.72, z: -0.4, rz: 0.55 });
  },
  fanBack: (b, c, look) => {
    b.add(new CylinderGeometry(0.85, 0.85, 0.08, 16), look.accColor ?? 0xd8c8a0, 'smooth', { y: -0.4, z: -0.45, rx: Math.PI / 2 });
    b.add(new CylinderGeometry(0.4, 0.4, 0.1, 16), look.accColor2 ?? 0xa02a2a, 'smooth', { y: -0.4, z: -0.5, rx: Math.PI / 2 });
    box(b, 0.1, 1.6, 0.1, 0x5a3a24, { y: 0.6, z: -0.45 });
  },
  tail: (b, c, look) => {
    const color = look.accColor2 ?? look.accColor ?? 0x6a3a20;
    const y = -c.torsoH * 0.95;
    b.add(new CylinderGeometry(0.16, 0.2, 1.1, 6), color, 'smooth', { y: y - 0.2, z: -c.torsoD * 0.5 - 0.35, rx: -1.0 });
    b.add(new CylinderGeometry(0.12, 0.16, 1.0, 6), color, 'smooth', { y: y - 0.75, z: -c.torsoD * 0.5 - 1.0, rx: -0.3 });
    b.add(new SphereGeometry(0.16, 6, 4), color, 'smooth', { y: y - 1.2, z: -c.torsoD * 0.5 - 1.15 });
  },
  scarf: (b, c, look) => {
    const cloth = capeOf(look) ?? 0xd02a2a;
    b.add(new TorusGeometry(c.torsoW * 0.36, 0.14, 6, 12), cloth, 'smooth', { y: 0.12, z: c.torsoD * 0.45, rx: Math.PI / 2 });
    box(b, 0.3, 1.2, 0.08, cloth, { x: 0.25, y: -0.5, z: -0.12, rx: 0.2 });
  },
  shoulderPads: (b, c, look) => {
    for (const side of [-1, 1]) box(b, c.limb * 1.5, 0.3, c.torsoD * 1.4, look.accColor2 ?? 0xa02a2a, { x: side * (c.torsoW * 0.5 + c.limb * 0.4), y: 0.05, z: c.torsoD * 0.5 });
  },
};

const HAND_GEAR: Partial<Record<AccessoryId, (b: PartBuilder, c: MountContext, look: CharacterLook, hand: 'handR' | 'handL') => void>> = {
  katana: (b, _c, look, hand) => {
    if (hand === 'handR') katana(b, look.accColor ?? 0xcfd6e0, look.accColor2 ?? 0x2a2a2a);
  },
  dualSwords: (b, _c, look) => katana(b, look.accColor ?? 0xcfd6e0, look.accColor2 ?? 0x2a2a2a),
  staff: (b, _c, look, hand) => {
    if (hand !== 'handR') return;
    b.add(new CylinderGeometry(0.08, 0.08, 4.4, 6), look.accColor ?? 0x6a6a72, 'smooth', { y: 0.3, z: 0.12 });
    b.add(new SphereGeometry(0.22, 8, 6), look.accColor2 ?? shade(look.accColor ?? 0x6a6a72, 1.3), 'smooth', { y: 2.5, z: 0.12 });
  },
  scythe: (b, _c, look, hand) => {
    if (hand !== 'handR') return;
    b.add(new CylinderGeometry(0.07, 0.07, 4.0, 6), 0x3a2a1a, 'smooth', { y: 0.3, z: 0.12 });
    box(b, 0.06, 0.3, 1.6, look.accColor ?? 0xcfd6e0, { y: 2.2, z: 0.8, rx: 0.3 });
  },
  chainsaw: (b, _c, look) => {
    box(b, 0.34, 0.4, 0.7, look.accColor ?? 0xff7a1a, { y: -0.15, z: 0.2 });
    box(b, 0.08, 0.3, 1.6, look.accColor2 ?? 0xb8c0c8, { y: -0.15, z: 1.2 });
  },
  gauntlets: (b, c, look) => {
    box(b, c.limb * 1.25, 0.7, c.limb * 1.25, look.accColor ?? 0x3a4a3a, { y: 0.2 });
  },
};

/** Which mount each accessory hangs from. */
const MOUNT_OF: Readonly<Record<AccessoryId, MountSlot>> = {
  headband: 'head',
  strawHat: 'head',
  scouter: 'head',
  horns: 'head',
  domeHead: 'head',
  crown: 'head',
  halo: 'head',
  hood: 'head',
  helmet: 'head',
  bandana: 'head',
  ears: 'head',
  antennae: 'head',
  earrings: 'head',
  gourd: 'back',
  cape: 'back',
  wings: 'back',
  tail: 'back',
  katana: 'handR',
  swordBack: 'back',
  dualSwords: 'handR',
  staff: 'handR',
  scythe: 'handR',
  chainsaw: 'handR',
  shoulderPads: 'back',
  scarf: 'back',
  fanBack: 'back',
  gauntlets: 'handR',
};

/** Accessories that appear on BOTH hands. */
const BOTH_HANDS = new Set<AccessoryId>(['dualSwords', 'gauntlets', 'chainsaw']);

/**
 * Build the gear of one look for one mount into `b`. Returns false when the
 * mount has nothing on it.
 */
export const buildMount = (b: PartBuilder, slot: MountSlot, c: MountContext, look: CharacterLook, seed: string): boolean => {
  const s = c.head / 2;
  const accessories = look.accessories ?? [];
  let built = false;
  if (slot === 'head') {
    // A helmet or a boar mask replaces the hair silhouette.
    const hides = accessories.includes('helmet') || accessories.includes('hood');
    if (!hides || look.hair.style === 'longSpiky' || look.hair.style === 'long') {
      HAIR[look.hair.style](b, s, look, seed);
      built = look.hair.style !== 'none';
    }
    for (const id of accessories) {
      const make = HEAD_GEAR[id];
      if (make && MOUNT_OF[id] === 'head') {
        make(b, s, look);
        built = true;
      }
    }
    return built;
  }
  for (const id of accessories) {
    const mount = MOUNT_OF[id];
    if (slot === 'back' && mount === 'back') {
      BACK_GEAR[id]?.(b, c, look);
      built = true;
    }
    if (slot === 'handR' && mount === 'handR') {
      HAND_GEAR[id]?.(b, c, look, 'handR');
      built = true;
    }
    if (slot === 'handL' && mount === 'handR' && BOTH_HANDS.has(id)) {
      HAND_GEAR[id]?.(b, c, look, 'handL');
      built = true;
    }
  }
  return built;
};

export type GearGeometries = Partial<Record<PartKind, BufferGeometry>>;
