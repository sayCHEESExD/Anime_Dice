import {
  DISPLAY_SLOTS,
  TEAM_SIZE,
  unitCapacity,
  type NoticeMessage,
  type PrivateMessage,
  type UnitDeltaMessage,
  type UnitRecord,
} from '@dice/shared';

/**
 * A player's PRIVATE progression, held by the server for the session.
 *
 * Not a schema: none of this is broadcast. The owner is sent the whole
 * inventory once (`Inventory`), then only what changed (`UnitDelta`) and the
 * small private block (`Private`) whenever it moves. Public figures derived
 * from it (Cash/s, Luck, the display stands) are written into `PlayerState` by
 * `EconomyService.derive`.
 *
 * Cash and rebirths are NOT here: they live on `PlayerState` (the HUD and the
 * boards read them), written only through `Wallet` and `RebirthService`.
 */
export class PlayerData {
  readonly units = new Map<number, UnitRecord>();
  nextUid = 1;
  readonly display: number[] = new Array<number>(DISPLAY_SLOTS).fill(0);
  readonly team: number[] = new Array<number>(TEAM_SIZE).fill(0);
  potions: Record<string, number> = {};
  upgrades: Record<string, number> = {};
  towerBest = 0;
  towerWins = 0;
  autoSell = 0;
  readonly discovered = new Set<string>();

  // ---- session only
  /** Wall clock (ms) of the last accepted roll. */
  lastRollAt = 0;
  /** Wall clock (ms) until which a battle is still playing back. */
  battleUntil = 0;
  /** Seconds since the last income credit. */
  incomeTimer = 0;

  // ---- what the owner has not been told yet
  private added: UnitRecord[] = [];
  private removed: number[] = [];
  private readonly updated = new Set<number>();
  privateDirty = true;
  readonly notices: NoticeMessage[] = [];

  get capacity(): number {
    return unitCapacity(this.upgrades);
  }

  get full(): boolean {
    return this.units.size >= this.capacity;
  }

  /** Hand out a fresh uid. */
  takeUid(): number {
    const uid = this.nextUid;
    this.nextUid += 1;
    return uid;
  }

  addUnit(unit: UnitRecord): void {
    this.units.set(unit.u, unit);
    this.added.push(unit);
  }

  removeUnit(uid: number): void {
    if (!this.units.delete(uid)) return;
    const pending = this.added.findIndex((unit) => unit.u === uid);
    if (pending >= 0) this.added.splice(pending, 1);
    else this.removed.push(uid);
    this.updated.delete(uid);
    for (let i = 0; i < this.display.length; i += 1) if (this.display[i] === uid) this.display[i] = 0;
    for (let i = 0; i < this.team.length; i += 1) if (this.team[i] === uid) this.team[i] = 0;
  }

  /** Mark a unit changed (level, potions, lock). */
  touch(uid: number): void {
    if (this.added.some((unit) => unit.u === uid)) return;
    this.updated.add(uid);
  }

  isDisplayed(uid: number): boolean {
    return this.display.includes(uid);
  }

  inTeam(uid: number): boolean {
    return this.team.includes(uid);
  }

  notify(kind: NoticeMessage['kind'], text: string): void {
    this.notices.push({ kind, text });
  }

  /** The unit delta since the last call, or null when nothing changed. */
  drainDelta(): UnitDeltaMessage | null {
    if (this.added.length === 0 && this.removed.length === 0 && this.updated.size === 0) return null;
    const delta: UnitDeltaMessage = {};
    if (this.added.length > 0) delta.add = this.added.map(copyUnit);
    if (this.removed.length > 0) delta.remove = [...this.removed];
    if (this.updated.size > 0) {
      const update: UnitRecord[] = [];
      for (const uid of this.updated) {
        const unit = this.units.get(uid);
        if (unit) update.push(copyUnit(unit));
      }
      if (update.length > 0) delta.update = update;
    }
    this.added = [];
    this.removed = [];
    this.updated.clear();
    return delta;
  }

  /** Forget pending deltas (the whole inventory is about to be sent). */
  clearDelta(): void {
    this.added = [];
    this.removed = [];
    this.updated.clear();
  }

  inventory(): UnitRecord[] {
    return [...this.units.values()].map(copyUnit);
  }

  privateMessage(extra: { totalRolls: number; bestOdds: number; lifetimeCash: number }): PrivateMessage {
    return {
      potions: { ...this.potions },
      upgrades: { ...this.upgrades },
      team: [...this.team],
      display: [...this.display],
      towerBest: this.towerBest,
      towerWins: this.towerWins,
      autoSell: this.autoSell,
      discovered: [...this.discovered],
      storage: this.capacity,
      totalRolls: extra.totalRolls,
      bestOdds: extra.bestOdds,
      lifetimeCash: extra.lifetimeCash,
    };
  }
}

export const copyUnit = (unit: UnitRecord): UnitRecord => ({ u: unit.u, c: unit.c, l: unit.l, p: { ...unit.p }, k: unit.k });
