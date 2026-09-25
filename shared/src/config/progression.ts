import type { RoleId } from '../data/characterTypes.js';

/**
 * THE PROGRESSION CURVE, in one file.
 *
 * Every number that decides how fast a player grows lives here: how a
 * character's odds become income and combat stats, what leveling a unit costs
 * and gives, what selling pays, the rebirth ladder and the upgrade tree. The
 * systems in `systems/` only ever read these tables, so tuning the game is
 * editing this file (and re-running `npm run verify`).
 */

// -------------------------------------------------------------- economy

export const ECONOMY = {
  /** Cash a brand-new player starts with: a handful of first rolls. */
  startingCash: 10,
  /** Income is credited on this period, in seconds (keeps state patches small). */
  incomeTickSeconds: 1,
  /** Hard ceiling on any cash balance. */
  maxCash: 1e33,
} as const;

// ----------------------------------------------------------- stat curve

/**
 * A character's base figures come from its odds (1 in N):
 *
 *   income/s = incomeScale * N ^ incomeExponent   (1 in 6 -> $3/s, 1 in 20 -> $8/s, 1 in 52 -> $17/s)
 *   attack   = N ^ statExponent * role.atk        (1 in 52 -> 9.8)
 *   health   = N ^ statExponent * role.hp
 *
 * so a rarer character is always worth more, and a new row needs no numbers.
 */
export const STAT_CURVE = {
  incomeScale: 0.68,
  incomeExponent: 0.82,
  statScale: 1,
  statExponent: 0.58,
} as const;

/** How a role bends attack and health around the curve. */
export const ROLES: Readonly<Record<RoleId, { readonly name: string; readonly atk: number; readonly hp: number }>> = {
  balanced: { name: 'Balanced', atk: 1, hp: 1 },
  striker: { name: 'Striker', atk: 1.25, hp: 0.85 },
  tank: { name: 'Tank', atk: 0.8, hp: 1.4 },
  assassin: { name: 'Assassin', atk: 1.4, hp: 0.7 },
  support: { name: 'Support', atk: 0.9, hp: 1.15 },
};

// ----------------------------------------------------------- unit level

/**
 * Units level up with Cash, on the green pad in front of their stand or from
 * the backpack. Level L earns base x (1 + incomePerLevel x (L-1)) and fights
 * at base x (1 + statPerLevel x (L-1)). Going L -> L+1 costs
 * base income x costIncomeMultiple x costGrowth^(L-1)   ($8/s unit: $48 for level 2).
 */
export const UNIT_LEVEL = {
  max: 30,
  incomePerLevel: 0.5,
  statPerLevel: 0.08,
  costIncomeMultiple: 6,
  costGrowth: 1.6,
} as const;

// ----------------------------------------------------------------- sell

/** A unit sells for this many seconds of its base income (never less than `minimum`). */
export const SELL = {
  incomeSeconds: 4,
  minimum: 1,
} as const;

// -------------------------------------------------------------- rebirth

export interface RebirthStep {
  /** Cash needed to go from this rebirth to the next. */
  readonly cost: number;
}

/**
 * THE REBIRTH LADDER. Rebirth r -> r+1 costs `REBIRTH.costs[r]` (then x `growth`
 * per step past the table). Being at rebirth r multiplies Cash and Luck by
 * 1 + perRebirth x r, and unlocks display slots (see `display.ts`).
 *
 * A rebirth resets CASH ONLY: units, levels, potions, upgrades, the team and
 * tower progress are all kept.
 */
export const REBIRTH = {
  costs: [
    50_000, 150_000, 450_000, 1_250_000, 3_500_000, 10_000_000, 28_000_000, 80_000_000, 220_000_000, 600_000_000,
    1.6e9, 4.5e9, 1.25e10, 3.5e10, 1e11,
  ] as readonly number[],
  growth: 2.8,
  cashPerRebirth: 0.5,
  luckPerRebirth: 0.5,
  max: 99,
} as const;

// ------------------------------------------------------------- upgrades

export type UpgradeId = 'money' | 'luck' | 'storage' | 'damage' | 'health' | 'rollSpeed' | 'potionLuck' | 'crit';

