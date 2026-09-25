/**
 * RARITY TIERS. Pure data: every system that cares about rarity (roll odds
 * banding, auto-sell, card borders, stand effects, obtain animations) reads
 * this table and nothing else.
 *
 * `index` is the tier's rank (0 = most common) and doubles as its bit in the
 * auto-sell mask, so the order here is part of the save format: append new
 * tiers at the END, never insert.
 */
export type RarityId = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'secret' | 'divine';

/** How grand the obtain presentation is. The client maps each to an animation. */
export type ObtainStyle = 'pop' | 'burst' | 'shine' | 'rays' | 'nova' | 'eclipse' | 'cosmic';

export interface RarityDef {
  readonly id: RarityId;
  readonly index: number;
  readonly name: string;
  /** Odds band: a character of this tier is between 1 in `minOdds` and 1 in `maxOdds`. */
  readonly minOdds: number;
  readonly maxOdds: number;
  /** Primary and secondary colours: card border, label, stand ring, glow. */
  readonly color: number;
  readonly color2: number;
  /** 0..1: how much stand VFX this tier gets (ring only .. full column, particles, beam). */
  readonly fxLevel: number;
  /** Default obtain animation for the tier; a character may override it. */
  readonly obtain: ObtainStyle;
  /** Whether the roll strip slows down dramatically / plays a fanfare. */
  readonly fanfare: boolean;
}

export const RARITIES: readonly RarityDef[] = [
  { id: 'common', index: 0, name: 'Common', minOdds: 1, maxOdds: 60, color: 0xd6dde8, color2: 0x8e9ab0, fxLevel: 0, obtain: 'pop', fanfare: false },
  { id: 'uncommon', index: 1, name: 'Uncommon', minOdds: 60, maxOdds: 300, color: 0x5fe37a, color2: 0x1f9e46, fxLevel: 0.15, obtain: 'burst', fanfare: false },
  { id: 'rare', index: 2, name: 'Rare', minOdds: 300, maxOdds: 1_500, color: 0x3fb2ff, color2: 0x1a5fd6, fxLevel: 0.3, obtain: 'shine', fanfare: false },
  { id: 'epic', index: 3, name: 'Epic', minOdds: 1_500, maxOdds: 8_000, color: 0xbb6bff, color2: 0x6a23d9, fxLevel: 0.45, obtain: 'rays', fanfare: true },
  { id: 'legendary', index: 4, name: 'Legendary', minOdds: 8_000, maxOdds: 50_000, color: 0xffc233, color2: 0xff7a00, fxLevel: 0.6, obtain: 'nova', fanfare: true },
  { id: 'mythic', index: 5, name: 'Mythic', minOdds: 50_000, maxOdds: 300_000, color: 0xff3d6e, color2: 0xb3003a, fxLevel: 0.75, obtain: 'nova', fanfare: true },
  { id: 'secret', index: 6, name: 'Secret', minOdds: 300_000, maxOdds: 2_000_000, color: 0x21f0d0, color2: 0x10111c, fxLevel: 0.9, obtain: 'eclipse', fanfare: true },
  { id: 'divine', index: 7, name: 'Divine', minOdds: 2_000_000, maxOdds: 50_000_000, color: 0xfff6c8, color2: 0xff5ee0, fxLevel: 1, obtain: 'cosmic', fanfare: true },
];

const BY_ID = new Map<RarityId, RarityDef>(RARITIES.map((rarity) => [rarity.id, rarity]));

export const rarityById = (id: RarityId): RarityDef => BY_ID.get(id) ?? RARITIES[0]!;

export const rarityByIndex = (index: number): RarityDef | undefined => RARITIES[index];

/** Every tier's bit set. */
export const ALL_RARITY_BITS = (1 << RARITIES.length) - 1;

/** '#rrggbb' for CSS. */
export const cssColor = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;
