import { ECONOMY } from '@dice/shared';
import type { PlayerState } from '../rooms/state/PlayerState.js';

/**
 * The ONE place Cash is added or removed.
 *
 * Income ticks, auto-sells, tower wins and Bux grants ADD it (and the lifetime
 * total the Money board ranks); rolls, level-ups, upgrades and rebirths SPEND
 * it (`wallet.spend`, after every other check has passed). A rebirth resets it
 * through `reset`, never by writing the field directly.
 */
export const wallet = {
  add(player: PlayerState, amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    const before = player.cash;
    player.cash = Math.min(ECONOMY.maxCash, before + amount);
    const granted = player.cash - before;
    player.lifetimeCash = Math.min(ECONOMY.maxCash, player.lifetimeCash + granted);
    return granted;
  },

  canAfford(player: PlayerState, cost: number): boolean {
    if (!Number.isFinite(cost) || cost < 0) return false;
    return player.cash >= cost;
  },

  /** Deduct Cash. False and unchanged when the player cannot afford it. */
  spend(player: PlayerState, cost: number): boolean {
    if (!Number.isFinite(cost) || cost < 0) return false;
    if (player.cash < cost) return false;
    player.cash -= cost;
    return true;
  },

  /** A rebirth: back to nothing. Lifetime Cash is kept. */
  reset(player: PlayerState): void {
    player.cash = 0;
  },
};
