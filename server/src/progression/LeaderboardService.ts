import { LEADERBOARD_SIZE, handleFor } from '@dice/shared';
import type { LeaderEntry, LeaderboardState } from '../rooms/state/GameState.js';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import { profileStore } from './ProfileStore.js';

/** Seconds between rebuilds. A board is not a thing that needs 20 Hz. */
const REFRESH_SECONDS = 3;

interface Candidate {
  readonly handle: string;
  readonly name: string;
  readonly avatarUrl: string;
  readonly rarest: number;
  readonly rolls: number;
  readonly money: number;
  readonly tower: number;
}

/**
 * The four boards north of the tower: Rarest (the best odds ever pulled),
 * Rolls, Money (Cash earned, ever) and Tower (the highest floor cleared).
 *
 * Every figure is the SERVER's, merged from stored profiles and live state,
 * the live figure winning wherever both exist. Rebuilt on a timer, not per tick.
 */
export class LeaderboardService {
  private timer = 0;

  update(delta: number, board: LeaderboardState, live: Iterable<[string, PlayerState]>, playerIds: ReadonlyMap<string, string>): void {
    this.timer -= delta;
    if (this.timer > 0) return;
    this.timer = REFRESH_SECONDS;
    this.rebuild(board, live, playerIds);
  }

  rebuild(board: LeaderboardState, live: Iterable<[string, PlayerState]>, playerIds: ReadonlyMap<string, string>): void {
    const byHandle = new Map<string, Candidate>();

    for (const [id, row] of profileStore.entries()) {
      // A guest whose progress moved into an account ranks as the account now, not twice.
      if (row.migratedTo) continue;
      const handle = handleFor(id);
      byHandle.set(handle, {
        handle,
        name: row.displayName,
        avatarUrl: row.avatarUrl,
        rarest: row.bestOdds,
        rolls: row.totalRolls,
        money: row.lifetimeCash,
        tower: row.towerBest,
      });
    }

    for (const [sessionId, player] of live) {
      const id = playerIds.get(sessionId);
      if (!id) continue;
      const handle = handleFor(id);
      byHandle.set(handle, {
        handle,
        name: player.displayName,
        avatarUrl: player.avatarUrl,
        rarest: player.bestOdds,
        rolls: player.totalRolls,
        money: player.lifetimeCash,
        tower: player.towerBest,
      });
    }

    const all = [...byHandle.values()];
    fill(board.rarest, all, (c) => c.rarest);
    fill(board.rolls, all, (c) => c.rolls);
    fill(board.money, all, (c) => c.money);
    fill(board.tower, all, (c) => c.tower);
  }
}

/** Rank by one field and write the top N into a replicated array, in place. */
const fill = (into: LeaderEntry[], all: readonly Candidate[], pick: (candidate: Candidate) => number): void => {
  const ranked = all
    .filter((candidate) => pick(candidate) > 0)
    .sort((a, b) => pick(b) - pick(a))
    .slice(0, LEADERBOARD_SIZE);

  for (let i = 0; i < LEADERBOARD_SIZE; i += 1) {
    const entry = into[i];
    if (!entry) continue;
    const candidate = ranked[i];
    const handle = candidate ? candidate.handle : '';
    const name = candidate ? candidate.name : '';
    const avatarUrl = candidate ? candidate.avatarUrl : '';
    const value = candidate ? Math.floor(pick(candidate)) : 0;
    if (entry.handle !== handle) entry.handle = handle;
    if (entry.name !== name) entry.name = name;
    if (entry.avatarUrl !== avatarUrl) entry.avatarUrl = avatarUrl;
    if (entry.value !== value) entry.value = value;
  }
};

export const leaderboardService = new LeaderboardService();
