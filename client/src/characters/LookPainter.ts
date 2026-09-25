import type { CharacterLook, Marking, TopLook } from '@dice/shared';
import type { PaintPoint, SuitPainter } from './HeroPainter.js';
import { shade } from './HeroPainter.js';

/**
 * ONE PAINTER FOR EVERY CHARACTER: turns a `CharacterLook` (pure data) into
 * the colour at any point of the body, which `HeroPainter.paintSuit` rasterises
 * onto the supplied player model's atlas. A new character is a new row of
 * data; nothing here knows any character by name.
 *
 * Coordinates (see `PaintPoint`): u runs across a face as its viewer sees it,
 * v runs up it; nx/ny/nz locate the point inside the body part's box.
 */

const within = (value: number, min: number, max: number): boolean => value >= min && value <= max;
const ellipse = (p: PaintPoint, cu: number, cv: number, ru: number, rv: number): boolean =>
  ((p.u - cu) / ru) ** 2 + ((p.v - cv) / rv) ** 2 <= 1;
const segment = (p: PaintPoint, u0: number, v0: number, u1: number, v1: number, width: number): boolean => {
  const du = u1 - u0;
  const dv = v1 - v0;
  const length = du * du + dv * dv || 1;
  const t = Math.max(0, Math.min(1, ((p.u - u0) * du + (p.v - v0) * dv) / length));
  const x = u0 + du * t - p.u;
  const y = v0 + dv * t - p.v;
  return x * x + y * y <= width * width;
};
const frac = (x: number): number => x - Math.floor(x);

const isArm = (p: PaintPoint): boolean => p.part === 'armL' || p.part === 'armR';
const isLeg = (p: PaintPoint): boolean => p.part === 'legL' || p.part === 'legR';

/** The eye whites / iris / pupil at a point of the front face, or null. */
const eyeAt = (p: PaintPoint, look: CharacterLook): number | null => {
  const style = look.eyeStyle ?? 'normal';
  if (style === 'hidden') return null;
  for (const cu of [0.3, 0.7]) {
    const du = p.u - cu;
    const dv = p.v - 0.54;
    switch (style) {
      case 'closed':
        if (Math.abs(dv + du * du * 3) < 0.022 && Math.abs(du) < 0.11) return 0x2a1a1a;
        break;
      case 'glow':
        if (ellipse(p, cu, 0.54, 0.1, 0.085)) return ellipse(p, cu, 0.54, 0.05, 0.05) ? 0xffffff : look.eyes;
        break;
      case 'sharp': {
        // A narrow slanted eye: the outer corner higher.
        const slant = (cu < 0.5 ? -du : du) * 0.35;
        if (Math.abs(du) < 0.11 && Math.abs(dv - slant) < 0.045) {
          if (Math.abs(du) < 0.045) return Math.abs(du) < 0.02 ? 0x111111 : look.eyes;
          return 0xffffff;
        }
        if (Math.abs(du) < 0.12 && within(dv - slant, 0.045, 0.07)) return 0x1a1414;
        break;
      }
      case 'wide':
        if (ellipse(p, cu, 0.54, 0.1, 0.12)) {
          if (ellipse(p, cu, 0.53, 0.06, 0.08)) return ellipse(p, cu, 0.53, 0.028, 0.04) ? 0x111111 : look.eyes;
          return 0xffffff;
        }
        break;
      default:
        if (ellipse(p, cu, 0.54, 0.085, 0.1)) {
          if (ellipse(p, cu + (cu < 0.5 ? 0.012 : -0.012), 0.53, 0.05, 0.075)) {
            if (ellipse(p, cu, 0.56, 0.018, 0.022)) return 0xffffff;
            return ellipse(p, cu, 0.52, 0.026, 0.04) ? 0x111111 : look.eyes;
          }
          return 0xffffff;
        }
        break;
    }
  }
  return null;
};

/** Brows sit just above the eyes, in the hair colour. */
const browAt = (p: PaintPoint, look: CharacterLook): number | null => {
  if (look.eyeStyle === 'hidden') return null;
  const color = look.hair.style === 'none' ? shade(look.skin, 0.62) : shade(look.hair.color, 0.75);
  for (const cu of [0.3, 0.7]) {
    const inner = cu < 0.5 ? 0.4 : 0.6;
    const outer = cu < 0.5 ? 0.18 : 0.82;
    const tilt = look.eyeStyle === 'sharp' ? 0.05 : 0.01;
    if (segment(p, outer, 0.7, inner, 0.7 - tilt, 0.02)) return color;
  }
  return null;
};

