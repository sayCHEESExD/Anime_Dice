import { characterById } from '../data/characters.js';
import type { CharacterDef } from '../data/characterTypes.js';
import { potionById, type PotionEffect } from '../config/potions.js';
import {
  BASE_UNIT_STORAGE,
  COMBAT,
  ECONOMY,
  REBIRTH,
  ROLES,
  SELL,
  STAT_CURVE,
  UNIT_LEVEL,
  UPGRADES,
  type UpgradeId,
} from '../config/progression.js';
import type { UnitRecord } from '../types/units.js';

/**
 * EVERY DERIVED FIGURE, as pure functions of data. The server uses these to
 * pay and to fight; the client uses the very same functions to label cards,
 * so what a player reads is always what the server will do.
 */

const floor1 = (value: number): number => Math.floor(value * 10) / 10;

// ------------------------------------------------------------ character

/** Base Cash/s of a character at level 1 with no potions. */
export const baseIncome = (character: CharacterDef): number =>
  Math.max(1, Math.round(STAT_CURVE.incomeScale * Math.pow(character.odds, STAT_CURVE.incomeExponent) * (character.incomeMul ?? 1)));

/** The rarity curve's combat figure before the role bends it. */
const baseStat = (character: CharacterDef): number =>
  Math.max(1, floor1(STAT_CURVE.statScale * Math.pow(character.odds, STAT_CURVE.statExponent) * (character.statMul ?? 1)));

/** A character's role multipliers. A missing or unknown role falls back to `balanced`. */
export const roleOf = (character: CharacterDef): (typeof ROLES)[keyof typeof ROLES] =>
  (character.role ? ROLES[character.role] : undefined) ?? ROLES.balanced;

export const baseAttack = (character: CharacterDef): number => floor1(baseStat(character) * roleOf(character).atk);

export const baseHealth = (character: CharacterDef): number => floor1(baseStat(character) * roleOf(character).hp);

// ----------------------------------------------------------------- unit

/** Sum of a unit's potion bonuses of one kind. */
export const potionBonus = (unit: Pick<UnitRecord, 'p'>, effect: PotionEffect): number => {
  let total = 0;
  for (const [id, count] of Object.entries(unit.p)) {
    const potion = potionById(id);
    if (potion && potion.effect === effect) total += potion.amount * count;
  }
  return total;
};

export const unitLevel = (unit: Pick<UnitRecord, 'l'>): number => Math.max(1, Math.min(UNIT_LEVEL.max, Math.floor(unit.l)));

export const levelIncomeMultiplier = (level: number): number => 1 + UNIT_LEVEL.incomePerLevel * (level - 1);

export const levelStatMultiplier = (level: number): number => 1 + UNIT_LEVEL.statPerLevel * (level - 1);

/** Cash/s this unit earns on a stand, before the player's Cash multiplier. */
export const unitIncome = (unit: UnitRecord): number => {
  const character = characterById(unit.c);
  if (!character) return 0;
  return baseIncome(character) * levelIncomeMultiplier(unitLevel(unit)) * (1 + potionBonus(unit, 'cash'));
};

/** Attack in the tower, before the player's Damage upgrade. */
export const unitAttack = (unit: UnitRecord): number => {
  const character = characterById(unit.c);
  if (!character) return 0;
  return baseAttack(character) * levelStatMultiplier(unitLevel(unit)) * (1 + potionBonus(unit, 'atk'));
};

/** Health in the tower, before the player's Health upgrade. */
export const unitHealth = (unit: UnitRecord): number => {
  const character = characterById(unit.c);
  if (!character) return 0;
  return baseHealth(character) * levelStatMultiplier(unitLevel(unit)) * (1 + potionBonus(unit, 'hp'));
};

/** How Auto Equip Best ranks a unit for the TEAM. */
export const unitPower = (unit: UnitRecord): number => unitAttack(unit) * unitHealth(unit);

