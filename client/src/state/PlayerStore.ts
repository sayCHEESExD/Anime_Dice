import {
  DISPLAY_SLOTS,
  TEAM_SIZE,
  type InventoryMessage,
  type PrivateMessage,
  type UnitDeltaMessage,
  type UnitRecord,
} from '@dice/shared';

export interface PublicStats {
  cash: number;
  cashPerSec: number;
  rebirths: number;
  luck: number;
  totalRolls: number;
  bestOdds: number;
}

const emptyPrivate = (): PrivateMessage => ({
  potions: {},
  upgrades: {},
  team: new Array<number>(TEAM_SIZE).fill(0),
  display: new Array<number>(DISPLAY_SLOTS).fill(0),
  towerBest: 0,
  towerWins: 0,
  autoSell: 0,
  discovered: [],
  storage: 50,
  totalRolls: 0,
  bestOdds: 0,
  lifetimeCash: 0,
});

/**
 * THE CLIENT'S COPY of the local player's progression: the private inventory
 * (from `Inventory` / `UnitDelta` messages), the private block (`Private`) and
 * the public figures (replicated state). The client DERIVES NOTHING it acts on:
 * every number here came from the server; the UI only reads it.
 */
export class PlayerStore {
  readonly units = new Map<number, UnitRecord>();
  private privateBlock: PrivateMessage = emptyPrivate();
  readonly stats: PublicStats = { cash: 0, cashPerSec: 0, rebirths: 0, luck: 1, totalRolls: 0, bestOdds: 0 };
  /** Units first seen this session (for the NEW badge). */
  readonly fresh = new Set<number>();
  private readonly listeners = new Set<() => void>();
  private loaded = false;
  /** Bumped on every change, so views can skip identical redraws. */
  version = 0;

  get private(): PrivateMessage {
    return this.privateBlock;
  }

  get ready(): boolean {
    return this.loaded;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  applyInventory(message: InventoryMessage): void {
    this.units.clear();
    this.fresh.clear();
    for (const unit of message.units ?? []) this.units.set(unit.u, unit);
    this.loaded = true;
    this.emit();
  }

  applyDelta(message: UnitDeltaMessage): void {
    for (const unit of message.add ?? []) {
      this.units.set(unit.u, unit);
      this.fresh.add(unit.u);
    }
    for (const uid of message.remove ?? []) {
      this.units.delete(uid);
      this.fresh.delete(uid);
    }
    for (const unit of message.update ?? []) this.units.set(unit.u, unit);
    this.emit();
  }

  applyPrivate(message: PrivateMessage): void {
    this.privateBlock = { ...emptyPrivate(), ...message };
    this.emit();
  }

  /** The public figures; emits only when something the UI shows moved. */
  applyStats(next: PublicStats): void {
    const s = this.stats;
    const changed =
      s.cash !== next.cash ||
      s.cashPerSec !== next.cashPerSec ||
      s.rebirths !== next.rebirths ||
      s.luck !== next.luck ||
      s.totalRolls !== next.totalRolls ||
      s.bestOdds !== next.bestOdds;
    if (!changed) return;
    Object.assign(s, next);
    this.emit();
  }

  isDisplayed(uid: number): boolean {
    return this.privateBlock.display.includes(uid);
  }

  inTeam(uid: number): boolean {
    return this.privateBlock.team.includes(uid);
  }

  get unitCount(): number {
    return this.units.size;
  }

  private emit(): void {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }
}
