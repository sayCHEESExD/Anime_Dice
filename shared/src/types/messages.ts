import type { AvatarAppearance, AvatarProportions } from './avatar.js';
import type { BattleEvent, FighterInit } from '../systems/battle.js';

/**
 * Client -> server input (MessageType.Move). INPUT ONLY: the server simulates
 * movement from intent and owns the result.
 */
export interface MoveMessage {
  seq: number;
  dt: number;
  moveX: number;
  moveZ: number;
  jump: boolean;
  cameraYaw: number;
}

export type RespawnReason = 'manual' | 'join' | 'fall';

export interface RespawnMessage {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  reason: RespawnReason;
}

// ------------------------------------------------------------------- dice

export interface RollMessage {
  /** True when Auto Spin sent it (only changes the presentation the server echoes). */
  auto?: boolean;
}

export interface RolledMessage {
  charId: string;
  /** The new unit's uid, or 0 when it was auto-sold. */
  uid: number;
  /** Cash paid by an auto-sell (0 when kept). */
  sold: number;
  /** True the first time this character was ever obtained. */
  discovered: boolean;
  /** True when the roll was the free one (nothing displayed, no cash). */
  free: boolean;
  auto: boolean;
}

export interface SetAutoSellMessage {
  mask: number;
}

// -------------------------------------------------------------- inventory

export type DisplayAction = 'place' | 'remove' | 'best' | 'clear';

export interface DisplayMessage {
  action: DisplayAction;
  uid?: number;
  /** Target slot for 'place' (optional: first free open slot when omitted). */
  slot?: number;
}

export type TeamAction = 'set' | 'remove' | 'best' | 'clear';

export interface TeamMessage {
  action: TeamAction;
  uid?: number;
  slot?: number;
}

export interface LevelUpMessage {
  /** Level a unit by uid... */
  uid?: number;
  /** ...or the unit on one of your display slots (the green pad). */
  slot?: number;
}

export interface SellMessage {
  uids: number[];
}

export interface LockMessage {
  uid: number;
  locked: boolean;
}

export interface UsePotionMessage {
  uid: number;
  potion: string;
}

export interface UpgradeMessage {
  id: string;
}

// ------------------------------------------------------------------ tower

export interface TowerFightMessage {
  floor: number;
}

export interface BattleMessage {
  floor: number;
  victory: boolean;
  firstClear: boolean;
  player: FighterInit[];
  enemy: FighterInit[];
  events: BattleEvent[];
  /** What the win paid (empty on a defeat). */
  cash: number;
  potions: Record<string, number>;
}

// ------------------------------------------------------------------- misc

export interface NoticeMessage {
  kind: 'good' | 'bad' | 'info' | 'gold' | 'rebirth' | 'levelup';
  text: string;
}

export interface SetAvatarMessage {
  appearance: AvatarAppearance;
  proportions: AvatarProportions;
}

export interface SetIdentityMessage {
  displayName: string;
  avatarUrl: string;
}

export interface SetAuthMessage {
  token: string | null;
}

export type AuthStatus = 'account' | 'guest' | 'unavailable';

export interface AuthStateMessage {
  status: AuthStatus;
  note?: string;
}
