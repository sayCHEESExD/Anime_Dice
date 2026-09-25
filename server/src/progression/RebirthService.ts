import { REBIRTH, formatCash, formatMultiplier, openDisplaySlots, rebirthCost } from '@dice/shared';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import { economyService } from './EconomyService.js';
import type { PlayerData } from './PlayerData.js';
import { wallet } from './Wallet.js';

/**
 * REBIRTH: pay the ladder's price in Cash, lose ALL Cash, gain a permanent
 * Cash and Luck multiplier and one more display stand.
 *
 * Only Cash resets. Units (with their levels and potions), the display, the
 * team, potions, upgrades and tower progress are untouched - there is no code
 * here that could reach them.
 */
export const rebirthService = {
  rebirth(player: PlayerState, data: PlayerData): boolean {
    if (player.rebirths >= REBIRTH.max) {
      data.notify('info', 'You have reached the final rebirth');
      return false;
    }
    const cost = rebirthCost(player.rebirths);
    if (player.cash < cost) {
      data.notify('bad', `Rebirth needs ${formatCash(cost)}`);
      return false;
    }
    wallet.reset(player);
    player.rebirths += 1;
    economyService.derive(player, data);
    data.privateDirty = true;
    const multiplier = formatMultiplier(1 + REBIRTH.cashPerRebirth * player.rebirths);
    const slots = openDisplaySlots(player.rebirths);
    data.notify('rebirth', `Rebirth ${player.rebirths}! ${multiplier} Cash & Luck - ${slots} stands open`);
    return true;
  },
};