const markingAt = (p: PaintPoint, marking: Marking, color: number): number | null => {
  switch (marking) {
    case 'whiskers':
      for (const side of [0, 1]) {
        const base = side === 0 ? 0.08 : 0.72;
        for (const dv of [0, 0.05, 0.1]) if (segment(p, base, 0.33 + dv, base + 0.2, 0.34 + dv, 0.01)) return color;
      }
      return null;
    case 'thirdEye':
      if (ellipse(p, 0.5, 0.8, 0.07, 0.06)) return ellipse(p, 0.5, 0.8, 0.028, 0.035) ? 0x111111 : 0xffffff;
      return null;
    case 'scar':
      return segment(p, 0.22, 0.44, 0.36, 0.33, 0.014) ? color : null;
    case 'xScar':
      if (segment(p, 0.2, 0.72, 0.34, 0.4, 0.014) || segment(p, 0.26, 0.74, 0.4, 0.42, 0.014) || segment(p, 0.32, 0.74, 0.46, 0.44, 0.014)) return color;
      return null;
    case 'tattoo':
      if (segment(p, 0.2, 0.46, 0.4, 0.46, 0.012) || segment(p, 0.6, 0.46, 0.8, 0.46, 0.012)) return color;
      if (segment(p, 0.5, 0.95, 0.5, 0.78, 0.014) || segment(p, 0.02, 0.35, 0.18, 0.28, 0.012) || segment(p, 0.98, 0.35, 0.82, 0.28, 0.012)) return color;
      return null;
    case 'cheekMarks':
      for (const cu of [0.2, 0.8]) {
        const du = Math.abs(p.u - cu);
        const dv = 0.42 - p.v;
        if (dv >= 0 && dv < 0.14 && du < 0.05 * (1 - dv / 0.14)) return color;
      }
      return null;
    case 'foreheadMark':
      return ellipse(p, 0.5, 0.82, 0.05, 0.045) ? color : null;
    case 'blindfold':
      return within(p.v, 0.44, 0.66) ? color : null;
    case 'eyepatch':
      if (ellipse(p, 0.3, 0.54, 0.12, 0.11)) return color;
      return segment(p, 0.18, 0.62, 0.02, 0.72, 0.012) || segment(p, 0.42, 0.62, 0.98, 0.74, 0.012) ? color : null;
    case 'glasses':
      for (const cu of [0.3, 0.7]) {
        const d = ((p.u - cu) / 0.12) ** 2 + ((p.v - 0.54) / 0.1) ** 2;
        if (d <= 1 && d >= 0.72) return color;
      }
      return segment(p, 0.42, 0.56, 0.58, 0.56, 0.01) ? color : null;
    case 'stitches':
      for (const [cu, cv] of [[0.2, 0.38], [0.8, 0.38], [0.5, 0.3], [0.35, 0.28], [0.65, 0.28]] as const) {
        if (ellipse(p, cu, cv, 0.025, 0.025)) return color;
      }
      return null;
    case 'mask':
      return p.v < 0.45 ? color : null;
    case 'lines':
      if (segment(p, 0.22, 0.44, 0.24, 0.3, 0.012) || segment(p, 0.78, 0.44, 0.76, 0.3, 0.012)) return color;
      return null;
  }
};

/** The front face of the head: eyes, brows, mouth, markings. */
const faceAt = (p: PaintPoint, look: CharacterLook): number => {
  const markColor = look.markColor ?? 0x222222;
  const marks = look.markings ?? [];
  // Coverings first: they hide the features under them.
  for (const cover of ['blindfold', 'mask', 'eyepatch'] as const) {
    if (marks.includes(cover)) {
      const hit = markingAt(p, cover, markColor);
      if (hit !== null) return hit;
    }
  }
  const eye = eyeAt(p, look);
  if (eye !== null) return eye;
  const brow = browAt(p, look);
  if (brow !== null) return brow;
  for (const mark of marks) {
    if (mark === 'blindfold' || mark === 'mask' || mark === 'eyepatch') continue;
    const hit = markingAt(p, mark, markColor);
    if (hit !== null) return hit;
  }
  // A small determined mouth.
  if (!marks.includes('mask') && Math.abs(p.u - 0.5) < 0.09 && Math.abs(p.v - 0.24) < 0.016) return shade(look.skin, 0.55);
  return look.skin;
};

