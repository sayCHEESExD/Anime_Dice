import type { AbilityDef, CharacterDef, CharacterLook, VfxDef, VfxKind } from './characterTypes.js';

/**
 * THE CHARACTER POOL. Pure data, sorted from most common to rarest.
 *
 * Names and series are light parodies of well-known anime, in the style of the
 * genre. Every figure a character has (income, attack, health, sell value,
 * odds after luck) is DERIVED from `odds` and `role` by `systems/stats.ts`,
 * so a new row needs no code. `verify:data` checks every row: unique ids,
 * odds inside the rarity band, a known ability, and so on.
 *
 * `id` is persisted in saves - never rename one.
 */

// ------------------------------------------------------------ palette

const SKIN = 0xf6d2ae;
const SKIN_WARM = 0xeebd92;
const TAN = 0xd9a47a;
const DARK = 0x8d5a3b;
const PALE = 0xfbe6d6;
const BLACK = 0x1c1c24;
const WHITE = 0xf4f4f8;
const GOLD = 0xffd23a;
const ORANGE = 0xf5781d;
const GI_BLUE = 0x1f4fd6;

const vfx = (kind: VfxKind, color: number, color2?: number): VfxDef => (color2 === undefined ? { kind, color } : { kind, color, color2 });

const ab = (
  name: string,
  kind: AbilityDef['kind'],
  every: number,
  power: number,
  fx: AbilityDef['fx'],
  color: number,
): AbilityDef => ({ name, kind, every, power, fx, color });

const look = (value: CharacterLook): CharacterLook => value;

const DB = 'Dragon Orb';
const NIN = 'Leaf Ninja';
const PIR = 'Pirate Piece';
const SOUL = 'Soul Blade';
const DEM = 'Demon Hunter';
const CUR = 'Cursed Arts';
const HERO = 'Hero Academy';
const TIT = 'Titan Wall';
const HUN = 'Hunter Guild';
const PUN = 'Punch Hero';
const SAW = 'Chainsaw Devil';
const SOLO = 'Solo Hunter';
const JOJ = 'Bizarre Stand';

