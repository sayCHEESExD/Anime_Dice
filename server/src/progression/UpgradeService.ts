import { formatCash, isUpgradeId, roman, upgradeById, upgradeCost, upgradeLevel, type UpgradeMessage } from '@dice/shared';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import { economyService } from './EconomyService.js';
import type { PlayerData } from './PlayerData.js';
import { wallet } from './Wallet.js';

/**
 * PERMANENT UPGRADES. Bought one level at a time with Cash, kept through
 * rebirths. What a level DOES is read by the shared formulas in
 * `systems/stats.ts` (Money -> cash multiplier, Luck -> luck multiplier, Unit
 * Storage -> capacity, Damage -> tower attack, ...), so buying one here only
 * has to bump the number and re-derive.
 */
export const upgradeService = {
  buy(player: PlayerState, data: PlayerData, message: UpgradeMessage): void {
    const id = message?.id;
    if (!isUpgradeId(id)) return;
    const def = upgradeById(id)!;
    if (player.rebirths < def.unlockRebirths) {
      data.notify('bad', `${def.name} unlocks at Rebirth ${def.unlockRebirths}`);
      return;
    }
    const level = upgradeLevel(data.upgrades, id);
    if (level >= def.maxLevel) {
      data.notify('info', `${def.name} is maxed out`);
      return;
    }
    const cost = upgradeCost(id, level);
    if (!wallet.spend(player, cost)) {
      data.notify('bad', `${def.name} ${roman(level + 1)} costs ${formatCash(cost)}`);
      return;
    }
    data.upgrades[id] = level + 1;
    data.privateDirty = true;
    data.notify('good', `${def.name} ${roman(level + 1)}: ${def.describe(level + 1)}`);
    economyService.derive(player, data);
  },
};
