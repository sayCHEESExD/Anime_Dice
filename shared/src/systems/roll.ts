import { CHARACTERS, CHARACTERS_RAREST_FIRST } from '../data/characters.js';
import type { CharacterDef } from '../data/characterTypes.js';
import type { Random } from './rng.js';

/**
 * THE ROLL. Characters are tested from the rarest down: each one is hit with
 * chance min(1, luck / odds), and the first hit wins. Nothing hits -> the most
 * common character. So Luck multiplies every rare chance directly (1 in 9,500
 * at 1x Luck is 1 in 4,750 at 2x), and with enough Luck the weakest commons
 * stop appearing at all.
 */
export const rollChance = (character: CharacterDef, luck: number): number =>
  Math.min(1, Math.max(0, luck) / Math.max(1, character.odds));

const MOST_COMMON = CHARACTERS_RAREST_FIRST[CHARACTERS_RAREST_FIRST.length - 1]!;

export const rollCharacter = (luck: number, random: Random): CharacterDef => {
  const safeLuck = Number.isFinite(luck) && luck > 0 ? luck : 1;
  for (const character of CHARACTERS_RAREST_FIRST) {
    if (character === MOST_COMMON) break;
    if (random() < rollChance(character, safeLuck)) return character;
  }
  return MOST_COMMON;
};

/**
 * The odds a player effectively has of each character at a Luck, as
 * "1 in N" - what the index shows. Exact for the sequential rule above.
 */
export const effectiveOdds = (luck: number): Map<string, number> => {
  const out = new Map<string, number>();
  let remaining = 1;
  for (const character of CHARACTERS_RAREST_FIRST) {
    const chance = character === MOST_COMMON ? 1 : rollChance(character, luck);
    const p = remaining * chance;
    out.set(character.id, p > 0 ? 1 / p : Number.POSITIVE_INFINITY);
    remaining -= p;
    if (remaining <= 0) remaining = 0;
  }
  return out;
};

/** How many characters exist (for the index). */
export const POOL_SIZE = CHARACTERS.length;