/** Hair painted onto the head box (the silhouettes are geometry; this colours what they do not cover). */
const hairOnHead = (p: PaintPoint, look: CharacterLook): number | null => {
  const hair = look.hair;
  if (hair.style === 'none') return null;
  if (hair.style === 'boar') return hair.color;
  const color = hair.color;
  // Two-tone hair: the second colour on the right half (Todoroki) or at the tips.
  const tone = (): number => (hair.color2 !== undefined && hair.style === 'fringe' && p.nx < 0.5 ? hair.color2 : color);
  if (p.face === 'top') return tone();
  if (p.face === 'back') return p.v > 0.12 ? tone() : null;
  if (p.face === 'left' || p.face === 'right') {
    const low = hair.style === 'long' || hair.style === 'bob' || hair.style === 'longSpiky' || hair.style === 'ponytail' ? 0.2 : 0.5;
    const front = p.face === 'left' ? p.u : 1 - p.u;
    return p.v > low + front * 0.25 ? tone() : null;
  }
  if (p.face === 'front') {
    let fringe = 0.86;
    if (hair.style === 'bowl' || hair.style === 'fringe' || hair.style === 'bob') fringe = 0.76;
    if (hair.style === 'slick' || hair.style === 'super' || hair.style === 'flame') fringe = 0.92;
    // A ragged hairline.
    const ragged = fringe - Math.abs(Math.sin(p.u * 19)) * 0.04;
    return p.v > ragged ? tone() : null;
  }
  return null;
};

const patternAt = (p: PaintPoint, top: TopLook): number | null => {
  const color = top.patternColor ?? 0x111111;
  switch (top.pattern) {
    case 'checker': {
      const a = Math.floor(p.u * 5) + Math.floor(p.v * 5);
      return a % 2 === 0 ? color : null;
    }
    case 'flames': {
      const edge = 0.32 + Math.abs(Math.sin(p.u * Math.PI * 4)) * 0.18;
      return p.v < edge ? color : null;
    }
    case 'stripes':
      return frac(p.v * 5) < 0.28 ? color : null;
    case 'clouds': {
      const cells: readonly [number, number][] = [[0.25, 0.3], [0.7, 0.62], [0.3, 0.8], [0.75, 0.2]];
      for (const [cu, cv] of cells) {
        if (ellipse(p, cu, cv, 0.13, 0.08)) return ellipse(p, cu, cv, 0.1, 0.055) ? color : 0xf4f4f8;
      }
      return null;
    }
    case 'spots': {
      const cells: readonly [number, number][] = [[0.22, 0.78], [0.78, 0.78], [0.5, 0.45]];
      for (const [cu, cv] of cells) if (ellipse(p, cu, cv, 0.14, 0.12)) return color;
      return null;
    }
    default:
      return null;
  }
};

/** The torso by garment style. */
const torsoAt = (p: PaintPoint, look: CharacterLook): number => {
  const top = look.top;
  const base = top.color;
  const second = top.color2 ?? shade(base, 0.7);
  const trim = top.trim ?? shade(base, 0.6);
  const front = p.face === 'front';
  const center = Math.abs(p.u - 0.5);

  // The belt band across the bottom of every garment that has one.
  if (look.belt !== undefined && p.v < 0.12 && p.face !== 'top' && p.face !== 'bottom') {
    return front && center < 0.06 ? shade(look.belt, 1.25) : look.belt;
  }
  if (front && top.emblem !== undefined && ellipse(p, 0.7, 0.72, 0.12, 0.1)) {
    return ellipse(p, 0.7, 0.72, 0.05, 0.045) ? shade(top.emblem, 0.4) : top.emblem;
  }

  const pattern = (): number | null => patternAt(p, top);
  switch (top.style) {
    case 'gi':
    case 'robe': {
      // Crossed collar: a V opening down to the chest, lined in trim.
      const vDepth = top.style === 'gi' ? 0.45 : 0.35;
      const open = front && center < (p.v - vDepth) * 0.5;
      const edge = front && Math.abs(center - (p.v - vDepth) * 0.5) < 0.035 && p.v > vDepth;
      if (edge) return trim;
      if (open) return second;
      return pattern() ?? base;
    }
    case 'jacket': {
      if (front && center < 0.018) return trim;
      if (front && center < 0.14 && p.v > 0.55) return second;
      if (p.v > 0.8 && top.color2 !== undefined) return second;
      return pattern() ?? base;
    }
    case 'armor': {
      if (p.v < 0.34) return second;
      if (front && Math.abs(center - 0.3) < 0.035) return trim;
      if (p.v > 0.9) return trim;
      return pattern() ?? base;
    }
    case 'suit': {
      const open = front && center < (p.v - 0.3) * 0.35;
      if (open) return front && center < 0.035 && p.v > 0.35 ? (top.trim ?? 0xb0202a) : second;
      return base;
    }
    case 'bare': {
      if (top.pattern === 'stripes') {
        // Line tattoos wrapping the torso.
        if (frac(p.v * 4 + Math.sin(p.u * 6) * 0.08) < 0.08) return top.patternColor ?? 0x3a5ad0;
      }
      if (front && (Math.abs(center - 0.12) < 0.012 && p.v < 0.6 && p.v > 0.2)) return shade(look.skin, 0.85);
      if (front && Math.abs(p.v - 0.62) < 0.012 && center < 0.3) return shade(look.skin, 0.85);
      if (top.emblem !== undefined && p.v > 0.9) return top.emblem;
      return look.skin;
    }
    case 'uniform': {
      if (p.v > 0.88) return trim;
      if (front && center < 0.02) return shade(base, 0.7);
      if (front && center < 0.05 && frac(p.v * 5) < 0.18 && p.v < 0.85) return 0xe8c040;
      return base;
    }
    case 'coat': {
      if (front && center < 0.13) return second;
      if (front && Math.abs(center - 0.13) < 0.03) return trim;
      return pattern() ?? base;
    }
    case 'vest': {
      if (front && center < 0.22) return second;
      return base;
    }
    case 'hoodie': {
      if (p.face === 'back' && p.v > 0.75) return trim;
      if (front && p.v < 0.36 && center < 0.3) return shade(base, 0.85);
      if (front && p.v > 0.8 && center < 0.08) return trim;
      return base;
    }
    case 'bodysuit': {
      const hit = pattern();
      if (hit !== null) return hit;
      if (top.trim !== undefined && front && Math.abs(center - 0.28) < 0.03) return top.trim;
      return base;
    }
    case 'shirt':
    default:
      return pattern() ?? base;
  }
};

