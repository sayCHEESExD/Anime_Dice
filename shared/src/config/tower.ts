/**
 * THE TOWER. Floors are DATA: which characters guard them (ids from the pool,
 * so every enemy is a recognisable face with its own ability), a difficulty
 * tier, and the rewards. Enemy strength is a curve over the floor number, so a
 * new floor is one row in `FLOOR_LINEUPS` and nothing else.
 *
 * A floor is open when every floor below it has been cleared. Victories pay
 * Cash and potions (`TOWER_REWARDS`); the first clear of a floor pays extra.
 */

export interface TowerTier {
  readonly id: string;
  readonly name: string;
  readonly first: number;
  readonly last: number;
  readonly color: number;
}

export const TOWER_TIERS: readonly TowerTier[] = [
  { id: 'easy', name: 'Easy', first: 1, last: 5, color: 0x5fe37a },
  { id: 'normal', name: 'Normal', first: 6, last: 10, color: 0x3fb2ff },
  { id: 'hard', name: 'Hard', first: 11, last: 15, color: 0xffc233 },
  { id: 'expert', name: 'Expert', first: 16, last: 20, color: 0xff8a2a },
  { id: 'master', name: 'Master', first: 21, last: 25, color: 0xff3d6e },
  { id: 'nightmare', name: 'Nightmare', first: 26, last: 30, color: 0xbb6bff },
  { id: 'hell', name: 'Hell', first: 31, last: 35, color: 0xd0203a },
  { id: 'impossible', name: 'Impossible', first: 36, last: 40, color: 0x21f0d0 },
];

/** Who guards each floor, in fighting order. The LAST enemy of every 5th floor is its boss. */
const FLOOR_LINEUPS: readonly (readonly string[])[] = [
  ['saibaman', 'saibaman'],
  ['saibaman', 'saibaman', 'saibaman'],
  ['saibaman', 'radish'],
  ['saibaman', 'saibaman', 'napa'],
  ['saibaman', 'napa', 'friza'],
  ['zabusa', 'gara'],
  ['zabusa', 'orochimara'],
  ['gara', 'zabusa', 'orochimara'],
  ['zabusa', 'gara', 'sasuka'],
  ['zabusa', 'orochimara', 'sasuka', 'itachy'],
  ['krokodile', 'zolo'],
  ['zolo', 'sanjy', 'krokodile'],
  ['krokodile', 'lufy'],
  ['zolo', 'sanjy', 'krokodile', 'lufy'],
  ['krokodile', 'zolo', 'sanjy', 'shanx'],
  ['grimjow', 'aizan'],
  ['ulquiora', 'grimjow'],
  ['aizan', 'grimjow', 'ulquiora'],
  ['byakua', 'ulquiora', 'grimjow'],
  ['grimjow', 'ulquiora', 'byakua', 'kenpachy'],
  ['akasa', 'akasa'],
  ['hisoko', 'akasa'],
  ['hisoko', 'akasa', 'denjy'],
  ['akasa', 'hisoko', 'sukana'],
  ['akasa', 'hisoko', 'sukana', 'muzen'],
  ['sukana', 'megumo'],
  ['sukana', 'jinwu'],
  ['jinwu', 'sukana', 'gojou'],
  ['meruem', 'jinwu', 'sukana'],
  ['jinwu', 'sukana', 'meruem', 'allforwon'],
  ['pein', 'madra'],
  ['madra', 'pein', 'itachy'],
  ['kaidou', 'whitebread'],
  ['brolly', 'kaidou', 'madra'],
  ['pein', 'madra', 'brolly', 'kaguya'],
  ['goldenfriza', 'jiran'],
  ['jiran', 'brolly', 'goldenfriza'],
  ['kokushibo', 'shadowmonarch', 'jiran'],
  ['vegitto', 'goldenfriza', 'jiran', 'kokushibo'],
  ['jiran', 'goldenfriza', 'shadowmonarch', 'birus'],
];

export const TOWER_FLOORS = FLOOR_LINEUPS.length;

/** Enemy strength curve: a floor's base attack/health. */
export const TOWER_CURVE = {
  base: 2,
  growth: 1.34,
  /** Fewer guards hit harder: each is scaled by (4 / count) ^ this. */
  fewerExponent: 0.35,
  bossHp: 1.8,
  bossAtk: 1.35,
} as const;

export interface PotionDrop {
  readonly id: string;
  /** Relative weight in the floor's pool. */
  readonly weight: number;
}

export const TOWER_REWARDS = {
  /** Cash for a win: cashBase x cashGrowth^(floor-1). */
  cashBase: 40,
  cashGrowth: 1.5,
  /** The first clear of a floor multiplies its Cash and adds a potion. */
  firstClearCash: 3,
  firstClearPotions: 1,
  /** Potions every win pays, plus one more at each threshold. */
  guaranteedPotions: 1,
  extraPotionFloors: [20, 35] as readonly number[],
  /** Chance of one bonus potion (x Potion Luck). */
  bonusChance: 0.25,
  /** Floors from which the mega pool is used. */
  megaFrom: 20,
  pool: [
    { id: 'atk_s', weight: 30 },
    { id: 'hp_s', weight: 30 },
    { id: 'cash_s', weight: 30 },
    { id: 'level_gem', weight: 10 },
  ] as readonly PotionDrop[],
  megaPool: [
    { id: 'atk_s', weight: 20 },
    { id: 'hp_s', weight: 20 },
    { id: 'cash_s', weight: 20 },
    { id: 'atk_l', weight: 10 },
    { id: 'hp_l', weight: 10 },
    { id: 'cash_l', weight: 10 },
    { id: 'level_gem', weight: 10 },
  ] as readonly PotionDrop[],
} as const;

export interface FloorEnemy {
  readonly charId: string;
  readonly boss: boolean;
}

export interface FloorDef {
  readonly floor: number;
  readonly tier: TowerTier;
  readonly enemies: readonly FloorEnemy[];
  /** The floor's base attack / health before role and boss scaling. */
  readonly strength: number;
  readonly cash: number;
  readonly boss: boolean;
}

export const tierOfFloor = (floor: number): TowerTier =>
  TOWER_TIERS.find((tier) => floor >= tier.first && floor <= tier.last) ?? TOWER_TIERS[TOWER_TIERS.length - 1]!;

export const floorStrength = (floor: number): number => TOWER_CURVE.base * Math.pow(TOWER_CURVE.growth, Math.max(0, floor - 1));

export const floorCash = (floor: number): number => Math.round(TOWER_REWARDS.cashBase * Math.pow(TOWER_REWARDS.cashGrowth, Math.max(0, floor - 1)));

export const floorDef = (floor: number): FloorDef | undefined => {
  const lineup = FLOOR_LINEUPS[floor - 1];
  if (!lineup) return undefined;
  const boss = floor % 5 === 0;
  return {
    floor,
    tier: tierOfFloor(floor),
    enemies: lineup.map((charId, index) => ({ charId, boss: boss && index === lineup.length - 1 })),
    strength: floorStrength(floor),
    cash: floorCash(floor),
    boss,
  };
};

export const potionPoolFor = (floor: number): readonly PotionDrop[] =>
  floor >= TOWER_REWARDS.megaFrom ? TOWER_REWARDS.megaPool : TOWER_REWARDS.pool;

export const guaranteedPotionsFor = (floor: number): number =>
  TOWER_REWARDS.guaranteedPotions + TOWER_REWARDS.extraPotionFloors.filter((threshold) => floor >= threshold).length;
