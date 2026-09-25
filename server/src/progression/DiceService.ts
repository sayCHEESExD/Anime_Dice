import {
  DICE,
  RARITIES,
  formatCash,
  luckMultiplier,
  rarityById,
  rollCharacter,
  rollCooldown,
  rollSpeedFraction,
  sellValue,
  type RolledMessage,
} from '@dice/shared';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import { economyService } from './EconomyService.js';
import { inventoryService } from './InventoryService.js';
import type { PlayerData } from './PlayerData.js';
import { wallet } from './Wallet.js';

/** Rolls accepted slightly early still count: the client's timer and ours drift by a frame or two. */
const COOLDOWN_TOLERANCE = 0.9;

/**
 * THE DICE. A roll is a REQUEST: the server checks the cooldown, the backpack
 * and the wallet, takes the $1, picks the character with the player's own Luck
 * (`systems/roll.ts`), and either keeps the unit or - when its rarity is ticked
 * for auto-sell and it is not a first discovery - sells it on the spot.
 */
export const diceService = {
  roll(player: PlayerState, data: PlayerData, auto: boolean, now: number): RolledMessage | null {
    const cooldownMs = rollCooldown(rollSpeedFraction(data.upgrades)) * 1000 * COOLDOWN_TOLERANCE;
    if (now - data.lastRollAt < cooldownMs) return null;

    if (data.full) {
      data.notify('bad', `Backpack full (${data.units.size}/${data.capacity})! Sell units or upgrade Unit Storage`);
      return null;
    }

    const free = DICE.freeRollWhenBroke && player.cash < DICE.cost && player.cashPerSec <= 0;
    if (!free && !wallet.spend(player, DICE.cost)) {
      data.notify('bad', `A roll costs ${formatCash(DICE.cost)}`);
      return null;
    }
    data.lastRollAt = now;

    const character = rollCharacter(luckMultiplier(player.rebirths, data.upgrades), Math.random);
    player.totalRolls += 1;
    player.rollPulse += 1;
    if (character.odds > player.bestOdds) player.bestOdds = character.odds;

    const discovered = !data.discovered.has(character.id);
    if (discovered) data.discovered.add(character.id);
    data.privateDirty = true;

    const rarity = rarityById(character.rarity);
    const autoSold = !discovered && (data.autoSell & (1 << rarity.index)) !== 0;
    if (autoSold) {
      const value = sellValue({ c: character.id });
      wallet.add(player, value);
      return { charId: character.id, uid: 0, sold: value, discovered, free, auto };
    }

    const unit = { u: data.takeUid(), c: character.id, l: 1, p: {}, k: rarity.index >= RARITIES.length - 3 };
    data.addUnit(unit);
    // A new player's first units go straight onto their stands: nobody should
    // have to find the backpack before their plot starts earning.
    if (inventoryService.fillEmptyDisplaySlot(player, data, unit.u)) economyService.derive(player, data);
    return { charId: character.id, uid: unit.u, sold: 0, discovered, free, auto };
  },

  setAutoSell(data: PlayerData, mask: unknown): void {
    if (typeof mask !== 'number' || !Number.isFinite(mask)) return;
    const next = Math.floor(mask) & ((1 << RARITIES.length) - 1);
    if (next === data.autoSell) return;
    data.autoSell = next;
    data.privateDirty = true;
  },
};
