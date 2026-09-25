import { COMBAT } from '../config/progression.js';
import { TOWER_CURVE, floorDef } from '../config/tower.js';
import { characterById } from '../data/characters.js';
import type { AbilityDef } from '../data/characterTypes.js';
import type { UnitRecord } from '../types/units.js';
import type { Random } from './rng.js';
import { baseAttack, baseHealth, critChance, damageMultiplier, healthMultiplier, roleOf, unitAttack, unitHealth, type UpgradeLevels } from './stats.js';

/**
 * CARD BATTLES, resolved in full.
 *
 * The front card of each side fights the other's front card; the player's side
 * swings first each round. A card at 0 health is out and the next one steps in,
 * until one side has nobody left. Abilities are data (`AbilityDef`): this file
 * knows the seven KINDS and never a character.
 *
 * The server runs it once with a seed and sends the event log; the client plays
 * the log back as card animations. Same function, so what is shown is what
 * happened.
 */

export interface FighterInit {
  readonly charId: string;
  readonly atk: number;
  readonly hp: number;
  readonly crit: number;
  readonly ability?: AbilityDef;
  readonly boss?: boolean;
  /** The unit's uid for the player's side (0 for enemies). */
  readonly uid?: number;
}

/** One action of the fight. Short keys: this crosses the wire. */
export interface BattleEvent {
  /** 'hit' (an attack landed) or 'skip' (a stunned card lost its turn). */
  k: 'hit' | 'skip';
  /** The acting side: 0 = player, 1 = enemy. */
  s: 0 | 1;
  /** Acting card index on its side. */
  a: number;
  /** Target card index on the other side. */
  t: number;
  /** Damage dealt. */
  d: number;
  /** 1 on a critical hit. */
  c?: 1;
  /** The ability's name when this action was one. */
  ab?: string;
  /** Target health after the hit. */
  hp: number;
  /** 1 when the target was knocked out. */
  ko?: 1;
  /** Health the attacker regained (heal / drain), and its health after. */
  heal?: number;
  ahp?: number;
  /** A splash onto the next card of the target side. */
  sp?: { t: number; d: number; hp: number; ko?: 1 };
  /** 1 when the target is stunned by this hit. */
  st?: 1;
  /** 1 when the attacker raised a shield. */
  sh?: 1;
  /** 1 when the attacker's rage grew. */
  rg?: 1;
  /** Fraction of the hit a shield absorbed (0..1). */
  bl?: number;
}

export interface BattleResult {
  readonly victory: boolean;
  readonly events: BattleEvent[];
  readonly player: readonly FighterInit[];
  readonly enemy: readonly FighterInit[];
}

interface Fighter {
  readonly init: FighterInit;
  hp: number;
  readonly maxHp: number;
  atk: number;
  attacks: number;
  shield: number;
  stunned: boolean;
}

const makeFighter = (init: FighterInit): Fighter => ({
  init,
  hp: init.hp,
  maxHp: init.hp,
  atk: init.atk,
  attacks: 0,
  shield: 0,
  stunned: false,
});

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** The player's team as fighters: the units' own stats with the player's upgrades. */
export const teamFighters = (units: readonly UnitRecord[], upgrades: UpgradeLevels): FighterInit[] => {
  const damage = damageMultiplier(upgrades);
  const health = healthMultiplier(upgrades);
  const crit = critChance(upgrades);
  const out: FighterInit[] = [];
  for (const unit of units) {
    const character = characterById(unit.c);
    if (!character) continue;
    const init: FighterInit = {
      charId: unit.c,
      uid: unit.u,
      atk: round2(unitAttack(unit) * damage),
      hp: round2(unitHealth(unit) * health),
      crit,
      ...(character.ability ? { ability: character.ability } : {}),
    };
    out.push(init);
  }
  return out;
};

/** A floor's guards as fighters, scaled by the tower curve. */
export const floorFighters = (floor: number): FighterInit[] => {
  const def = floorDef(floor);
  if (!def) return [];
  const count = def.enemies.length;
  const fewer = Math.pow(4 / Math.max(1, count), TOWER_CURVE.fewerExponent);
  const out: FighterInit[] = [];
  for (const enemy of def.enemies) {
    const character = characterById(enemy.charId);
    if (!character) continue;
    const role = roleOf(character);
    const init: FighterInit = {
      charId: enemy.charId,
      atk: round2(def.strength * fewer * role.atk * (enemy.boss ? TOWER_CURVE.bossAtk : 1)),
      hp: round2(def.strength * fewer * role.hp * (enemy.boss ? TOWER_CURVE.bossHp : 1)),
      crit: COMBAT.baseCrit,
      boss: enemy.boss,
      ...(character.ability ? { ability: character.ability } : {}),
    };
    out.push(init);
  }
  return out;
};

