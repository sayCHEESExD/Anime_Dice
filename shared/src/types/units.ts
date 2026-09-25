/**
 * An OWNED unit: one rolled copy of a character. Duplicates are separate
 * units, so each copy can be displayed, teamed, leveled and potioned on its
 * own. This is both the saved shape and the wire shape (short keys: an
 * inventory can hold hundreds of these).
 */
export interface UnitRecord {
  /** Unique per player, never reused. */
  u: number;
  /** Character id. */
  c: string;
  /** Level, 1..UNIT_LEVEL.max. */
  l: number;
  /** Potions drunk into this unit: potion id -> count. */
  p: Record<string, number>;
  /** Locked units are never sold (not by hand, not by auto-sell of duplicates). */
  k: boolean;
}

/** The small private progression, sent whole whenever any of it changes. */
export interface PrivateMessage {
  potions: Record<string, number>;
  upgrades: Record<string, number>;
  /** 4 unit uids (0 = empty). */
  team: number[];
  /** 20 unit uids (0 = empty). Mirrors the public display, by uid. */
  display: number[];
  /** Highest tower floor cleared. */
  towerBest: number;
  towerWins: number;
  /** Bitmask of rarity indices that are auto-sold as they are rolled. */
  autoSell: number;
  /** Character ids ever obtained. */
  discovered: string[];
  /** Unit capacity (from the Unit Storage upgrade). */
  storage: number;
  totalRolls: number;
  bestOdds: number;
  lifetimeCash: number;
}

/** The whole inventory (join, login change). */
export interface InventoryMessage {
  units: UnitRecord[];
}

/** What changed in the inventory. */
export interface UnitDeltaMessage {
  add?: UnitRecord[];
  remove?: number[];
  update?: UnitRecord[];
}
