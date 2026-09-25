/**
 * THE DISPLAY PLOT and THE TOWER TEAM - two separate lists of unit uids.
 *
 *  - Display slots: up to 20 stands on the player's plot. Displayed units earn
 *    Cash/s and are what other players see. Slots 1-5 are free; slot 6 needs 1
 *    rebirth, slot 7 needs 2 ... slot 20 needs 15.
 *  - Team slots: the 4 units that fight in the Tower. A unit may be on the
 *    display and in the team at the same time - they are different systems.
 */
export const DISPLAY_SLOTS = 20;
export const FREE_DISPLAY_SLOTS = 5;
export const TEAM_SIZE = 4;

/** Rebirths needed to use display slot `index` (0-based). */
export const displaySlotRebirths = (index: number): number => (index < FREE_DISPLAY_SLOTS ? 0 : index - FREE_DISPLAY_SLOTS + 1);

/** How many display slots are open at a rebirth count. */
export const openDisplaySlots = (rebirths: number): number =>
  Math.min(DISPLAY_SLOTS, FREE_DISPLAY_SLOTS + Math.max(0, Math.floor(rebirths)));

export const isDisplaySlotOpen = (index: number, rebirths: number): boolean =>
  index >= 0 && index < DISPLAY_SLOTS && displaySlotRebirths(index) <= rebirths;