/** A quick strength figure for a list of fighters (sum of atk x hp), for "recommended" labels. */
export const lineupPower = (fighters: readonly FighterInit[]): number => {
  let total = 0;
  for (const f of fighters) total += f.atk * f.hp;
  return total;
};

/** The enemy's figures for display (base stats, used by cards before a fight). */
export const characterBaseStats = (charId: string): { atk: number; hp: number } => {
  const character = characterById(charId);
  return character ? { atk: baseAttack(character), hp: baseHealth(character) } : { atk: 0, hp: 0 };
};

export const simulateBattle = (player: readonly FighterInit[], enemy: readonly FighterInit[], random: Random): BattleResult => {
  const sides: [Fighter[], Fighter[]] = [player.map(makeFighter), enemy.map(makeFighter)];
  const events: BattleEvent[] = [];
  const front: [number, number] = [0, 0];

  const alive = (side: 0 | 1): boolean => front[side] < sides[side].length;

  const act = (side: 0 | 1): void => {
    const other: 0 | 1 = side === 0 ? 1 : 0;
    const attacker = sides[side][front[side]]!;
    const targetIndex = front[other];
    const target = sides[other][targetIndex]!;

    if (attacker.stunned) {
      attacker.stunned = false;
      events.push({ k: 'skip', s: side, a: front[side], t: targetIndex, d: 0, hp: round2(target.hp) });
      return;
    }

    attacker.attacks += 1;
    const ability = attacker.init.ability;
    const triggered = !!ability && ability.kind !== 'drain' && attacker.attacks % Math.max(1, ability.every) === 0;
    const event: BattleEvent = { k: 'hit', s: side, a: front[side], t: targetIndex, d: 0, hp: 0 };

    let multiplier = 1;
    if (triggered && ability) {
      event.ab = ability.name;
      switch (ability.kind) {
        case 'burst':
        case 'pierce':
          multiplier = ability.power;
          break;
        case 'heal': {
          const amount = Math.min(attacker.maxHp - attacker.hp, attacker.maxHp * ability.power);
          attacker.hp += amount;
          event.heal = round2(amount);
          break;
        }
        case 'shield':
          attacker.shield = Math.min(0.9, ability.power);
          event.sh = 1;
          break;
        case 'stun':
          event.st = 1;
          break;
        case 'rage':
          attacker.atk *= ability.power;
          event.rg = 1;
          break;
        default:
          break;
      }
    } else if (ability?.kind === 'drain') {
      // Drain is passive: every attack, named so the card shows it.
      event.ab = ability.name;
    }

    const variance = 1 + (random() * 2 - 1) * COMBAT.variance;
    const crit = random() < attacker.init.crit;
    let damage = attacker.atk * multiplier * variance * (crit ? COMBAT.critMultiplier : 1);
    if (target.shield > 0) {
      event.bl = round2(target.shield);
      damage *= 1 - target.shield;
      target.shield = 0;
    }
    damage = Math.max(0.01, damage);
    target.hp = Math.max(0, target.hp - damage);
    event.d = round2(damage);
    event.hp = round2(target.hp);
    if (crit) event.c = 1;

    if (triggered && ability?.kind === 'stun' && target.hp > 0) target.stunned = true;
    if (ability?.kind === 'drain') {
      const amount = Math.min(attacker.maxHp - attacker.hp, damage * ability.power);
      attacker.hp += amount;
      if (amount > 0) event.heal = round2(amount);
    }
    if (event.heal !== undefined) event.ahp = round2(attacker.hp);

    if (target.hp <= 0) {
      event.ko = 1;
      front[other] += 1;
    }

    // Pierce splashes half of the hit onto the next card in line.
    if (triggered && ability?.kind === 'pierce') {
      const nextIndex = target.hp <= 0 ? front[other] : front[other] + 1;
      const next = sides[other][nextIndex];
      if (next) {
        const splash = damage * 0.5;
        next.hp = Math.max(0, next.hp - splash);
        event.sp = { t: nextIndex, d: round2(splash), hp: round2(next.hp) };
        if (next.hp <= 0) {
          event.sp.ko = 1;
          // Only the front card can be knocked out of the line in order; a splash KO on the
          // second card means it is skipped over when its turn at the front comes.
          if (nextIndex === front[other]) front[other] += 1;
        }
      }
    }
    events.push(event);

    // A splash may have emptied cards now at the front: skip them.
    while (front[other] < sides[other].length && sides[other][front[other]]!.hp <= 0) front[other] += 1;
  };

  while (alive(0) && alive(1) && events.length < COMBAT.maxActions) {
    act(0);
    if (!alive(1)) break;
    act(1);
  }

  return { victory: alive(0) && !alive(1), events, player, enemy };
};
