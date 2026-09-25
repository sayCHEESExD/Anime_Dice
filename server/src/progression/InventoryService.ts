import {
  DISPLAY_SLOTS,
  TEAM_SIZE,
  UNIT_LEVEL,
  characterById,
  displaySlotRebirths,
  formatCash,
  isDisplaySlotOpen,
  isPotionId,
  levelUpCost,
  potionById,
  potionRoom,
  sellValue,
  unitIncome,
  unitPower,
  type DisplayMessage,
  type LevelUpMessage,
  type LockMessage,
  type SellMessage,
  type TeamMessage,
  type UsePotionMessage,
} from '@dice/shared';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import { economyService } from './EconomyService.js';
import type { PlayerData } from './PlayerData.js';
import { wallet } from './Wallet.js';

/** Most units one sell request may carry. */
const MAX_SELL_BATCH = 1000;

const uidOf = (value: unknown): number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0;

const slotOf = (value: unknown, length: number): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < length ? value : -1;

/**
 * THE INVENTORY: owning, showing, fielding, leveling, selling and potioning
 * units. Every method validates against the server's own records (the unit
 * exists, is yours, the slot is open, you can afford it) and reports back
 * through `data.notify`. The display and the team are two separate lists.
 */
export const inventoryService = {
  // -------------------------------------------------------------- display

  display(player: PlayerState, data: PlayerData, message: DisplayMessage): void {
    switch (message?.action) {
      case 'place':
        this.place(player, data, uidOf(message.uid), message.slot);
        break;
      case 'remove': {
        const uid = uidOf(message.uid);
        const index = data.display.indexOf(uid);
        if (uid > 0 && index >= 0) data.display[index] = 0;
        break;
      }
      case 'best':
        this.displayBest(player, data);
        break;
      case 'clear':
        data.display.fill(0);
        break;
      default:
        return;
    }
    data.privateDirty = true;
    economyService.derive(player, data);
  },

  place(player: PlayerState, data: PlayerData, uid: number, requested: unknown): void {
    const unit = data.units.get(uid);
    if (!unit) return;
    let slot = slotOf(requested, DISPLAY_SLOTS);
    if (slot < 0) {
      slot = data.display.findIndex((current, index) => current === 0 && isDisplaySlotOpen(index, player.rebirths));
      if (slot < 0) {
        data.notify('bad', 'Every open stand is taken - remove a unit or Rebirth for more stands');
        return;
      }
    }
    if (!isDisplaySlotOpen(slot, player.rebirths)) {
      data.notify('bad', `Stand ${slot + 1} unlocks at Rebirth ${displaySlotRebirths(slot)}`);
      return;
    }
    const existing = data.display.indexOf(uid);
    if (existing >= 0) data.display[existing] = 0;
    data.display[slot] = uid;
  },

  /** Put a new unit on the first empty open stand, if there is one. */
  fillEmptyDisplaySlot(player: PlayerState, data: PlayerData, uid: number): boolean {
    const slot = data.display.findIndex((current, index) => current === 0 && isDisplaySlotOpen(index, player.rebirths));
    if (slot < 0) return false;
    data.display[slot] = uid;
    data.privateDirty = true;
    return true;
  },

  /** Auto Equip Best for the plot: the highest earners on every open stand. */
  displayBest(player: PlayerState, data: PlayerData): void {
    const ranked = [...data.units.values()].sort((a, b) => unitIncome(b) - unitIncome(a) || b.u - a.u);
    data.display.fill(0);
    let next = 0;
    for (let slot = 0; slot < DISPLAY_SLOTS; slot += 1) {
      if (!isDisplaySlotOpen(slot, player.rebirths)) continue;
      const unit = ranked[next];
      if (!unit) break;
      data.display[slot] = unit.u;
      next += 1;
    }
  },

  // ----------------------------------------------------------------- team

  team(data: PlayerData, message: TeamMessage): void {
    switch (message?.action) {
      case 'set': {
        const uid = uidOf(message.uid);
        if (!data.units.has(uid)) return;
        let slot = slotOf(message.slot, TEAM_SIZE);
        if (slot < 0) slot = data.team.indexOf(0);
        if (slot < 0) {
          data.notify('bad', 'Your team is full - remove a member first');
          return;
        }
        const existing = data.team.indexOf(uid);
        if (existing >= 0) data.team[existing] = data.team[slot] ?? 0;
        data.team[slot] = uid;
        break;
      }
      case 'remove': {
        const index = data.team.indexOf(uidOf(message.uid));
        if (index >= 0) data.team[index] = 0;
        break;
      }
      case 'best': {
        const ranked = [...data.units.values()].sort((a, b) => unitPower(b) - unitPower(a) || b.u - a.u);
        for (let i = 0; i < TEAM_SIZE; i += 1) data.team[i] = ranked[i]?.u ?? 0;
        break;
      }
      case 'clear':
        data.team.fill(0);
        break;
      default:
        return;
    }
    data.privateDirty = true;
  },

  // ---------------------------------------------------------------- level

  levelUp(player: PlayerState, data: PlayerData, message: LevelUpMessage): void {
    let uid = uidOf(message?.uid);
    if (!uid) {
      const slot = slotOf(message?.slot, DISPLAY_SLOTS);
      if (slot >= 0) uid = data.display[slot] ?? 0;
    }
    const unit = data.units.get(uid);
    if (!unit) return;
    if (unit.l >= UNIT_LEVEL.max) {
      data.notify('info', `${characterById(unit.c)?.name ?? 'This unit'} is at max level`);
      return;
    }
    const cost = levelUpCost(unit);
    if (!wallet.spend(player, cost)) {
      data.notify('bad', `Level up costs ${formatCash(cost)}`);
      return;
    }
    unit.l += 1;
    data.touch(unit.u);
    data.notify('levelup', `${characterById(unit.c)?.name ?? 'Unit'} reached Level ${unit.l}!`);
    economyService.derive(player, data);
  },

  // ----------------------------------------------------------------- sell

  sell(player: PlayerState, data: PlayerData, message: SellMessage): void {
    if (!Array.isArray(message?.uids)) return;
    let total = 0;
    let sold = 0;
    let kept = 0;
    let fromStand = false;
    for (const raw of message.uids.slice(0, MAX_SELL_BATCH)) {
      const uid = uidOf(raw);
      const unit = data.units.get(uid);
      if (!unit) continue;
      // Only the LOCK protects a unit. One on a stand or in the team is taken
      // off it and sold (removeUnit clears both), as the player asked.
      if (unit.k) {
        kept += 1;
        continue;
      }
      if (data.isDisplayed(uid)) fromStand = true;
      total += sellValue(unit);
      data.removeUnit(uid);
      sold += 1;
    }
    if (sold > 0) {
      wallet.add(player, total);
      data.notify('good', `Sold ${sold} unit${sold === 1 ? '' : 's'} for ${formatCash(total)}`);
    }
    // The stand it left is empty now: the public stands and Cash/s follow.
    if (fromStand) economyService.derive(player, data);
    if (kept > 0) data.notify('info', `${kept} locked unit${kept === 1 ? ' was' : 's were'} kept. Unlock to sell.`);
    data.privateDirty = true;
  },

  lock(data: PlayerData, message: LockMessage): void {
    const unit = data.units.get(uidOf(message?.uid));
    if (!unit) return;
    const locked = message.locked === true;
    if (unit.k === locked) return;
    unit.k = locked;
    data.touch(unit.u);
  },

  // --------------------------------------------------------------- potion

  usePotion(player: PlayerState, data: PlayerData, message: UsePotionMessage): void {
    const unit = data.units.get(uidOf(message?.uid));
    const id = message?.potion;
    if (!unit || !isPotionId(id)) return;
    const potion = potionById(id)!;
    const held = data.potions[id] ?? 0;
    if (held <= 0) {
      data.notify('bad', `You have no ${potion.name}s - win them in the Tower`);
      return;
    }
    if (potionRoom(unit, id) <= 0) {
      data.notify('bad', `${characterById(unit.c)?.name ?? 'This unit'} cannot take more ${potion.name}s`);
      return;
    }
    if (held - 1 > 0) data.potions[id] = held - 1;
    else delete data.potions[id];
    if (potion.effect === 'level') unit.l = Math.min(UNIT_LEVEL.max, unit.l + potion.amount);
    else unit.p[id] = (unit.p[id] ?? 0) + 1;
    data.touch(unit.u);
    data.privateDirty = true;
    data.notify('good', `${characterById(unit.c)?.name ?? 'Unit'} drank ${potion.name}!`);
    economyService.derive(player, data);
  },
};