/** Which garment styles have full sleeves, and to where a short one reaches. */
const sleeveLength = (look: CharacterLook): number => {
  switch (look.top.style) {
    case 'bare':
      return 0;
    case 'vest':
      return 0.12;
    case 'gi':
      return 0.62;
    case 'shirt':
      return 0.68;
    case 'armor':
    case 'bodysuit':
    case 'robe':
    case 'coat':
    case 'jacket':
    case 'uniform':
    case 'suit':
    case 'hoodie':
      return 1;
  }
};

const armAt = (p: PaintPoint, look: CharacterLook): number => {
  if (look.gloves !== undefined && p.ny < 0.2) return look.gloves;
  const sleeve = sleeveLength(look);
  // ny runs 0 (hand) .. 1 (shoulder): a sleeve covers the top `sleeve` of the arm.
  const covered = sleeve >= 1 || p.ny > 1 - sleeve;
  if (!covered) return look.skin;
  const top = look.top;
  let color = top.style === 'armor' ? (top.color2 ?? top.color) : top.color;
  if (top.style === 'jacket' && top.color2 !== undefined && p.ny > 0.8) color = top.color2;
  if (top.style === 'coat' && top.pattern === 'clouds') {
    const hit = patternAt({ ...p, u: p.u, v: p.ny }, top);
    if (hit !== null) return hit;
  }
  // A cuff where a full sleeve ends.
  if (sleeve >= 1 && p.ny < 0.26 && top.trim !== undefined && top.style !== 'bodysuit') return top.trim;
  return color;
};

const legAt = (p: PaintPoint, look: CharacterLook): number => {
  if (look.shoes !== undefined && p.ny < 0.13) return look.shoes;
  if (look.pantsStyle === 'shorts' && p.ny < 0.55) return look.skin;
  if (look.top.style === 'bodysuit' && look.top.pattern === 'spots' && p.face === 'front' && ellipse({ ...p, u: p.u, v: p.ny }, 0.5, 0.5, 0.3, 0.12)) {
    return look.top.patternColor ?? look.pants;
  }
  if (look.pantsStyle === 'hakama' && p.ny > 0.13 && p.face === 'front' && Math.abs(p.u - 0.5) < 0.04) return shade(look.pants, 0.8);
  return look.pants;
};

/** The painter for one look. */
export const lookPainter = (look: CharacterLook): SuitPainter => (p) => {
  if (p.part === 'head') {
    const hair = hairOnHead(p, look);
    if (hair !== null) return hair;
    if (p.face === 'front') return faceAt(p, look);
    return look.skin;
  }
  if (p.part === 'torso') {
    if (p.face === 'top') return look.top.style === 'bare' ? look.skin : look.top.color;
    return torsoAt(p, look);
  }
  if (isArm(p)) return armAt(p, look);
  if (isLeg(p)) return legAt(p, look);
  return look.skin;
};