export interface UpgradeDef {
  readonly id: UpgradeId;
  readonly name: string;
  /** What one level does, for the tooltip ("+10% Cash"). */
  readonly describe: (level: number) => string;
  /** Level 1 price; each later level x `growth`. */
  readonly baseCost: number;
  readonly growth: number;
  /** The effect per level, applied by `systems/stats.ts`. */
  readonly perLevel: number;
  readonly maxLevel: number;
  /** Rebirths needed before the hex is revealed. */
  readonly unlockRebirths: number;
  /** HUD icon (a `/ui/*.png` file or a built-in glyph name). */
  readonly icon: string;
}

const pct = (value: number): string => `${Math.round(value * 1000) / 10}%`;

export const UPGRADES: readonly UpgradeDef[] = [
  {
    id: 'money', name: 'Money', baseCost: 250, growth: 2.1, perLevel: 0.1, maxLevel: 200, unlockRebirths: 0, icon: 'bills',
    describe: (level) => `+${pct(0.1 * level)} Cash`,
  },
  {
    id: 'luck', name: 'Luck', baseCost: 500, growth: 2.2, perLevel: 0.1, maxLevel: 200, unlockRebirths: 0, icon: 'clover',
    describe: (level) => `+${pct(0.1 * level)} Luck`,
  },
  {
    id: 'storage', name: 'Unit Storage', baseCost: 2_500, growth: 2.6, perLevel: 10, maxLevel: 100, unlockRebirths: 0, icon: 'backpack',
    describe: (level) => `+${10 * level} unit slots`,
  },
  {
    id: 'damage', name: 'Damage', baseCost: 1_000, growth: 2.2, perLevel: 0.1, maxLevel: 200, unlockRebirths: 0, icon: 'sword',
    describe: (level) => `+${pct(0.1 * level)} tower damage`,
  },
  {
    id: 'health', name: 'Health', baseCost: 5_000, growth: 2.2, perLevel: 0.1, maxLevel: 200, unlockRebirths: 1, icon: 'heart',
    describe: (level) => `+${pct(0.1 * level)} tower health`,
  },
  {
    id: 'rollSpeed', name: 'Roll Speed', baseCost: 20_000, growth: 3, perLevel: 0.06, maxLevel: 8, unlockRebirths: 2, icon: 'dice',
    describe: (level) => `-${pct(0.06 * level)} roll time`,
  },
  {
    id: 'potionLuck', name: 'Potion Luck', baseCost: 50_000, growth: 2.4, perLevel: 0.1, maxLevel: 50, unlockRebirths: 3, icon: 'potion',
    describe: (level) => `+${pct(0.1 * level)} potion drops`,
  },
  {
    id: 'crit', name: 'Critical', baseCost: 250_000, growth: 2.5, perLevel: 0.02, maxLevel: 15, unlockRebirths: 5, icon: 'star',
    describe: (level) => `+${pct(0.02 * level)} crit chance`,
  },
];

export const UPGRADE_IDS: readonly UpgradeId[] = UPGRADES.map((upgrade) => upgrade.id);

const UPGRADE_BY_ID = new Map<UpgradeId, UpgradeDef>(UPGRADES.map((upgrade) => [upgrade.id, upgrade]));

export const upgradeById = (id: string): UpgradeDef | undefined => UPGRADE_BY_ID.get(id as UpgradeId);

export const isUpgradeId = (id: unknown): id is UpgradeId => typeof id === 'string' && UPGRADE_BY_ID.has(id as UpgradeId);

/** Price of buying level `current + 1`. Infinity at the cap. */
export const upgradeCost = (id: UpgradeId, current: number): number => {
  const def = UPGRADE_BY_ID.get(id);
  if (!def || current >= def.maxLevel) return Number.POSITIVE_INFINITY;
  return Math.round(def.baseCost * Math.pow(def.growth, Math.max(0, current)));
};

// ------------------------------------------------------------- storage

/** Units a player may hold before any Unit Storage upgrade. */
export const BASE_UNIT_STORAGE = 50;

/** Tower battle constants that are not per-floor. */
export const COMBAT = {
  baseCrit: 0.08,
  critMultiplier: 1.75,
  /** Damage varies +-this fraction per hit. */
  variance: 0.1,
  /** A battle longer than this many actions is a defeat (stalemate). */
  maxActions: 400,
} as const;
