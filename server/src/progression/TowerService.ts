import {
  TOWER_FLOORS,
  TOWER_REWARDS,
  floorDef,
  floorFighters,
  formatCash,
  guaranteedPotionsFor,
  onTowerTerrace,
  potionById,
  potionLuckMultiplier,
  potionPoolFor,
  seededRandom,
  simulateBattle,
  teamFighters,
  weightedPick,
  type BattleMessage,
  type TowerFightMessage,
  type UnitRecord,
} from '@dice/shared';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import { economyService } from './EconomyService.js';
import type { PlayerData } from './PlayerData.js';
import { wallet } from './Wallet.js';

/**
 * The shortest gap between two fights: long enough that a fight cannot be
 * spammed, short enough that a player who skips the playback can go again.
 */
const playbackMs = (events: number): number => Math.min(4000, 900 + events * 60);

/**
 * THE TOWER. A fight is a request for one floor with the current team: the
 * server checks the floor is open and the player is at the tower, resolves the
 * whole battle with the units' real stats (levels, potions, the Damage and
 * Health upgrades), pays a victory, and sends the log for the client to play.
 */
export const towerService = {
  fight(player: PlayerState, data: PlayerData, message: TowerFightMessage, now: number): BattleMessage | null {
    const floor = typeof message?.floor === 'number' && Number.isInteger(message.floor) ? message.floor : 0;
    const def = floorDef(floor);
    if (!def || floor < 1 || floor > TOWER_FLOORS) return null;
    if (floor > data.towerBest + 1) {
      data.notify('bad', `Clear Floor ${data.towerBest + 1} first`);
      return null;
    }
    if (now < data.battleUntil) {
      data.notify('info', 'Your team is catching its breath - try again in a moment');
      return null;
    }
    if (!onTowerTerrace(player.x, player.y, player.z)) {
      data.notify('bad', 'Walk into the Tower to fight');
      return null;
    }
    const units: UnitRecord[] = [];
    for (const uid of data.team) {
      const unit = data.units.get(uid);
      if (unit) units.push(unit);
    }
    if (units.length === 0) {
      data.notify('bad', 'Pick your team first (Equip Best works)');
      return null;
    }

    const player0 = teamFighters(units, data.upgrades);
    const enemy = floorFighters(floor);
    const result = simulateBattle(player0, enemy, seededRandom((Math.random() * 0xffffffff) >>> 0));
    data.battleUntil = now + playbackMs(result.events.length);

    const message0: BattleMessage = {
      floor,
      victory: result.victory,
      firstClear: false,
      player: player0,
      enemy,
      events: result.events,
      cash: 0,
      potions: {},
    };
    if (!result.victory) return message0;

    const firstClear = floor > data.towerBest;
    message0.firstClear = firstClear;
    const cash = def.cash * (firstClear ? TOWER_REWARDS.firstClearCash : 1);
    message0.cash = wallet.add(player, cash);

    const pool = potionPoolFor(floor);
    let drops = guaranteedPotionsFor(floor) + (firstClear ? TOWER_REWARDS.firstClearPotions : 0);
    const bonus = TOWER_REWARDS.bonusChance * potionLuckMultiplier(data.upgrades);
    // Potion Luck past 100% guarantees the bonus and rolls again for the remainder.
    drops += Math.floor(bonus) + (Math.random() < bonus % 1 ? 1 : 0);
    for (let i = 0; i < drops; i += 1) {
      const pick = weightedPick(pool, Math.random);
      if (!pick || !potionById(pick.id)) continue;
      data.potions[pick.id] = (data.potions[pick.id] ?? 0) + 1;
      message0.potions[pick.id] = (message0.potions[pick.id] ?? 0) + 1;
    }

    if (firstClear) data.towerBest = floor;
    data.towerWins += 1;
    data.privateDirty = true;
    economyService.derive(player, data);
    if (firstClear) data.notify('gold', `Floor ${floor} cleared for the first time! +${formatCash(message0.cash)}`);
    return message0;
  },
};
