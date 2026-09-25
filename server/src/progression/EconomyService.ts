import { ECONOMY, cashMultiplier, luckMultiplier, unitIncome, unitLevel } from '@dice/shared';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import type { PlayerData } from './PlayerData.js';
import { wallet } from './Wallet.js';

/**
 * INCOME. Displayed units earn Cash/s; nothing else does.
 *
 * `derive` is the ONE writer of every public figure that follows from the
 * private inventory - Cash/s, Luck and the twenty stand slots other players
 * see - and runs after any change that could move them. `tick` credits the
 * income on a one-second beat (so the replicated Cash changes once a second,
 * not twenty times).
 */
export const economyService = {
  derive(player: PlayerState, data: PlayerData): void {
    const multiplier = cashMultiplier(player.rebirths, data.upgrades);
    let total = 0;
    for (let i = 0; i < data.display.length; i += 1) {
      const slot = player.display[i];
      if (!slot) continue;
      const unit = data.units.get(data.display[i] ?? 0);
      if (!unit) {
        if (slot.uid !== 0) slot.uid = 0;
        if (slot.charId !== '') slot.charId = '';
        if (slot.level !== 0) slot.level = 0;
        if (slot.income !== 0) slot.income = 0;
        continue;
      }
      const income = unitIncome(unit) * multiplier;
      total += income;
      if (slot.uid !== unit.u) slot.uid = unit.u;
      if (slot.charId !== unit.c) slot.charId = unit.c;
      const level = unitLevel(unit);
      if (slot.level !== level) slot.level = level;
      if (slot.income !== income) slot.income = income;
    }
    const perSecond = Math.min(ECONOMY.maxCash, total);
    if (player.cashPerSec !== perSecond) player.cashPerSec = perSecond;
    const luck = luckMultiplier(player.rebirths, data.upgrades);
    if (player.luck !== luck) player.luck = luck;
    if (player.towerBest !== data.towerBest) player.towerBest = data.towerBest;
  },

  /** Credit income. Called every server tick with its delta. */
  tick(player: PlayerState, data: PlayerData, delta: number): void {
    data.incomeTimer += delta;
    if (data.incomeTimer < ECONOMY.incomeTickSeconds) return;
    const seconds = data.incomeTimer;
    data.incomeTimer = 0;
    if (player.cashPerSec > 0) wallet.add(player, player.cashPerSec * seconds);
  },
};