export const CHARACTERS: readonly CharacterDef[] = [
  // ================================================================ COMMON
  {
    id: 'naruta', name: 'Naruta', series: NIN, odds: 2, rarity: 'common', role: 'balanced',
    ability: ab('Shadow Clone', 'burst', 4, 1.8, 'punch', 0xffa53a),
    look: look({
      skin: SKIN, hair: { style: 'spiky', color: GOLD }, eyes: 0x2f7bff,
      top: { style: 'jacket', color: 0xff8a1c, color2: 0x2a2f45, trim: 0x2a2f45 }, pants: 0xff8a1c, shoes: 0x2a3a8a,
      markings: ['whiskers'], markColor: 0x6b3a20, accessories: ['headband'], accColor: 0x2f3f8f, accColor2: 0xcfd6e0,
    }),
    vfx: vfx('aura', 0xffa53a),
  },
  {
    id: 'saibaman', name: 'Saibaman', series: DB, odds: 3, rarity: 'common', role: 'striker',
    ability: ab('Self Destruct', 'burst', 5, 2.2, 'fire', 0x9cff4a),
    look: look({
      skin: 0x6fcf3c, hair: { style: 'none', color: 0x6fcf3c }, eyes: 0xd01020, eyeStyle: 'glow',
      top: { style: 'bodysuit', color: 0x6fcf3c, pattern: 'spots', patternColor: 0x4a9f24 }, pants: 0x5fb32e, shoes: 0x4a9f24,
      accessories: ['domeHead'], accColor: 0x86e04e,
    }),
    vfx: vfx('aura', 0x9cff4a),
  },
  {
    id: 'kririn', name: 'Kririn', series: DB, odds: 4, rarity: 'common', role: 'support',
    ability: ab('Destructo Disc', 'pierce', 4, 1.6, 'light', 0xfff27a),
    look: look({
      skin: SKIN, hair: { style: 'none', color: SKIN }, eyes: 0x222222,
      top: { style: 'gi', color: ORANGE, color2: GI_BLUE, emblem: 0xffffff }, pants: ORANGE, belt: GI_BLUE, shoes: GI_BLUE,
      markings: ['foreheadMark'], markColor: 0x3a2a1a,
    }),
    vfx: vfx('orbit', 0xfff27a),
  },
  {
    id: 'napa', name: 'Napa', series: DB, odds: 5, rarity: 'common', role: 'tank',
    look: look({
      skin: TAN, hair: { style: 'none', color: TAN }, eyes: 0x222222, eyeStyle: 'sharp',
      top: { style: 'armor', color: 0xf0ecd8, color2: 0x2b2f6a, trim: 0x9a7a3a }, pants: 0x2b2f6a, shoes: WHITE, gloves: WHITE,
      accessories: ['scouter'], accColor: 0x40d060,
      scale: 1.15,
    }),
    vfx: vfx('aura', 0xfff0a0),
  },
  {
    id: 'aizan', name: 'Aizan', series: SOUL, odds: 6, rarity: 'common', role: 'balanced',
    ability: ab('Kyoka Suigetsu', 'stun', 5, 1, 'dark', 0xb07aff),
    look: look({
      skin: SKIN, hair: { style: 'slick', color: 0x5a3a24 }, eyes: 0x5a3a24, eyeStyle: 'sharp',
      top: { style: 'robe', color: WHITE, color2: 0x1e1e26, trim: 0xd9d9e0 }, pants: WHITE, pantsStyle: 'hakama', belt: 0xb02a6a,
      accessories: ['katana'], accColor: 0xcfd6e0, accColor2: 0x3a2a1a,
    }),
    vfx: vfx('shadow', 0x8a5aff),
  },
  {
    id: 'radish', name: 'Radish', series: DB, odds: 7, rarity: 'common', role: 'striker',
    look: look({
      skin: SKIN_WARM, hair: { style: 'longSpiky', color: BLACK }, eyes: 0x222222, eyeStyle: 'sharp',
      top: { style: 'armor', color: 0x2e2e38, color2: 0x3a2a4a, trim: 0x8a6a3a }, pants: 0x3a2a4a, shoes: WHITE, gloves: 0x6a3a8a,
      accessories: ['scouter', 'tail'], accColor: 0xff4a4a, accColor2: 0x6a3a20,
    }),
    vfx: vfx('aura', 0xb080ff),
  },
  {
    id: 'rockli', name: 'Rock Li', series: NIN, odds: 8, rarity: 'common', role: 'striker',
    ability: ab('Leaf Hurricane', 'burst', 3, 1.7, 'wind', 0x6fff8a),
    look: look({
      skin: SKIN, hair: { style: 'bowl', color: BLACK }, eyes: 0x111111, eyeStyle: 'wide',
      top: { style: 'bodysuit', color: 0x3fae3a, trim: 0xff8a1c }, pants: 0x3fae3a, shoes: 0xff8a1c, belt: 0xd03030,
      accessories: ['headband'], accColor: 0xd03030, accColor2: 0xcfd6e0,
    }),
    vfx: vfx('wind', 0x9dff9a),
  },
  {
    id: 'zenitsa', name: 'Zenitsa', series: DEM, odds: 10, rarity: 'common', role: 'assassin',
    ability: ab('Thunderclap Flash', 'burst', 4, 2.1, 'lightning', 0xffe94a),
    look: look({
      skin: SKIN, hair: { style: 'messy', color: 0xffd23a, color2: 0xff8a1c }, eyes: 0x8a5a20, eyeStyle: 'closed',
      top: { style: 'robe', color: 0xffc933, color2: BLACK, trim: 0xffffff, pattern: 'stripes', patternColor: 0xffffff }, pants: BLACK, shoes: 0xffffff,
      accessories: ['katana'], accColor: 0xe8e8ee, accColor2: 0xffd23a,
    }),
    vfx: vfx('lightning', 0xffe94a),
  },
  {
    id: 'gara', name: 'Gara', series: NIN, odds: 12, rarity: 'common', role: 'tank',
    ability: ab('Sand Coffin', 'shield', 3, 0.5, 'wind', 0xe8c27a),
    look: look({
      skin: PALE, hair: { style: 'messy', color: 0xc8322a }, eyes: 0x5fd0b0, eyeStyle: 'sharp',
      top: { style: 'coat', color: 0x7a2a2a, color2: 0x3a3a3a, trim: 0xb09a7a }, pants: 0x3a3a3a, shoes: 0x3a3a3a,
      markings: ['foreheadMark', 'lines'], markColor: 0xc8322a, accessories: ['gourd'], accColor: 0xc8a06a,
    }),
    vfx: vfx('wind', 0xe8c27a),
  },
  {
    id: 'inosuka', name: 'Inosuka', series: DEM, odds: 15, rarity: 'common', role: 'striker',
    ability: ab('Beast Fang', 'burst', 3, 1.8, 'slash', 0x7fd0ff),
    look: look({
      skin: SKIN, hair: { style: 'boar', color: 0x6a6a72 }, eyes: 0x5ab0ff,
      top: { style: 'bare', color: SKIN }, pants: 0xd8d0c0, shoes: 0x9a8a6a, belt: 0x4a4a52,
      accessories: ['dualSwords'], accColor: 0x6a8aa0,
    }),
    vfx: vfx('wind', 0x7fd0ff),
  },
  {
    id: 'tien', name: 'Tien', series: DB, odds: 20, rarity: 'common', role: 'balanced',
    ability: ab('Tri-Beam', 'burst', 4, 2, 'beam', 0xfff27a),
    look: look({
      skin: 0xf2c4a8, hair: { style: 'none', color: 0xf2c4a8 }, eyes: 0x222222, eyeStyle: 'sharp',
      top: { style: 'gi', color: 0x2e8a3a, color2: 0x1f5a28, trim: 0xd03030 }, pants: 0x2e8a3a, belt: 0xd03030, shoes: 0x3a2a1a,
      markings: ['thirdEye'], markColor: 0x222222,
    }),
    vfx: vfx('aura', 0xfff5b0),
  },
  {
    id: 'zabusa', name: 'Zabusa', series: NIN, odds: 24, rarity: 'common', role: 'striker',
    ability: ab('Silent Killing', 'burst', 4, 2, 'slash', 0xbfe8ff),
    look: look({
      skin: SKIN, hair: { style: 'spikyShort', color: BLACK }, eyes: 0x222222, eyeStyle: 'sharp',
      top: { style: 'bare', color: SKIN, color2: 0x4a5a6a }, pants: 0x6a7a8a, shoes: 0x4a5a6a,
      markings: ['mask'], markColor: 0xe8e8e0, accessories: ['swordBack', 'headband'], accColor: 0xb8c0c8, accColor2: 0x8a9aa0,
    }),
    vfx: vfx('water', 0xbfe8ff),
  },
  {
    id: 'yuuji', name: 'Yuuji', series: CUR, odds: 26, rarity: 'common', role: 'striker',
    ability: ab('Divergent Fist', 'burst', 3, 1.8, 'punch', 0x7ab8ff),
    look: look({
      skin: SKIN, hair: { style: 'spikyShort', color: 0xff9ab0, color2: 0x2a1a1a }, eyes: 0x8a3a2a,
      top: { style: 'hoodie', color: 0x1a2240, color2: 0xd03040, trim: 0xd03040 }, pants: 0x1a2240, shoes: 0xd03040,
    }),
    vfx: vfx('aura', 0x7ab8ff),
  },
  {
    id: 'orochimara', name: 'Orochimara', series: NIN, odds: 30, rarity: 'common', role: 'support',
    ability: ab('Snake Hands', 'drain', 1, 0.2, 'dark', 0xa070ff),
    look: look({
      skin: 0xf2f0f4, hair: { style: 'long', color: BLACK }, eyes: 0xe8c020, eyeStyle: 'sharp',
      top: { style: 'robe', color: 0xe8e4d8, color2: 0x6a4aa0, trim: 0x6a4aa0 }, pants: 0x3a3a52, belt: 0x8a5ad0, shoes: 0x3a3a52,
      markings: ['lines'], markColor: 0x7a3aa0,
    }),
    vfx: vfx('shadow', 0xa070ff),
  },
  {
    id: 'dekku', name: 'Dekku', series: HERO, odds: 32, rarity: 'common', role: 'striker',
    ability: ab('Detroit Smash', 'burst', 4, 2.1, 'punch', 0x7aff9a),
    look: look({
      skin: SKIN, hair: { style: 'messy', color: 0x1f5a3a }, eyes: 0x2f8a4a, eyeStyle: 'wide',
      top: { style: 'bodysuit', color: 0x2f8a6a, color2: BLACK, trim: BLACK }, pants: 0x2f8a6a, shoes: 0xd03030, belt: 0x8a6a3a,
      markings: ['cheekMarks'], markColor: 0xb07a5a, accessories: ['gauntlets'], accColor: 0xe8e8ee,
    }),
    vfx: vfx('lightning', 0x7aff9a),
  },
  {
    id: 'levy', name: 'Levy', series: TIT, odds: 38, rarity: 'common', role: 'assassin',
    ability: ab('Spinning Blades', 'pierce', 3, 1.6, 'slash', 0xdfe8f0),
    look: look({
      skin: PALE, hair: { style: 'fringe', color: BLACK }, eyes: 0x5a6a7a, eyeStyle: 'sharp',
      top: { style: 'jacket', color: 0x8a6a4a, color2: WHITE, trim: 0x6a4a2a }, pants: WHITE, shoes: 0x4a3020, belt: 0x4a3020,
      accessories: ['dualSwords', 'cape'], accColor: 0xcfd6e0, accColor2: 0x2e6a3a, capeColor: 0x2e6a3a,
    }),
    vfx: vfx('wind', 0xdfe8f0),
  },
  {
    id: 'kilua', name: 'Kilua', series: HUN, odds: 45, rarity: 'common', role: 'assassin',
    ability: ab('Godspeed', 'stun', 4, 1, 'lightning', 0x6ad8ff),
    look: look({
      skin: PALE, hair: { style: 'spiky', color: 0xeef2f8 }, eyes: 0x4a8adf,
      top: { style: 'shirt', color: 0x5a4a8a, color2: WHITE, pattern: 'stripes', patternColor: WHITE }, pants: 0x3a3a52, pantsStyle: 'shorts', shoes: 0x6a5aa0,
    }),
    vfx: vfx('lightning', 0x6ad8ff),
  },
  {
    id: 'friza', name: 'Friza', series: DB, odds: 52, rarity: 'common', role: 'balanced',
    ability: ab('Death Beam', 'pierce', 4, 1.9, 'beam', 0xd070ff),
    look: look({
      skin: WHITE, hair: { style: 'none', color: WHITE }, eyes: 0xd02030, eyeStyle: 'sharp',
      top: { style: 'bodysuit', color: WHITE, color2: 0x8b3bd6, pattern: 'spots', patternColor: 0x8b3bd6 }, pants: WHITE, shoes: WHITE,
      markings: ['lines'], markColor: 0x8b3bd6, accessories: ['domeHead', 'tail'], accColor: 0x8b3bd6, accColor2: WHITE,
    }),
    vfx: vfx('aura', 0xd070ff),
  },

  // ============================================================== UNCOMMON
  {
    id: 'vegita', name: 'Vegita', series: DB, odds: 70, rarity: 'uncommon', role: 'striker',
    ability: ab('Galick Gun', 'burst', 4, 2.3, 'beam', 0xc07aff),
    look: look({
      skin: SKIN, hair: { style: 'flame', color: BLACK }, eyes: 0x222222, eyeStyle: 'sharp',
      top: { style: 'armor', color: WHITE, color2: GI_BLUE, trim: 0xe8c040 }, pants: GI_BLUE, shoes: WHITE, gloves: WHITE,
    }),
    vfx: vfx('aura', 0x9ac8ff),
  },
  {
    id: 'picolo', name: 'Picolo', series: DB, odds: 85, rarity: 'uncommon', role: 'support',
    ability: ab('Regeneration', 'heal', 3, 0.25, 'light', 0x9aff7a),
    look: look({
      skin: 0x5cbf4a, hair: { style: 'none', color: 0x5cbf4a }, eyes: 0x222222, eyeStyle: 'sharp',
      top: { style: 'gi', color: 0x6a3aa0, color2: 0x6a3aa0 }, pants: 0x6a3aa0, belt: 0x3a8ad0, shoes: 0x8a5a30,
      accessories: ['helmet', 'cape', 'antennae'], accColor: WHITE, accColor2: 0x5cbf4a,
    }),
    vfx: vfx('aura', 0x9aff7a),
  },
  {
    id: 'sasuka', name: 'Sasuka', series: NIN, odds: 100, rarity: 'uncommon', role: 'assassin',
    ability: ab('Chidori', 'burst', 3, 2, 'lightning', 0x7ab8ff),
    look: look({
      skin: PALE, hair: { style: 'flame', color: 0x1a1f36 }, eyes: 0xd02030, eyeStyle: 'sharp',
      top: { style: 'robe', color: WHITE, color2: 0x2a2f45, trim: 0x2a2f45 }, pants: 0x2a2f45, belt: 0x7a4ac0, shoes: 0x2a2f45,
      accessories: ['katana'], accColor: 0xcfd6e0, accColor2: 0x2a2f45,
    }),
    vfx: vfx('lightning', 0x7ab8ff),
  },
  {
    id: 'kakashe', name: 'Kakashe', series: NIN, odds: 120, rarity: 'uncommon', role: 'balanced',
    ability: ab('Lightning Blade', 'pierce', 3, 1.8, 'lightning', 0x9ad8ff),
    look: look({
      skin: SKIN, hair: { style: 'spiky', color: 0xd8dce4 }, eyes: 0x333333, eyeStyle: 'closed',
      top: { style: 'vest', color: 0x5a7a4a, color2: 0x2a3552, trim: 0x2a3552 }, pants: 0x2a3552, shoes: 0x2a3552,
      markings: ['mask', 'scar'], markColor: 0x2a3552, accessories: ['headband'], accColor: 0x2f3f8f, accColor2: 0xcfd6e0,
    }),
    vfx: vfx('lightning', 0x9ad8ff),
  },
  {
    id: 'zolo', name: 'Zolo', series: PIR, odds: 140, rarity: 'uncommon', role: 'striker',
    ability: ab('Three Sword Style', 'pierce', 3, 1.9, 'slash', 0x8aff9a),
    look: look({
      skin: TAN, hair: { style: 'spikyShort', color: 0x3fae5a }, eyes: 0x222222, eyeStyle: 'sharp',
      top: { style: 'shirt', color: WHITE }, pants: BLACK, belt: 0x3fae5a, shoes: BLACK,
      markings: ['scar'], markColor: 0x8a3a2a, accessories: ['dualSwords', 'katana', 'earrings', 'bandana'], accColor: 0xcfd6e0, accColor2: 0x1a1a1a, hatColor: 0x1a1a1a, hatColor2: 0xffd23a,
    }),
    vfx: vfx('wind', 0x8aff9a),
  },
  {
    id: 'krokodile', name: 'Krokodile', series: PIR, odds: 150, rarity: 'uncommon', role: 'tank',
    ability: ab('Desert Spada', 'drain', 1, 0.25, 'wind', 0xe8c27a),
    look: look({
      skin: PALE, hair: { style: 'slick', color: BLACK }, eyes: 0x222222, eyeStyle: 'sharp',
      top: { style: 'coat', color: 0x2e2a36, color2: 0x8a6a3a, trim: 0x6a4a2a }, pants: 0x2e2a36, shoes: 0x1a1a1a,
      markings: ['scar'], markColor: 0xb07a6a, accessories: ['scarf'], accColor: 0xe8c040,
    }),
    vfx: vfx('wind', 0xe8c27a),
  },
  {
    id: 'sanjy', name: 'Sanjy', series: PIR, odds: 165, rarity: 'uncommon', role: 'striker',
    ability: ab('Diable Jambe', 'burst', 4, 2.3, 'fire', 0xff8a3a),
    look: look({
      skin: SKIN, hair: { style: 'bob', color: GOLD }, eyes: 0x2a4a8a, eyeStyle: 'sharp',
      top: { style: 'suit', color: 0x1a1a24, color2: 0x3a5ad0, trim: 0x1a1a24 }, pants: 0x1a1a24, shoes: 0x1a1a1a,
    }),
    vfx: vfx('flames', 0xff8a3a, 0xffd23a),
  },
  {
    id: 'tanjira', name: 'Tanjira', series: DEM, odds: 190, rarity: 'uncommon', role: 'balanced',
    ability: ab('Water Wheel', 'pierce', 3, 1.8, 'water', 0x4ab8ff),
    look: look({
      skin: SKIN, hair: { style: 'messy', color: 0x6a1a1a, color2: 0xc03a2a }, eyes: 0xa03a2a,
      top: { style: 'robe', color: 0x2f8a5a, color2: BLACK, trim: BLACK, pattern: 'checker', patternColor: BLACK }, pants: BLACK, shoes: WHITE,
      markings: ['scar'], markColor: 0xa03a2a, accessories: ['katana', 'earrings'], accColor: 0x2a2a2a, accColor2: 0xe8e8e0, hatColor: 0xe8e8e0,
    }),
    vfx: vfx('water', 0x4ab8ff),
  },
  {
    id: 'megumo', name: 'Megumo', series: CUR, odds: 220, rarity: 'uncommon', role: 'support',
    ability: ab('Divine Dogs', 'stun', 4, 1, 'dark', 0x6a6aff),
    look: look({
      skin: PALE, hair: { style: 'spiky', color: 0x1a1f2a }, eyes: 0x3a6a8a, eyeStyle: 'sharp',
      top: { style: 'uniform', color: 0x1a2240, trim: 0xe8c040 }, pants: 0x1a2240, shoes: 0x1a1a1a,
    }),
    vfx: vfx('shadow', 0x6a6aff),
  },
  {
    id: 'grimjow', name: 'Grimjow', series: SOUL, odds: 230, rarity: 'uncommon', role: 'striker',
    ability: ab('Gran Rey Cero', 'burst', 4, 2.4, 'beam', 0x4ad0ff),
    look: look({
      skin: SKIN, hair: { style: 'slick', color: 0x4ab8e8 }, eyes: 0x4ab8e8, eyeStyle: 'sharp',
      top: { style: 'coat', color: WHITE, color2: SKIN, trim: BLACK }, pants: WHITE, pantsStyle: 'hakama', belt: BLACK, shoes: BLACK,
      markings: ['lines'], markColor: 0x3aa0a0, accessories: ['katana'], accColor: 0xcfd6e0, accColor2: 0x2a8ad0,
    }),
    vfx: vfx('lightning', 0x4ad0ff),
  },
  {
    id: 'bakugou', name: 'Bakugou', series: HERO, odds: 250, rarity: 'uncommon', role: 'striker',
    ability: ab('Howitzer Impact', 'burst', 3, 2.2, 'fire', 0xffa030),
    look: look({
      skin: SKIN, hair: { style: 'spikyShort', color: 0xf0e8b0 }, eyes: 0xd03020, eyeStyle: 'sharp',
      top: { style: 'bodysuit', color: 0x1a1a24, color2: 0xff7a1a, trim: 0xff7a1a }, pants: 0x1a1a24, shoes: 0xff7a1a,
      accessories: ['gauntlets'], accColor: 0x3a4a3a,
    }),
    vfx: vfx('flames', 0xffa030, 0xff4a1a),
  },
  {
    id: 'gonn', name: 'Gonn', series: HUN, odds: 280, rarity: 'uncommon', role: 'striker',
    ability: ab('Jajanken', 'burst', 4, 2.6, 'punch', 0xffe07a),
    look: look({
      skin: SKIN, hair: { style: 'spiky', color: 0x1a2a1a, color2: 0x2f6a3a }, eyes: 0x6a4a1a, eyeStyle: 'wide',
      top: { style: 'jacket', color: 0x2f9a3a, color2: 0x2f9a3a, trim: 0xe8c040 }, pants: 0x2f9a3a, pantsStyle: 'shorts', shoes: 0x2f9a3a,
    }),
    vfx: vfx('aura', 0xffe07a),
  },

  // ================================================================== RARE
  {
    id: 'gohon', name: 'Gohon', series: DB, odds: 340, rarity: 'rare', role: 'balanced',
    ability: ab('Masenko', 'burst', 3, 2.2, 'beam', 0xffe07a),
    look: look({
      skin: SKIN, hair: { style: 'spiky', color: BLACK }, eyes: 0x222222,
      top: { style: 'gi', color: 0x6a3aa0, color2: 0x6a3aa0 }, pants: 0x6a3aa0, belt: 0xd03030, shoes: 0x8a5a30,
    }),
    vfx: vfx('aura', 0xffe07a),
  },
  {
    id: 'lufy', name: 'Lufy', series: PIR, odds: 420, rarity: 'rare', role: 'balanced',
    ability: ab('Gum-Gum Gatling', 'burst', 3, 2.2, 'punch', 0xff6a6a),
    look: look({
      skin: SKIN, hair: { style: 'messy', color: BLACK }, eyes: 0x222222, eyeStyle: 'wide',
      top: { style: 'vest', color: 0xd82a2a, color2: SKIN }, pants: 0x2f5ad0, pantsStyle: 'shorts', belt: 0xe8c040, shoes: 0xc8a06a,
      markings: ['scar'], markColor: 0x9a4a3a, accessories: ['strawHat'], accColor: 0xf0d27a, accColor2: 0xd82a2a,
    }),
    vfx: vfx('aura', 0xff9a9a),
  },
  {
    id: 'ichiga', name: 'Ichiga', series: SOUL, odds: 520, rarity: 'rare', role: 'striker',
    ability: ab('Getsuga Tensho', 'pierce', 3, 2.2, 'slash', 0x3a8aff),
    look: look({
      skin: SKIN, hair: { style: 'spiky', color: 0xff8a2a }, eyes: 0x6a3a1a, eyeStyle: 'sharp',
      top: { style: 'robe', color: 0x16161c, color2: WHITE, trim: WHITE }, pants: 0x16161c, pantsStyle: 'hakama', belt: WHITE, shoes: WHITE,
      accessories: ['swordBack'], accColor: 0xdfe4ea, accColor2: 0x2a2a2a,
    }),
    vfx: vfx('aura', 0x3a8aff, 0x10101a),
  },
  {
    id: 'todorokki', name: 'Todorokki', series: HERO, odds: 640, rarity: 'rare', role: 'balanced',
    ability: ab('Flashfreeze Heatwave', 'burst', 3, 2.3, 'ice', 0x9ae8ff),
    look: look({
      skin: PALE, hair: { style: 'fringe', color: WHITE, color2: 0xd02a2a }, eyes: 0x6a8aa0,
      top: { style: 'jacket', color: 0x2a3f7a, color2: 0x1a2240, trim: 0xe8e8ee }, pants: 0x2a3f7a, shoes: 0x1a1a24, belt: 0xcfd6e0,
      markings: ['scar'], markColor: 0xa03a3a,
    }),
    vfx: vfx('frost', 0x9ae8ff, 0xff6a3a),
  },
  {
    id: 'mikassa', name: 'Mikassa', series: TIT, odds: 780, rarity: 'rare', role: 'assassin',
    ability: ab('Blade Storm', 'pierce', 3, 2, 'slash', 0xdfe8f0),
    look: look({
      skin: PALE, hair: { style: 'bob', color: BLACK }, eyes: 0x3a3a4a, eyeStyle: 'sharp',
      top: { style: 'jacket', color: 0x8a6a4a, color2: WHITE, trim: 0x6a4a2a }, pants: WHITE, shoes: 0x4a3020, belt: 0x4a3020,
      accessories: ['scarf', 'dualSwords'], accColor: 0xcfd6e0, accColor2: 0x2a2a2a, capeColor: 0xd02a2a,
    }),
    vfx: vfx('wind', 0xdfe8f0),
  },
  {
    id: 'genoss', name: 'Genoss', series: PUN, odds: 900, rarity: 'rare', role: 'striker',
    ability: ab('Incineration Cannon', 'burst', 3, 2.4, 'fire', 0xffb03a),
    look: look({
      skin: SKIN, hair: { style: 'messy', color: GOLD }, eyes: 0xffe07a, eyeStyle: 'glow',
      top: { style: 'shirt', color: 0x1a1a24, color2: 0x3a3a44 }, pants: 0x1a1a24, shoes: 0x2a2a32, gloves: 0x2a2a32,
      accessories: ['gauntlets'], accColor: 0x3a3a44,
    }),
    vfx: vfx('flames', 0xffb03a, 0xff6a1a),
  },
  {
    id: 'hisoko', name: 'Hisoko', series: HUN, odds: 1050, rarity: 'rare', role: 'assassin',
    ability: ab('Bungee Gum', 'stun', 3, 1, 'dark', 0xff6ad0),
    look: look({
      skin: PALE, hair: { style: 'slick', color: 0xd83a4a }, eyes: 0xe8c020, eyeStyle: 'sharp',
      top: { style: 'shirt', color: 0xe8e4f0, color2: 0x8a4ad0, pattern: 'spots', patternColor: 0x8a4ad0 }, pants: 0xe8e4f0, shoes: 0x6a3aa0, belt: 0x8a4ad0,
      markings: ['cheekMarks'], markColor: 0x8a4ad0,
    }),
    vfx: vfx('orbit', 0xff6ad0),
  },
  {
    id: 'denjy', name: 'Denjy', series: SAW, odds: 1200, rarity: 'rare', role: 'striker',
    ability: ab('Chainsaw Rampage', 'drain', 1, 0.3, 'slash', 0xff4a3a),
    look: look({
      skin: SKIN, hair: { style: 'messy', color: 0xf0d05a }, eyes: 0x8a6a2a, eyeStyle: 'sharp',
      top: { style: 'suit', color: WHITE, color2: 0x1a1a24, trim: WHITE }, pants: 0x1a1a24, shoes: 0x2a2a2a,
      accessories: ['chainsaw'], accColor: 0xff7a1a, accColor2: 0xb8c0c8,
    }),
    vfx: vfx('lightning', 0xff4a3a),
  },
  {
    id: 'rengaku', name: 'Rengaku', series: DEM, odds: 1400, rarity: 'rare', role: 'balanced',
    ability: ab('Flame Tiger', 'burst', 3, 2.4, 'fire', 0xff7a1a),
    look: look({
      skin: SKIN, hair: { style: 'flame', color: 0xffc233, color2: 0xe03a1a }, eyes: 0xffa020, eyeStyle: 'wide',
      top: { style: 'robe', color: WHITE, color2: BLACK, trim: 0xff5a1a, pattern: 'flames', patternColor: 0xff5a1a }, pants: BLACK, shoes: WHITE,
      accessories: ['katana'], accColor: 0xff7a1a, accColor2: 0xe03a1a,
    }),
    vfx: vfx('flames', 0xff7a1a, 0xffd23a),
  },

  // ================================================================== EPIC
  {
    id: 'itachy', name: 'Itachy', series: NIN, odds: 1_700, rarity: 'epic', role: 'support',
    ability: ab('Tsukuyomi', 'stun', 3, 1, 'dark', 0xd0203a),
    look: look({
      skin: PALE, hair: { style: 'ponytail', color: BLACK }, eyes: 0xd02030, eyeStyle: 'glow',
      top: { style: 'coat', color: 0x16161c, color2: 0x16161c, trim: 0xd02030, pattern: 'clouds', patternColor: 0xd02030 }, pants: 0x2a2a3a, shoes: 0x2a2a3a,
      markings: ['lines'], markColor: 0x6a4a4a, accessories: ['headband'], accColor: 0x2a2a3a, accColor2: 0xcfd6e0,
    }),
    vfx: vfx('shadow', 0xd0203a),
  },
  {
    id: 'gojou', name: 'Gojou', series: CUR, odds: 2_100, rarity: 'epic', role: 'balanced',
    ability: ab('Hollow Purple', 'pierce', 4, 2.8, 'beam', 0xb05aff),
    look: look({
      skin: PALE, hair: { style: 'spiky', color: 0xf4f6fa }, eyes: 0x5ac8ff, eyeStyle: 'hidden',
      top: { style: 'uniform', color: 0x16161c, trim: 0x2a2a3a }, pants: 0x16161c, shoes: 0x16161c,
      markings: ['blindfold'], markColor: 0x16161c,
    }),
    vfx: vfx('cosmic', 0x6ab8ff, 0xb05aff),
  },
  {
    id: 'byakua', name: 'Byakua', series: SOUL, odds: 2_600, rarity: 'epic', role: 'balanced',
    ability: ab('Senbonzakura', 'pierce', 3, 2.2, 'wind', 0xff9ad0),
    look: look({
      skin: PALE, hair: { style: 'long', color: BLACK }, eyes: 0x5a5a7a, eyeStyle: 'sharp',
      top: { style: 'robe', color: WHITE, color2: 0x16161c, trim: 0xd8e8d8 }, pants: 0x16161c, pantsStyle: 'hakama', belt: 0x16161c, shoes: WHITE,
      accessories: ['scarf', 'katana'], accColor: 0xcfd6e0, accColor2: 0x16161c, capeColor: 0xcfe8d8,
    }),
    vfx: vfx('petals', 0xff9ad0),
  },
  {
    id: 'shanx', name: 'Shanx', series: PIR, odds: 3_200, rarity: 'epic', role: 'striker',
    ability: ab("Conqueror's Haki", 'stun', 3, 1, 'dark', 0xd02030),
    look: look({
      skin: SKIN, hair: { style: 'messy', color: 0xc8322a }, eyes: 0x222222, eyeStyle: 'sharp',
      top: { style: 'shirt', color: WHITE }, pants: 0x6a5a3a, belt: 0x3a8a3a, shoes: 0x3a2a1a,
      markings: ['xScar'], markColor: 0x9a3a2a, accessories: ['cape', 'katana'], accColor: 0xcfd6e0, accColor2: 0x16161c, capeColor: 0x16161c,
    }),
    vfx: vfx('aura', 0xd02030, 0x16161c),
  },
  {
    id: 'allmite', name: 'All Mite', series: HERO, odds: 3_900, rarity: 'epic', role: 'tank',
    ability: ab('United States Smash', 'burst', 4, 3, 'punch', 0xffe07a),
    look: look({
      skin: SKIN, hair: { style: 'slick', color: GOLD }, eyes: 0x3a8adf, eyeStyle: 'hidden',
      top: { style: 'bodysuit', color: 0x2f5ad0, color2: 0xd02a2a, trim: WHITE, emblem: 0xd02a2a }, pants: 0x2f5ad0, shoes: 0xd02a2a, belt: 0xe8c040,
      accessories: ['antennae', 'cape'], accColor: GOLD, accColor2: 0xd02a2a, capeColor: 0xd02a2a, scale: 1.2,
    }),
    vfx: vfx('aura', 0xffe07a, 0x3a8adf),
  },
  {
    id: 'saitamo', name: 'Saitamo', series: PUN, odds: 4_600, rarity: 'epic', role: 'striker',
    ability: ab('Serious Punch', 'burst', 5, 4, 'punch', 0xffffff),
    look: look({
      skin: SKIN, hair: { style: 'none', color: SKIN }, eyes: 0x222222, eyeStyle: 'closed',
      top: { style: 'bodysuit', color: 0xffd23a, color2: 0xffd23a }, pants: 0xffd23a, belt: 0x1a1a1a, shoes: 0xd02a2a, gloves: 0xd02a2a,
      accessories: ['cape'], accColor: WHITE,
    }),
    vfx: vfx('wind', 0xffffff),
  },
  {
    id: 'jotara', name: 'Jotara', series: JOJ, odds: 5_400, rarity: 'epic', role: 'striker',
    ability: ab('Ora Ora Rush', 'burst', 3, 2.6, 'punch', 0xb07aff),
    look: look({
      skin: SKIN, hair: { style: 'fringe', color: 0x16161c }, eyes: 0x3a8a8a, eyeStyle: 'sharp',
      top: { style: 'coat', color: 0x16161c, color2: 0x3a3a52, trim: 0xe8c040 }, pants: 0x16161c, shoes: 0x3a2a1a,
      accessories: ['hood'], accColor: 0x16161c, accColor2: 0xe8c040,
    }),
    vfx: vfx('aura', 0xb07aff),
  },
  {
    id: 'akasa', name: 'Akasa', series: DEM, odds: 6_300, rarity: 'epic', role: 'striker',
    ability: ab('Destructive Death', 'burst', 3, 2.6, 'ice', 0x6ab8ff),
    look: look({
      skin: 0xf2d0c0, hair: { style: 'spikyShort', color: 0xff8ab0 }, eyes: 0xe8c020, eyeStyle: 'glow',
      top: { style: 'bare', color: 0xf2d0c0, pattern: 'stripes', patternColor: 0x3a5ad0 }, pants: 0xd8d0f0, shoes: 0xd8d0f0,
      markings: ['tattoo'], markColor: 0x3a5ad0,
    }),
    vfx: vfx('orbit', 0x6ab8ff),
  },
  {
    id: 'ulquiora', name: 'Ulquiora', series: SOUL, odds: 7_200, rarity: 'epic', role: 'balanced',
    ability: ab('Cero Oscuras', 'pierce', 3, 2.4, 'dark', 0x3aff8a),
    look: look({
      skin: 0xf4f4f8, hair: { style: 'fringe', color: BLACK }, eyes: 0x3aff8a, eyeStyle: 'glow',
      top: { style: 'coat', color: WHITE, color2: WHITE, trim: BLACK }, pants: WHITE, pantsStyle: 'hakama', belt: BLACK, shoes: BLACK,
      markings: ['lines'], markColor: 0x2a8a5a, accessories: ['helmet', 'wings'], accColor: WHITE, accColor2: 0x16161c,
    }),
    vfx: vfx('shadow', 0x3aff8a),
  },

  // ============================================================= LEGENDARY
  {
    id: 'supergokku', name: 'Super Gokku', series: DB, odds: 9_500, rarity: 'legendary', role: 'balanced',
    ability: ab('Kamehameha', 'burst', 3, 2.8, 'beam', 0x6ad8ff),
    look: look({
      skin: SKIN, hair: { style: 'super', color: 0xffe04a }, eyes: 0x2fbf8a, eyeStyle: 'sharp',
      top: { style: 'gi', color: ORANGE, color2: GI_BLUE, emblem: 0xffffff }, pants: ORANGE, belt: GI_BLUE, shoes: GI_BLUE,
    }),
    vfx: vfx('aura', 0xffe04a, 0xffffff),
  },
  {
    id: 'madra', name: 'Madra', series: NIN, odds: 12_000, rarity: 'legendary', role: 'tank',
    ability: ab('Perfect Susano', 'shield', 3, 0.6, 'fire', 0x6a8aff),
    look: look({
      skin: PALE, hair: { style: 'longSpiky', color: 0x16161c }, eyes: 0xd02030, eyeStyle: 'glow',
      top: { style: 'armor', color: 0xa02a2a, color2: 0x2a2a3a, trim: 0x16161c }, pants: 0x2a2a3a, shoes: 0x2a2a3a,
      accessories: ['fanBack', 'shoulderPads'], accColor: 0xd8c8a0, accColor2: 0xa02a2a,
    }),
    vfx: vfx('flames', 0x6a8aff, 0x9a5aff),
  },
  {
    id: 'kenpachy', name: 'Kenpachy', series: SOUL, odds: 15_000, rarity: 'legendary', role: 'striker',
    ability: ab('Nozarashi', 'rage', 2, 1.25, 'slash', 0xffd23a),
    look: look({
      skin: TAN, hair: { style: 'longSpiky', color: 0x16161c }, eyes: 0x222222, eyeStyle: 'sharp',
      top: { style: 'robe', color: WHITE, color2: 0x16161c, trim: 0xb0b0b8 }, pants: 0x16161c, pantsStyle: 'hakama', shoes: WHITE,
      markings: ['eyepatch', 'scar'], markColor: 0x16161c, accessories: ['katana'], accColor: 0xa0a8b0, accColor2: 0x16161c, scale: 1.12,
    }),
    vfx: vfx('aura', 0xffd23a, 0x16161c),
  },
  {
    id: 'sukana', name: 'Sukana', series: CUR, odds: 19_000, rarity: 'legendary', role: 'striker',
    ability: ab('Malevolent Shrine', 'pierce', 3, 2.8, 'slash', 0xff2a3a),
    look: look({
      skin: SKIN, hair: { style: 'spikyShort', color: 0xff9ab0 }, eyes: 0xd0102a, eyeStyle: 'glow',
      top: { style: 'robe', color: 0xf0ece4, color2: 0x16161c, trim: 0x16161c }, pants: 0xf0ece4, belt: 0x16161c, shoes: 0x16161c,
      markings: ['tattoo'], markColor: 0x16161c,
    }),
    vfx: vfx('shadow', 0xff2a3a),
  },
  {
    id: 'whitebread', name: 'Whitebread', series: PIR, odds: 23_000, rarity: 'legendary', role: 'tank',
    ability: ab('Tremor Quake', 'pierce', 3, 2.4, 'water', 0xdff4ff),
    look: look({
      skin: TAN, hair: { style: 'slick', color: WHITE }, eyes: 0xe8c020, eyeStyle: 'sharp',
      top: { style: 'coat', color: WHITE, color2: TAN, trim: 0xd02a2a }, pants: 0xd8d0c0, belt: 0x3a2a4a, shoes: 0x3a2a1a,
      accessories: ['bandana', 'staff', 'cape'], accColor: 0x16161c, accColor2: WHITE, capeColor: WHITE, scale: 1.3,
    }),
    vfx: vfx('water', 0xdff4ff),
  },
  {
    id: 'jinwu', name: 'Jinwu', series: SOLO, odds: 28_000, rarity: 'legendary', role: 'assassin',
    ability: ab('Arise', 'rage', 2, 1.3, 'dark', 0x8a5aff),
    look: look({
      skin: PALE, hair: { style: 'messy', color: 0x16161c }, eyes: 0x6ab8ff, eyeStyle: 'glow',
      top: { style: 'coat', color: 0x16161c, color2: 0x2a2a3a, trim: 0x4a4a6a }, pants: 0x16161c, shoes: 0x16161c,
      accessories: ['dualSwords'], accColor: 0x8a5aff,
    }),
    vfx: vfx('shadow', 0x8a5aff),
  },
  {
    id: 'kaidou', name: 'Kaidou', series: PIR, odds: 34_000, rarity: 'legendary', role: 'tank',
    ability: ab('Thunder Bagua', 'burst', 3, 2.8, 'lightning', 0x7a8aff),
    look: look({
      skin: TAN, hair: { style: 'long', color: 0x16161c }, eyes: 0x222222, eyeStyle: 'sharp',
      top: { style: 'coat', color: 0x6a3aa0, color2: TAN, trim: 0xe8c040 }, pants: 0xe8e4d8, belt: 0xd02a2a, shoes: 0x3a2a1a,
      accessories: ['horns', 'staff'], accColor: 0xe8e4d8, accColor2: 0x6a6a72, scale: 1.35,
    }),
    vfx: vfx('flames', 0x7a8aff, 0xb07aff),
  },
  {
    id: 'dyo', name: 'Dyo', series: JOJ, odds: 40_000, rarity: 'legendary', role: 'balanced',
    ability: ab('The World', 'stun', 2, 1, 'light', 0xffe04a),
    look: look({
      skin: 0xfbe0c8, hair: { style: 'bob', color: 0xffe04a }, eyes: 0xd02030, eyeStyle: 'glow',
      top: { style: 'jacket', color: 0xffc933, color2: 0x16161c, trim: 0x2fae5a, emblem: 0x2fae5a }, pants: 0xffc933, shoes: 0x2fae5a,
      accessories: ['headband'], accColor: 0x2fae5a, accColor2: 0x2fae5a,
    }),
    vfx: vfx('aura', 0xffe04a, 0x2fae5a),
  },
  {
    id: 'muzen', name: 'Muzen', series: DEM, odds: 46_000, rarity: 'legendary', role: 'support',
    ability: ab('Blood Demon Art', 'drain', 1, 0.35, 'dark', 0xd0102a),
    look: look({
      skin: 0xf6ece6, hair: { style: 'fringe', color: 0x16161c }, eyes: 0xd0102a, eyeStyle: 'glow',
      top: { style: 'suit', color: 0xf0ece4, color2: 0x16161c, trim: 0x16161c }, pants: 0xf0ece4, shoes: 0x16161c,
    }),
    vfx: vfx('shadow', 0xd0102a),
  },

  // ================================================================ MYTHIC
  {
    id: 'instinctgokku', name: 'Instinct Gokku', series: DB, odds: 60_000, rarity: 'mythic', role: 'balanced',
    ability: ab('Silver Instinct', 'shield', 2, 0.7, 'light', 0xdfe8ff),
    look: look({
      skin: SKIN, hair: { style: 'spiky', color: 0xd8dcee }, eyes: 0xc8d0f0, eyeStyle: 'glow',
      top: { style: 'gi', color: ORANGE, color2: GI_BLUE, pattern: 'spots', patternColor: SKIN }, pants: ORANGE, belt: GI_BLUE, shoes: GI_BLUE,
    }),
    vfx: vfx('cosmic', 0xdfe8ff, 0x6ab8ff),
  },
  {
    id: 'goldenfriza', name: 'Golden Friza', series: DB, odds: 80_000, rarity: 'mythic', role: 'striker',
    ability: ab('Golden Death Ball', 'burst', 3, 3.2, 'fire', 0xffd23a),
    look: look({
      skin: 0xffcf3a, hair: { style: 'none', color: 0xffcf3a }, eyes: 0xd02030, eyeStyle: 'sharp',
      top: { style: 'bodysuit', color: 0xffcf3a, color2: 0x8b3bd6, pattern: 'spots', patternColor: 0x8b3bd6 }, pants: 0xffcf3a, shoes: 0xffcf3a,
      markings: ['lines'], markColor: 0x8b3bd6, accessories: ['domeHead', 'tail'], accColor: 0x8b3bd6, accColor2: 0xffcf3a,
    }),
    vfx: vfx('aura', 0xffd23a, 0xfff6c8),
  },
  {
    id: 'brolly', name: 'Brolly', series: DB, odds: 100_000, rarity: 'mythic', role: 'tank',
    ability: ab('Gigantic Rage', 'rage', 2, 1.35, 'fire', 0x6aff4a),
    look: look({
      skin: SKIN_WARM, hair: { style: 'super', color: 0xb0ff6a }, eyes: 0xffffff, eyeStyle: 'glow',
      top: { style: 'bare', color: SKIN_WARM }, pants: WHITE, pantsStyle: 'hakama', belt: 0xd02a2a, shoes: 0xe8c040,
      accessories: ['gauntlets', 'crown'], accColor: 0xe8c040, accColor2: 0xe8c040, scale: 1.35,
    }),
    vfx: vfx('aura', 0x6aff4a, 0xd8ff6a),
  },
  {
    id: 'pein', name: 'Pein', series: NIN, odds: 130_000, rarity: 'mythic', role: 'support',
    ability: ab('Almighty Push', 'pierce', 3, 2.8, 'wind', 0xb07aff),
    look: look({
      skin: SKIN, hair: { style: 'spiky', color: 0xff8a2a }, eyes: 0xb08aff, eyeStyle: 'glow',
      top: { style: 'coat', color: 0x16161c, color2: 0x16161c, trim: 0xd02030, pattern: 'clouds', patternColor: 0xd02030 }, pants: 0x2a2a3a, shoes: 0x2a2a3a,
      markings: ['stitches'], markColor: 0x8a8a92, accessories: ['headband'], accColor: 0x3a3a4a, accColor2: 0xcfd6e0,
    }),
    vfx: vfx('orbit', 0xb07aff, 0xffffff),
  },
  {
    id: 'jiran', name: 'Jiran', series: DB, odds: 170_000, rarity: 'mythic', role: 'tank',
    ability: ab('Power Impact', 'burst', 3, 3, 'punch', 0xff3a3a),
    look: look({
      skin: 0xa8a8b8, hair: { style: 'none', color: 0xa8a8b8 }, eyes: 0x16161c, eyeStyle: 'wide',
      top: { style: 'bodysuit', color: 0xd02a2a, color2: 0x16161c, trim: 0x16161c }, pants: 0x16161c, shoes: 0xd02a2a, gloves: WHITE,
      accessories: ['domeHead'], accColor: 0xb8b8c8, scale: 1.25,
    }),
    vfx: vfx('aura', 0xff3a3a, 0xffffff),
  },
  {
    id: 'meruem', name: 'Meruem', series: HUN, odds: 210_000, rarity: 'mythic', role: 'striker',
    ability: ab('Photon', 'burst', 3, 3, 'light', 0x9aff9a),
    look: look({
      skin: 0x8aa88a, hair: { style: 'none', color: 0x8aa88a }, eyes: 0xd02a2a, eyeStyle: 'glow',
      top: { style: 'bodysuit', color: 0x6a8a6a, color2: 0x2a4a3a, pattern: 'stripes', patternColor: 0x2a4a3a }, pants: 0x6a8a6a, shoes: 0x4a6a4a,
      accessories: ['helmet', 'tail', 'cape'], accColor: 0x6a8a6a, accColor2: 0x2a4a3a, capeColor: 0x2a4a3a,
    }),
    vfx: vfx('shadow', 0x9aff9a),
  },
  {
    id: 'allforwon', name: 'All-For-Won', series: HERO, odds: 260_000, rarity: 'mythic', role: 'support',
    ability: ab('Quirk Theft', 'drain', 1, 0.5, 'dark', 0xa01a2a),
    look: look({
      skin: 0xe8d8d0, hair: { style: 'none', color: 0x16161c }, eyes: 0xa01a2a, eyeStyle: 'hidden',
      top: { style: 'suit', color: 0x16161c, color2: 0x3a3a44, trim: 0x16161c }, pants: 0x16161c, shoes: 0x16161c,
      accessories: ['helmet'], accColor: 0x16161c, accColor2: 0x6a6a72, scale: 1.15,
    }),
    vfx: vfx('shadow', 0xa01a2a, 0x16161c),
  },

  // ================================================================ SECRET
  {
    id: 'vegitto', name: 'Vegitto Blue', series: DB, odds: 400_000, rarity: 'secret', role: 'striker',
    ability: ab('Final Kamehameha', 'pierce', 3, 3.4, 'beam', 0x3ad0ff),
    look: look({
      skin: SKIN, hair: { style: 'super', color: 0x3ab8ff }, eyes: 0x3ab8ff, eyeStyle: 'sharp',
      top: { style: 'gi', color: ORANGE, color2: GI_BLUE }, pants: GI_BLUE, belt: WHITE, shoes: 0x6a3a1a,
      accessories: ['earrings'], accColor: 0xffd23a,
    }),
    vfx: vfx('aura', 0x3ad0ff, 0xffffff),
  },
  {
    id: 'limitlessgojou', name: 'Limitless Gojou', series: CUR, odds: 600_000, rarity: 'secret', role: 'balanced',
    ability: ab('Infinite Void', 'stun', 2, 1, 'light', 0x6ab8ff),
    look: look({
      skin: PALE, hair: { style: 'spiky', color: 0xf4f6fa }, eyes: 0x5ad8ff, eyeStyle: 'glow',
      top: { style: 'uniform', color: 0x16161c, trim: 0x2a2a3a }, pants: 0x16161c, shoes: 0x16161c,
    }),
    vfx: vfx('cosmic', 0x5ad8ff, 0xd070ff),
  },
  {
    id: 'kokushibo', name: 'Kokushibo', series: DEM, odds: 850_000, rarity: 'secret', role: 'assassin',
    ability: ab('Moon Breathing', 'pierce', 2, 2.6, 'slash', 0xb07aff),
    look: look({
      skin: 0xf2d8c8, hair: { style: 'ponytail', color: 0x16161c }, eyes: 0xe8c020, eyeStyle: 'glow',
      top: { style: 'robe', color: 0x5a2a7a, color2: 0x16161c, trim: 0x16161c, pattern: 'checker', patternColor: 0x3a1a52 }, pants: 0x16161c, pantsStyle: 'hakama', shoes: 0x16161c,
      markings: ['tattoo'], markColor: 0xa02a3a, accessories: ['katana'], accColor: 0x9a5aff, accColor2: 0x5a2a7a, scale: 1.1,
    }),
    vfx: vfx('orbit', 0xb07aff, 0xffe07a),
  },
  {
    id: 'kaguya', name: 'Kaguya', series: NIN, odds: 1_200_000, rarity: 'secret', role: 'support',
    ability: ab('All-Killing Ash', 'heal', 2, 0.35, 'light', 0xf4f0ff),
    look: look({
      skin: 0xfbf4f0, hair: { style: 'long', color: 0xf4f0ff }, eyes: 0xb0a0ff, eyeStyle: 'glow',
      top: { style: 'robe', color: 0xf4f0ff, color2: 0xb0a0d0, trim: 0x9a8ad0 }, pants: 0xf4f0ff, shoes: 0xf4f0ff,
      markings: ['foreheadMark'], markColor: 0xd02030, accessories: ['horns'], accColor: 0xf4f0ff, accColor2: 0xd8d0ff,
    }),
    vfx: vfx('cosmic', 0xf4f0ff, 0xb07aff),
  },
  {
    id: 'shadowmonarch', name: 'Shadow Monarch', series: SOLO, odds: 1_700_000, rarity: 'secret', role: 'assassin',
    ability: ab('Monarch Domain', 'rage', 2, 1.4, 'dark', 0x7a4aff),
    look: look({
      skin: PALE, hair: { style: 'messy', color: 0x16161c }, eyes: 0x9a6aff, eyeStyle: 'glow',
      top: { style: 'armor', color: 0x1a1a24, color2: 0x2a2440, trim: 0x7a4aff }, pants: 0x1a1a24, shoes: 0x1a1a24, gloves: 0x1a1a24,
      accessories: ['crown', 'cape', 'dualSwords'], accColor: 0x7a4aff, accColor2: 0x16161c, capeColor: 0x16161c, hatColor2: 0x2a2440,
    }),
    vfx: vfx('shadow', 0x7a4aff, 0x16161c),
  },

  // ================================================================ DIVINE
  {
    id: 'birus', name: 'Birus', series: DB, odds: 2_500_000, rarity: 'divine', role: 'striker',
    ability: ab('Hakai', 'burst', 3, 4.2, 'dark', 0xb05aff),
    look: look({
      skin: 0x9a7ac8, hair: { style: 'none', color: 0x9a7ac8 }, eyes: 0xffe07a, eyeStyle: 'sharp',
      top: { style: 'bare', color: 0x9a7ac8, trim: 0xe8c040, emblem: 0xe8c040 }, pants: 0xe8e4d8, pantsStyle: 'hakama', belt: 0x16161c, shoes: 0xe8c040,
      accessories: ['ears', 'tail'], accColor: 0x9a7ac8, accColor2: 0x6a4a98,
    }),
    vfx: vfx('cosmic', 0xb05aff, 0xff9a3a),
  },
  {
    id: 'egovegita', name: 'Ego Vegita', series: DB, odds: 5_000_000, rarity: 'divine', role: 'striker',
    ability: ab('Hakai Blast', 'rage', 2, 1.45, 'fire', 0xc04aff),
    look: look({
      skin: SKIN, hair: { style: 'flame', color: 0x8a3aff, color2: 0xd08aff }, eyes: 0xd08aff, eyeStyle: 'glow',
      top: { style: 'armor', color: WHITE, color2: 0x1a2a6a, trim: 0xe8c040 }, pants: 0x1a2a6a, shoes: WHITE, gloves: WHITE,
    }),
    vfx: vfx('flames', 0x8a3aff, 0xd08aff),
  },
  {
    id: 'sagenaruta', name: 'Six Paths Naruta', series: NIN, odds: 10_000_000, rarity: 'divine', role: 'balanced',
    ability: ab('Truth-Seeking Orbs', 'pierce', 2, 3.2, 'light', 0xffd23a),
    look: look({
      skin: 0xffcf5a, hair: { style: 'spiky', color: 0xffe07a }, eyes: 0xff8a1a, eyeStyle: 'glow',
      top: { style: 'coat', color: 0xffd23a, color2: 0xff8a1a, trim: 0x16161c, pattern: 'spots', patternColor: 0x16161c }, pants: 0xff8a1a, shoes: 0x16161c,
      markings: ['whiskers'], markColor: 0x16161c, accessories: ['staff'], accColor: 0x16161c,
    }),
    vfx: vfx('orbit', 0x16161c, 0xffd23a),
    obtain: 'cosmic',
  },
  {
    id: 'sungodlufy', name: 'Sun God Lufy', series: PIR, odds: 20_000_000, rarity: 'divine', role: 'balanced',
    ability: ab('Drums of Liberation', 'heal', 2, 0.3, 'light', 0xffffff),
    look: look({
      skin: SKIN, hair: { style: 'messy', color: 0xffffff }, eyes: 0xff4a4a, eyeStyle: 'wide',
      top: { style: 'vest', color: 0xffffff, color2: SKIN, trim: 0xffffff }, pants: 0xffffff, pantsStyle: 'shorts', belt: 0xffe07a, shoes: 0xffffff,
      accessories: ['scarf'], accColor: 0xffffff,
    }),
    vfx: vfx('cosmic', 0xffffff, 0xffe07a),
  },
];

/** Fast lookups. */
const BY_ID = new Map<string, CharacterDef>(CHARACTERS.map((character) => [character.id, character]));
const INDEX = new Map<string, number>(CHARACTERS.map((character, index) => [character.id, index]));

export const characterById = (id: string): CharacterDef | undefined => BY_ID.get(id);

export const isCharacterId = (id: unknown): id is string => typeof id === 'string' && BY_ID.has(id);

/** The pool index of a character, or -1. */
export const characterIndex = (id: string): number => INDEX.get(id) ?? -1;

/** The pool, rarest first: the order the roll tests characters in. */
export const CHARACTERS_RAREST_FIRST: readonly CharacterDef[] = [...CHARACTERS].sort((a, b) => b.odds - a.odds);