/** Price of the next level, or Infinity at the cap. */
export const levelUpCost = (unit: UnitRecord): number => {
  const character = characterById(unit.c);
  const level = unitLevel(unit);
  if (!character || level >= UNIT_LEVEL.max) return Number.POSITIVE_INFINITY;
  return Math.ceil(baseIncome(character) * UNIT_LEVEL.costIncomeMultiple * Math.pow(UNIT_LEVEL.costGrowth, level - 1));
};

/** What selling the unit pays. */
export const sellValue = (unit: Pick<UnitRecord, 'c'>): number => {
  const character = characterById(unit.c);
  if (!character) return SELL.minimum;
  return Math.max(SELL.minimum, Math.round(baseIncome(character) * SELL.incomeSeconds));
};

/** How many of one potion a unit may still take. */
export const potionRoom = (unit: UnitRecord, potionId: string): number => {
  const potion = potionById(potionId);
  if (!potion) return 0;
  if (potion.effect === 'level') return Math.max(0, UNIT_LEVEL.max - unitLevel(unit));
  return Math.max(0, potion.maxPerUnit - (unit.p[potionId] ?? 0));
};

// ------------------------------------------------------------ upgrades

export type UpgradeLevels = Readonly<Record<string, number>>;

export const upgradeLevel = (upgrades: UpgradeLevels, id: UpgradeId): number => {
  const level = upgrades[id];
  return typeof level === 'number' && Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
};

const perLevel = (id: UpgradeId): number => UPGRADES.find((upgrade) => upgrade.id === id)?.perLevel ?? 0;

const effect = (upgrades: UpgradeLevels, id: UpgradeId): number => upgradeLevel(upgrades, id) * perLevel(id);

/** Everything the player's Cash is multiplied by. */
export const cashMultiplier = (rebirths: number, upgrades: UpgradeLevels): number =>
  (1 + REBIRTH.cashPerRebirth * rebirths) * (1 + effect(upgrades, 'money'));

/** Everything the player's Luck is multiplied by (odds are divided by it). */
export const luckMultiplier = (rebirths: number, upgrades: UpgradeLevels): number =>
  (1 + REBIRTH.luckPerRebirth * rebirths) * (1 + effect(upgrades, 'luck'));

export const unitCapacity = (upgrades: UpgradeLevels): number => BASE_UNIT_STORAGE + Math.round(effect(upgrades, 'storage'));

export const damageMultiplier = (upgrades: UpgradeLevels): number => 1 + effect(upgrades, 'damage');

export const healthMultiplier = (upgrades: UpgradeLevels): number => 1 + effect(upgrades, 'health');

export const critChance = (upgrades: UpgradeLevels): number => COMBAT.baseCrit + effect(upgrades, 'crit');

export const rollSpeedFraction = (upgrades: UpgradeLevels): number => effect(upgrades, 'rollSpeed');

export const potionLuckMultiplier = (upgrades: UpgradeLevels): number => 1 + effect(upgrades, 'potionLuck');

// -------------------------------------------------------------- rebirth

/** Cash needed to go from `rebirths` to the next one (Infinity at the cap). */
export const rebirthCost = (rebirths: number): number => {
  if (rebirths >= REBIRTH.max) return Number.POSITIVE_INFINITY;
  const table = REBIRTH.costs;
  if (rebirths < table.length) return table[rebirths]!;
  const last = table[table.length - 1]!;
  return Math.round(last * Math.pow(REBIRTH.growth, rebirths - table.length + 1));
};

/** Income of a set of displayed units, per second, with the player's multiplier. */
export const displayIncome = (units: readonly UnitRecord[], rebirths: number, upgrades: UpgradeLevels): number => {
  let total = 0;
  for (const unit of units) total += unitIncome(unit);
  return Math.min(ECONOMY.maxCash, total * cashMultiplier(rebirths, upgrades));
};
