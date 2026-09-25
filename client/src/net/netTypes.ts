import type { AvatarAppearance, AvatarProportions } from '@dice/shared';
import type { MapSchema } from '@colyseus/schema';

/**
 * Client-side TYPE mirror of the server's Colyseus schema.
 *
 * Types only - colyseus.js builds the concrete schema instances at runtime
 * from the handshake reflection.
 */
export interface NetDisplaySlot {
  charId: string;
  uid: number;
  level: number;
  income: number;
}

export interface NetPlayerState {
  sessionId: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  speed: number;
  grounded: boolean;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  jumpLatched: boolean;
  jumpCount: number;
  lastInputSeq: number;
  ready: boolean;

  avatar: AvatarAppearance & AvatarProportions;
  displayName: string;
  avatarUrl: string;

  plot: number;
  display: ArrayLike<NetDisplaySlot>;

  cash: number;
  lifetimeCash: number;
  cashPerSec: number;
  rebirths: number;
  luck: number;
  totalRolls: number;
  bestOdds: number;
  towerBest: number;
  rollPulse: number;
  playSeconds: number;
}

export interface NetLeaderEntry {
  handle: string;
  name: string;
  avatarUrl: string;
  value: number;
}

export interface NetLeaderboardState {
  rarest: ArrayLike<NetLeaderEntry>;
  rolls: ArrayLike<NetLeaderEntry>;
  money: ArrayLike<NetLeaderEntry>;
}

export interface NetGameState {
  players: MapSchema<NetPlayerState>;
  elapsed: number;
  leaderboard: NetLeaderboardState;
}

/** A leaderboard flattened into plain data, ready to draw. */
export interface LeaderboardSnapshot {
  rarest: readonly NetLeaderEntry[];
  rolls: readonly NetLeaderEntry[];
  money: readonly NetLeaderEntry[];
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
