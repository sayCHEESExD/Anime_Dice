/**
 * POTIONS. Won in the Tower, drunk into ONE unit, and kept by that unit for
 * good (they are part of the unit's saved record). Each potion is a row of
 * data: the effect kind is what `systems/stats.ts` understands, the amount and
 * cap are tuning. Add a potion = add a row (and, for a new effect kind, one
 * line in `unitStats`).
 */
export type PotionEffect = 'atk' | 'hp' | 'cash' | 'level';

export interface PotionDef {
  /** Stable id: persisted. Never rename. */
  readonly id: string;
  readonly name: string;
  readonly effect: PotionEffect;
  /** +fraction for atk / hp / cash, whole levels for 'level'. */
  readonly amount: number;
  /** Most of this potion one unit can hold. */
  readonly maxPerUnit: number;
  /** Bottle colours. */
  readonly color: number;
  readonly color2: number;
  /** 1 = small bottle, 2 = large bottle, 3 = crystal. */
  readonly tier: 1 | 2 | 3;
}

export const POTIONS: readonly PotionDef[] = [
  { id: 'atk_s', name: 'Attack Potion', effect: 'atk', amount: 0.1, maxPerUnit: 10, color: 0xff4a4a, color2: 0xb01a2a, tier: 1 },
  { id: 'hp_s', name: 'Health Potion', effect: 'hp', amount: 0.1, maxPerUnit: 10, color: 0x6aff5a, color2: 0x1f9e3a, tier: 1 },
  { id: 'cash_s', name: 'Cash Potion', effect: 'cash', amount: 0.1, maxPerUnit: 10, color: 0xffd23a, color2: 0xd08a10, tier: 1 },
  { id: 'atk_l', name: 'Mega Attack Potion', effect: 'atk', amount: 0.3, maxPerUnit: 5, color: 0xff2a6a, color2: 0x7a0a4a, tier: 2 },
  { id: 'hp_l', name: 'Mega Health Potion', effect: 'hp', amount: 0.3, maxPerUnit: 5, color: 0x3affb0, color2: 0x0a7a5a, tier: 2 },
  { id: 'cash_l', name: 'Mega Cash Potion', effect: 'cash', amount: 0.3, maxPerUnit: 5, color: 0xffb020, color2: 0xa05a00, tier: 2 },
  { id: 'level_gem', name: 'Level Crystal', effect: 'level', amount: 1, maxPerUnit: 99, color: 0xd070ff, color2: 0x6a1ab0, tier: 3 },
];

const BY_ID = new Map<string, PotionDef>(POTIONS.map((potion) => [potion.id, potion]));

export const potionById = (id: string): PotionDef | undefined => BY_ID.get(id);

export const isPotionId = (id: unknown): id is string => typeof id === 'string' && BY_ID.has(id);

export const describePotion = (potion: PotionDef): string => {
  switch (potion.effect) {
    case 'atk':
      return `+${Math.round(potion.amount * 100)}% Attack`;
    case 'hp':
      return `+${Math.round(potion.amount * 100)}% Health`;
    case 'cash':
      return `+${Math.round(potion.amount * 100)}% Cash/s`;
    case 'level':
      return `+${potion.amount} Level`;
  }
};
