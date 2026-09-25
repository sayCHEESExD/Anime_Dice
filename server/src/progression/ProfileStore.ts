import { DISPLAY_SLOTS, TEAM_SIZE } from '@dice/shared';
import {
  emptyProgress,
  progressOf,
  storage,
  type BoardRow,
  type MigrationFields,
  type ProfileFields,
  type ProgressFields,
  type StoredProfile,
} from '../persistence/index.js';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import { logger } from '../util/logger.js';
import { copyUnit, PlayerData } from './PlayerData.js';

const SCOPE = 'profiles';

/** How often the leaderboard cache is re-read from storage. */
const CACHE_REFRESH_MS = 30_000;

/**
 * Progression that outlives a session.
 *
 * A thin, PER-KEY front on the storage: a profile is READ FROM STORAGE AT
 * JOIN TIME, never from a cache filled at boot, because several pods share
 * one database. The cache here exists for exactly one reader - the
 * leaderboards - holds only their fields, and is refreshed on a timer with
 * newer `updatedAt` winning.
 */
class ProfileStore {
  private readonly cache = new Map<string, BoardRow>();
  private refreshTimer: NodeJS.Timeout | null = null;

  get kind(): string {
    return storage.kind;
  }

  /** Connect the store and warm the leaderboard cache. Never throws. */
  async open(): Promise<void> {
    await storage.open();
    await this.refresh();
    this.refreshTimer = setInterval(() => void this.refresh(), CACHE_REFRESH_MS);
    this.refreshTimer.unref?.();
  }

  entries(): IterableIterator<[string, BoardRow]> {
    return this.cache.entries();
  }

  /** The profile under a key, read from storage NOW. Throws when storage is unreachable. */
  async load(key: string): Promise<StoredProfile | null> {
    const profile = await storage.get(key);
    if (profile) this.remember(key, profile);
    return profile;
  }

  /** The progression a live session is worth. */
  progress(player: PlayerState, data: PlayerData): ProgressFields {
    return {
      cash: player.cash,
      lifetimeCash: player.lifetimeCash,
      rebirths: player.rebirths,
      totalRolls: player.totalRolls,
      bestOdds: player.bestOdds,
      towerBest: data.towerBest,
      towerWins: data.towerWins,
      autoSell: data.autoSell,
      nextUid: data.nextUid,
      playSeconds: Math.floor(player.playSeconds),
      units: [...data.units.values()].map(copyUnit),
      display: [...data.display],
      team: [...data.team],
      potions: { ...data.potions },
      upgrades: { ...data.upgrades },
      discovered: [...data.discovered],
    };
  }

  /** What a live session is worth on disk: the progression and the identity. */
  snapshot(player: PlayerState, data: PlayerData): ProfileFields {
    return {
      ...this.progress(player, data),
      displayName: player.displayName,
      avatarUrl: player.avatarUrl,
      updatedAt: Date.now(),
    };
  }

  /**
   * Apply a profile onto a session - or the fresh-player defaults when there
   * is none. The caller re-derives the public figures afterwards.
   */
  applyTo(player: PlayerState, data: PlayerData, profile: StoredProfile | null, keepIdentity = false): void {
    const p: ProgressFields = profile ? progressOf(profile) : emptyProgress();
    player.cash = p.cash;
    player.lifetimeCash = Math.max(p.lifetimeCash, 0);
    player.rebirths = p.rebirths;
    player.totalRolls = Math.floor(p.totalRolls);
    player.bestOdds = p.bestOdds;
    player.playSeconds = p.playSeconds;

    data.units.clear();
    for (const unit of p.units) data.units.set(unit.u, copyUnit(unit));
    data.nextUid = p.nextUid;
    for (let i = 0; i < DISPLAY_SLOTS; i += 1) data.display[i] = p.display[i] ?? 0;
    for (let i = 0; i < TEAM_SIZE; i += 1) data.team[i] = p.team[i] ?? 0;
    data.potions = { ...p.potions };
    data.upgrades = { ...p.upgrades };
    data.towerBest = Math.floor(p.towerBest);
    data.towerWins = Math.floor(p.towerWins);
    data.autoSell = p.autoSell;
    data.discovered.clear();
    for (const id of p.discovered) data.discovered.add(id);
    data.clearDelta();
    data.privateDirty = true;

    if (!keepIdentity) {
      player.displayName = profile?.displayName ?? '';
      player.avatarUrl = profile?.avatarUrl ?? '';
    }
  }

  /** Save a live session under a key. Resolves once the write has landed. */
  async save(key: string, player: PlayerState, data: PlayerData, extras?: MigrationFields): Promise<void> {
    const fields = this.snapshot(player, data);
    this.remember(key, { ...fields, ...extras } as StoredProfile);
    await storage.put(key, fields, extras);
  }

  /** Create a profile only if the key is free. Throws when storage is unreachable. */
  async insertIfAbsent(key: string, profile: ProfileFields & MigrationFields): Promise<boolean> {
    const inserted = await storage.insertIfAbsent(key, profile);
    if (inserted) this.remember(key, profile as StoredProfile);
    return inserted;
  }

  /**
   * RETIRE a guest profile whose progress just became an account's: reset its
   * progress, keep what it held as `migratedSnapshot`, and mark where it went.
   */
  async retireGuest(
    guestKey: string,
    accountKey: string,
    snapshot: ProgressFields,
    identity: { displayName: string; avatarUrl: string },
  ): Promise<void> {
    const now = Date.now();
    const fields: ProfileFields = { ...emptyProgress(), ...identity, updatedAt: now };
    const extras: MigrationFields = { migratedTo: accountKey, migratedAt: now, migratedSnapshot: snapshot };
    this.remember(guestKey, { ...fields, ...extras } as StoredProfile);
    await storage.put(guestKey, fields, extras);
  }

  flush(timeoutMs?: number): Promise<boolean> {
    return storage.flush(timeoutMs);
  }

  async close(): Promise<void> {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = null;
    await storage.close();
  }

  private remember(key: string, profile: BoardRow | StoredProfile): void {
    const known = this.cache.get(key);
    if (known && known.updatedAt > profile.updatedAt) return;
    const row: BoardRow = {
      displayName: profile.displayName ?? '',
      avatarUrl: profile.avatarUrl ?? '',
      lifetimeCash: profile.lifetimeCash ?? 0,
      totalRolls: profile.totalRolls ?? 0,
      bestOdds: profile.bestOdds ?? 0,
      towerBest: profile.towerBest ?? 0,
      updatedAt: profile.updatedAt ?? 0,
    };
    if (typeof profile.migratedTo === 'string') row.migratedTo = profile.migratedTo;
    this.cache.set(key, row);
  }

  private async refresh(): Promise<void> {
    try {
      for (const [key, row] of await storage.loadBoards()) this.remember(key, row);
    } catch (error) {
      logger.warn(SCOPE, `leaderboard cache not refreshed: ${String(error)}`);
    }
  }
}

export const profileStore = new ProfileStore();
