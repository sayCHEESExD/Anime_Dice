import { Client, Room, ServerError } from '@colyseus/core';
import {
  KILL_Y,
  MAX_PLAYERS_PER_ROOM,
  MessageType,
  PLOT_COUNT,
  RARITIES,
  accountKeyFor,
  characterById,
  isAccountKey,
  isValidGuestId,
  plotSpawn,
  rarityById,
  sanitizeAppearance,
  sanitizeIdentity,
  sanitizeProportions,
  type AuthStateMessage,
  type AuthStatus,
  type DisplayMessage,
  type LevelUpMessage,
  type LockMessage,
  type MoveMessage,
  type RespawnMessage,
  type RespawnReason,
  type RollMessage,
  type SellMessage,
  type SetAuthMessage,
  type SetAutoSellMessage,
  type SetAvatarMessage,
  type SetIdentityMessage,
  type TeamMessage,
  type TowerFightMessage,
  type UpgradeMessage,
  type UsePotionMessage,
} from '@dice/shared';
import { tokenHash, verifyGameToken } from '../auth/BloxityAuth.js';
import { serverConfig } from '../config/serverConfig.js';
import { MovementService } from '../movement/MovementService.js';
import { hasProgress, progressOf, type ProfileFields, type StoredProfile } from '../persistence/index.js';
import { buxGrants } from '../progression/BuxGrants.js';
import { diceService } from '../progression/DiceService.js';
import { economyService } from '../progression/EconomyService.js';
import { inventoryService } from '../progression/InventoryService.js';
import { leaderboardService } from '../progression/LeaderboardService.js';
import { PlayerData } from '../progression/PlayerData.js';
import { profileStore } from '../progression/ProfileStore.js';
import { rebirthService } from '../progression/RebirthService.js';
import { towerService } from '../progression/TowerService.js';
import { upgradeService } from '../progression/UpgradeService.js';
import { wallet } from '../progression/Wallet.js';
import { logger } from '../util/logger.js';
import { GameState } from './state/GameState.js';
import { PlayerState } from './state/PlayerState.js';

const SCOPE = 'GameRoom';

/** Seconds between autosaves of every connected player. */
const AUTOSAVE_SECONDS = 15;
/** Milliseconds between looks for purchases waiting on an account. */
const GRANT_POLL_MS = 15_000;
/** Re-verification backoff for a token Bloxity could not be asked about. */
const REVERIFY_FIRST_MS = 15_000;
const REVERIFY_MAX_MS = 120_000;
/** How long a mid-session switch waits for the leaving profile to land before staying put. */
const SWITCH_SAVE_TIMEOUT_MS = 8000;
/** How long a leave or a dispose waits for its save to land before moving on. */
const LEAVE_SAVE_TIMEOUT_MS = 5000;
/** Longest token accepted. Bloxity's are a few hundred bytes. */
const MAX_TOKEN_LENGTH = 4096;
/** Pulls of this rarity index or better are saved at once, not at the next autosave. */
const SAVE_NOW_RARITY = 3;

/**
 * Which plot the next player gets: spread around the square first, so a
 * half-full room still has neighbours on every side.
 */
const PLOT_ORDER = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15].filter((index) => index < PLOT_COUNT);

/** Join refusals. The client's retry/backoff recognises STORAGE_UNAVAILABLE. */
export const JOIN_ERROR = {
  ROOM_FULL: 4103,
  BAD_PLAYER_ID: 4104,
  STORAGE_UNAVAILABLE: 4105,
} as const;

interface JoinOptions {
  /** The browser's own guest id. NEVER an account id; the prefix is refused. */
  playerId?: string;
  /** The portal's game token, or nothing. Verified with Bloxity, never trusted. */
  token?: string | null;
  avatar?: SetAvatarMessage;
  identity?: SetIdentityMessage;
}

/** What `onAuth` resolves and hands to `onJoin`. */
interface ResolvedProfile {
  readonly key: string;
  readonly guestKey: string;
  readonly accountKey: string | null;
  readonly token: string | null;
  readonly tokenHash: string;
  readonly status: AuthStatus;
  readonly profile: StoredProfile | null;
  readonly migrated: boolean;
}

/** Per-session bookkeeping the replicated state must not carry. */
interface Session {
  key: string;
  guestKey: string;
  accountKey: string | null;
  token: string | null;
  tokenHash: string;
  status: AuthStatus;
  /** True while a login change is being applied: autosaves and grants hold off. */
  switching: boolean;
  queued: SetAuthMessage | null;
  granting: boolean;
  reverifyAt: number;
  reverifyDelay: number;
  grantPollAt: number;
  data: PlayerData;
}

/**
 * The authoritative room.
 *
 * Composition only: movement lives in `MovementService`; the dice, the
 * inventory, income, upgrades, rebirth and the tower in their services under
 * `progression/`. This decides who plays on which profile, which plot they
 * own, and the order things run in. The hard rule: nothing a client sends is
 * ever copied into state - every message is a request the services validate.
 *
 * WHOSE PROGRESS A SESSION PLAYS ON: the client sends its browser id and the
 * portal's TOKEN, Bloxity is asked whose token it is, and the profile is READ
 * FROM STORAGE in `onAuth`. A read that fails refuses the join - a player is
 * never seated on an empty profile that would autosave over their real one.
 */
export class GameRoom extends Room<GameState> {
  override maxClients = MAX_PLAYERS_PER_ROOM;
  override autoDispose = true;

  readonly movement = new MovementService();

  /** Session id -> the profile key it currently plays on. The boards read it. */
  private readonly playerIds = new Map<string, string>();
  private readonly sessions = new Map<string, Session>();

  private autosaveTimer = 0;

  override onCreate(): void {
    this.state = new GameState();
    this.setPatchRate(serverConfig.patchRateMs);

    this.onMessage(MessageType.Move, (client, message: MoveMessage) => this.onMove(client, message));
    this.onMessage(MessageType.RequestRespawn, (client) => this.placeHome(client.sessionId, 'manual'));

    this.handle(MessageType.Roll, (player, data, client, message: RollMessage) => this.onRoll(client, player, data, message));
    this.handle(MessageType.SetAutoSell, (_player, data, _client, message: SetAutoSellMessage) => diceService.setAutoSell(data, message?.mask));
    this.handle(MessageType.Display, (player, data, _client, message: DisplayMessage) => inventoryService.display(player, data, message));
    this.handle(MessageType.Team, (_player, data, _client, message: TeamMessage) => inventoryService.team(data, message));
    this.handle(MessageType.LevelUp, (player, data, client, message: LevelUpMessage) => {
      inventoryService.levelUp(player, data, message);
      this.persist(client.sessionId);
    });
    this.handle(MessageType.Sell, (player, data, client, message: SellMessage) => {
      inventoryService.sell(player, data, message);
      this.persist(client.sessionId);
    });
    this.handle(MessageType.Lock, (_player, data, _client, message: LockMessage) => inventoryService.lock(data, message));
    this.handle(MessageType.UsePotion, (player, data, client, message: UsePotionMessage) => {
      inventoryService.usePotion(player, data, message);
      this.persist(client.sessionId);
    });
    this.handle(MessageType.Upgrade, (player, data, client, message: UpgradeMessage) => {
      upgradeService.buy(player, data, message);
      this.persist(client.sessionId);
    });
    this.handle(MessageType.Rebirth, (player, data, client) => {
      if (rebirthService.rebirth(player, data)) {
        this.persist(client.sessionId);
        leaderboardService.rebuild(this.state.leaderboard, this.state.players, this.playerIds);
      }
    });
    this.handle(MessageType.TowerFight, (player, data, client, message: TowerFightMessage) => {
      const battle = towerService.fight(player, data, message, Date.now());
      if (!battle) return;
      client.send(MessageType.Battle, battle);
      if (battle.victory) this.persist(client.sessionId);
    });

    this.onMessage(MessageType.SetIdentity, (client, message: SetIdentityMessage) => this.onSetIdentity(client, message));
    this.onMessage(MessageType.SetAvatar, (client, message: SetAvatarMessage) => this.onSetAvatar(client, message));
    this.onMessage(MessageType.SetAuth, (client, message: SetAuthMessage) => {
      void this.switchAuth(client, message, false);
    });

    this.setSimulationInterval((deltaMs) => this.tick(deltaMs / 1000), serverConfig.patchRateMs);
    logger.info(SCOPE, `room ${this.roomId} created (capacity ${MAX_PLAYERS_PER_ROOM})`);
  }

  /** A progression request: run it against the sender's state, then tell them what changed. */
  private handle<T>(type: string, run: (player: PlayerState, data: PlayerData, client: Client, message: T) => void): void {
    this.onMessage(type, (client, message: T) => {
      const player = this.state.players.get(client.sessionId);
      const session = this.sessions.get(client.sessionId);
      if (!player || !session || session.switching) return;
      try {
        run(player, session.data, client, message);
      } catch (error) {
        logger.error(SCOPE, `${type} from ${client.sessionId} failed:`, error);
      }
      this.flush(client, player, session.data);
    });
  }

  override async onAuth(client: Client, options: JoinOptions = {}): Promise<ResolvedProfile> {
    if (this.clients.length >= MAX_PLAYERS_PER_ROOM) {
      logger.warn(SCOPE, `refused a join: room ${this.roomId} is full (${this.clients.length}/${MAX_PLAYERS_PER_ROOM})`);
      throw new ServerError(JOIN_ERROR.ROOM_FULL, 'room is full');
    }
    const guestKey = readGuestKey(options.playerId);
    const token = readToken(options.token);
    try {
      return await this.resolveProfile(guestKey, token, null);
    } catch (error) {
      logger.error(SCOPE, `refused a join: storage unreachable for ${client.sessionId}:`, error);
      throw new ServerError(JOIN_ERROR.STORAGE_UNAVAILABLE, 'storage unavailable, try again shortly');
    }
  }

  override onJoin(client: Client, options: JoinOptions = {}, auth?: ResolvedProfile): void {
    const resolved: ResolvedProfile = auth ?? {
      key: '',
      guestKey: '',
      accountKey: null,
      token: null,
      tokenHash: '',
      status: 'guest',
      profile: null,
      migrated: false,
    };

    const player = new PlayerState();
    player.sessionId = client.sessionId;
    player.plot = this.freePlot();
    const data = new PlayerData();
    const now = Date.now();
    this.sessions.set(client.sessionId, {
      key: resolved.key,
      guestKey: resolved.guestKey,
      accountKey: resolved.accountKey,
      token: resolved.token,
      tokenHash: resolved.tokenHash,
      status: resolved.status,
      switching: false,
      queued: null,
      granting: false,
      reverifyAt: now + REVERIFY_FIRST_MS,
      reverifyDelay: REVERIFY_FIRST_MS,
      grantPollAt: now + GRANT_POLL_MS,
      data,
    });
    if (resolved.key) this.playerIds.set(client.sessionId, resolved.key);

    // Restore BEFORE anything derives: every public figure follows from it.
    profileStore.applyTo(player, data, resolved.profile);
    economyService.derive(player, data);
    const spawn = plotSpawn(player.plot);
    player.x = spawn.x;
    player.y = spawn.y;
    player.z = spawn.z;
    player.rotationY = spawn.yaw;
    this.state.players.set(client.sessionId, player);
    this.movement.initialise(player);

    if (options.avatar) this.writeAvatar(player, options.avatar);
    if (options.identity) {
      const identity = sanitizeIdentity(options.identity);
      if (identity.displayName) {
        player.displayName = identity.displayName;
        player.avatarUrl = identity.avatarUrl;
      }
    }

    this.placeHome(client.sessionId, 'join');
    this.sendAuthState(client, resolved.status);
    this.sendInventory(client, player, data);
    if (resolved.accountKey) void this.applyGrants(client.sessionId);

    logger.info(
      SCOPE,
      `join ${client.sessionId} as ${describe(resolved)} (${resolved.profile ? 'restored' : 'new'}) plot=${player.plot} ` +
        `cash=${Math.floor(player.cash)} units=${data.units.size} rebirths=${player.rebirths}`,
    );
  }

  override async onLeave(client: Client): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    const session = this.sessions.get(client.sessionId);

    this.state.players.delete(client.sessionId);
    this.movement.forget(client.sessionId);
    this.sessions.delete(client.sessionId);
    this.playerIds.delete(client.sessionId);

    logger.info(SCOPE, `leave ${client.sessionId}`);
    if (player && session?.key) await this.saveBounded(session.key, player, session.data);
  }

  override async onDispose(): Promise<void> {
    const saves: Promise<void>[] = [];
    for (const [sessionId, player] of this.state.players) {
      const session = this.sessions.get(sessionId);
      if (session?.key) saves.push(this.saveBounded(session.key, player, session.data));
    }
    await Promise.all(saves);
    logger.info(SCOPE, `room ${this.roomId} disposed`);
  }

  /** The first free plot in spread order. */
  private freePlot(): number {
    const taken = new Set<number>();
    for (const player of this.state.players.values()) taken.add(player.plot);
    return PLOT_ORDER.find((index) => !taken.has(index)) ?? 0;
  }

  // ------------------------------------------------------------- identity

  /**
   * WHOSE PROFILE, and the profile itself, read from storage now.
   *
   * With a token, Bloxity is asked. Verified -> the account key; the
   * account's own profile always wins. If the account has none and this
   * browser's guest has real progress, the guest's progress becomes the
   * account's - insert-only, so two pods racing for the same first login
   * create one profile - and the guest is then retired.
   */
  private async resolveProfile(guestKey: string, token: string | null, live: ProfileFields | null): Promise<ResolvedProfile> {
    let status: AuthStatus = 'guest';
    let accountKey: string | null = null;
    const hash = token ? tokenHash(token) : '';
    if (token) {
      const outcome = await verifyGameToken(token);
      if (outcome.status === 'verified') {
        accountKey = accountKeyFor(outcome.accountId);
        status = 'account';
      } else if (outcome.status === 'unavailable') {
        status = 'unavailable';
      }
    }

    if (accountKey) {
      let profile = await profileStore.load(accountKey);
      let migrated = false;
      if (!profile && guestKey) {
        const guest = await profileStore.load(guestKey);
        const retired = Boolean(guest?.migratedTo);
        const source: ProfileFields | null =
          live ??
          (guest ? { ...progressOf(guest), displayName: guest.displayName, avatarUrl: guest.avatarUrl, updatedAt: guest.updatedAt } : null);
        if (!retired && source && hasProgress(source)) {
          const created = { ...source, updatedAt: Date.now(), migratedFrom: guestKey };
          if (await profileStore.insertIfAbsent(accountKey, created)) {
            await profileStore.retireGuest(guestKey, accountKey, progressOf(source), {
              displayName: source.displayName,
              avatarUrl: source.avatarUrl,
            });
            profile = created as StoredProfile;
            migrated = true;
            logger.info(SCOPE, `migrated guest ${guestKey} into ${accountKey} (units=${source.units.length})`);
          } else {
            logger.info(SCOPE, `lost the first-login race for ${accountKey}; loading the winner`);
            profile = await profileStore.load(accountKey);
          }
        }
      }
      return { key: accountKey, guestKey, accountKey, token, tokenHash: hash, status, profile, migrated };
    }

    const profile = guestKey ? await profileStore.load(guestKey) : null;
    return { key: guestKey, guestKey, accountKey: null, token, tokenHash: hash, status, profile, migrated: false };
  }

  /**
   * A LOGIN CHANGE ON THE LIVE SESSION: sign-in, sign-out, account switch, or
   * a re-ask about a token Bloxity was unavailable for. Save the profile being
   * left, resolve the new one, apply it exactly as a join does.
   */
  private async switchAuth(client: Client, message: SetAuthMessage, reverify: boolean): Promise<void> {
    const session = this.sessions.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (!session || !player) return;

    const token = readToken(message?.token);
    if (session.switching) {
      session.queued = { token };
      return;
    }
    const hash = token ? tokenHash(token) : '';
    if (!reverify && hash === session.tokenHash) return;

    session.switching = true;
    try {
      const leavingKey = session.key;
      const wasGuest = session.accountKey === null;
      const live = profileStore.snapshot(player, session.data);

      if (leavingKey) {
        const landed = await withTimeout(profileStore.save(leavingKey, player, session.data), SWITCH_SAVE_TIMEOUT_MS);
        if (!landed) {
          logger.warn(SCOPE, `${client.sessionId}: storage did not take the leaving save; staying on ${leavingKey}`);
          this.sendAuthState(client, session.status, 'storage unavailable; staying on the current profile');
          return;
        }
      }

      let target: ResolvedProfile;
      try {
        target = await this.resolveProfile(session.guestKey, token, wasGuest ? live : null);
      } catch (error) {
        logger.warn(SCOPE, `${client.sessionId}: storage unreachable during a login change; staying put:`, error);
        this.sendAuthState(client, session.status, 'storage unavailable; staying on the current profile');
        return;
      }

      session.token = target.token;
      session.tokenHash = target.tokenHash;
      if (target.status === 'unavailable') {
        session.reverifyDelay = Math.min(REVERIFY_MAX_MS, session.reverifyDelay * 2);
        session.reverifyAt = Date.now() + session.reverifyDelay;
      } else {
        session.reverifyDelay = REVERIFY_FIRST_MS;
      }

      if (target.key === session.key) {
        session.status = target.status;
        this.sendAuthState(client, target.status);
        return;
      }

      // The session now plays on a different profile: a fresh private block.
      const data = new PlayerData();
      profileStore.applyTo(player, data, target.profile, true);
      session.data = data;
      session.key = target.key;
      session.accountKey = target.accountKey;
      session.status = target.status;
      if (target.key) this.playerIds.set(client.sessionId, target.key);
      else this.playerIds.delete(client.sessionId);

      economyService.derive(player, data);
      this.placeHome(client.sessionId, 'join');
      if (target.key) await this.saveBounded(target.key, player, data);
      this.sendAuthState(client, target.status);
      this.sendInventory(client, player, data);
      leaderboardService.rebuild(this.state.leaderboard, this.state.players, this.playerIds);
      logger.info(
        SCOPE,
        `${client.sessionId} switched ${leavingKey || '(none)'} -> ${describe(target)}` +
          `${target.migrated ? ' [migrated]' : ''} units=${data.units.size} cash=${Math.floor(player.cash)}`,
      );
    } finally {
      session.switching = false;
      const queued = session.queued;
      session.queued = null;
      if (queued) void this.switchAuth(client, queued, false);
      else if (session.accountKey) void this.applyGrants(client.sessionId);
    }
  }

  private sendAuthState(client: Client, status: AuthStatus, note?: string): void {
    const message: AuthStateMessage = note ? { status, note } : { status };
    client.send(MessageType.AuthState, message);
  }

  /** The whole private inventory and progression, as on a join. */
  private sendInventory(client: Client, player: PlayerState, data: PlayerData): void {
    data.clearDelta();
    client.send(MessageType.Inventory, { units: data.inventory() });
    this.sendPrivate(client, player, data);
  }

  private sendPrivate(client: Client, player: PlayerState, data: PlayerData): void {
    data.privateDirty = false;
    client.send(
      MessageType.Private,
      data.privateMessage({ totalRolls: player.totalRolls, bestOdds: player.bestOdds, lifetimeCash: player.lifetimeCash }),
    );
  }

  /** Tell a client everything its last request changed: units, the private block, notices. */
  private flush(client: Client, player: PlayerState, data: PlayerData): void {
    const delta = data.drainDelta();
    if (delta) client.send(MessageType.UnitDelta, delta);
    if (data.privateDirty) this.sendPrivate(client, player, data);
    while (data.notices.length > 0) client.send(MessageType.Notice, data.notices.shift());
  }

  private clientOf(sessionId: string): Client | undefined {
    return this.clients.find((client) => client.sessionId === sessionId);
  }

  // ---------------------------------------------------------------- input

  private onMove(client: Client, message: MoveMessage): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (!this.movement.applyInput(client.sessionId, player, message)) return;
    if (player.y < KILL_Y) this.placeHome(client.sessionId, 'fall');
  }

  private onRoll(client: Client, player: PlayerState, data: PlayerData, message: RollMessage): void {
    const rolled = diceService.roll(player, data, message?.auto === true, Date.now());
    if (!rolled) return;
    client.send(MessageType.Rolled, rolled);
    const character = characterById(rolled.charId);
    if (character && rarityById(character.rarity).index >= SAVE_NOW_RARITY) {
      this.persist(client.sessionId);
      const rarity = rarityById(character.rarity);
      if (rarity.index >= RARITIES.length - 4) {
        const who = player.displayName || 'Someone';
        this.broadcast(MessageType.Notice, { kind: 'gold', text: `${who} rolled ${rarity.name} ${character.name}!` }, { except: client });
      }
    }
  }

  // ------------------------------------------------------------- placement

  /** THE one way a player is put back on their plot. */
  private placeHome(sessionId: string, reason: RespawnReason): void {
    const player = this.state.players.get(sessionId);
    if (!player) return;
    const spawn = plotSpawn(player.plot);
    this.movement.teleport(sessionId, player, spawn.x, spawn.y, spawn.z, spawn.yaw);
    const message: RespawnMessage = { x: spawn.x, y: spawn.y, z: spawn.z, rotationY: spawn.yaw, reason };
    this.clientOf(sessionId)?.send(MessageType.Respawn, message);
  }

  // -------------------------------------------------------------- identity

  private onSetAvatar(client: Client, message: SetAvatarMessage): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    this.writeAvatar(player, message);
  }

  private onSetIdentity(client: Client, message: SetIdentityMessage): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const identity = sanitizeIdentity(message);
    if (player.displayName === identity.displayName && player.avatarUrl === identity.avatarUrl) return;
    player.displayName = identity.displayName;
    player.avatarUrl = identity.avatarUrl;
    this.persist(client.sessionId);
    leaderboardService.rebuild(this.state.leaderboard, this.state.players, this.playerIds);
  }

  private writeAvatar(player: PlayerState, message: SetAvatarMessage): void {
    player.avatar.apply(sanitizeAppearance(message?.appearance), sanitizeProportions(message?.proportions));
  }

  // ----------------------------------------------------------------- clock

  private tick(delta: number): void {
    this.state.elapsed += delta;
    for (const [sessionId, player] of this.state.players) {
      this.movement.idle(sessionId, player, delta);
      if (player.y < KILL_Y) this.placeHome(sessionId, 'fall');
      const session = this.sessions.get(sessionId);
      if (!session || session.switching) continue;
      economyService.tick(player, session.data, delta);
      if (player.ready) player.playSeconds += delta;
    }
    leaderboardService.update(delta, this.state.leaderboard, this.state.players, this.playerIds);
    this.tickSessions();

    this.autosaveTimer += delta;
    if (this.autosaveTimer >= AUTOSAVE_SECONDS) {
      this.autosaveTimer = 0;
      for (const sessionId of this.state.players.keys()) this.persist(sessionId);
    }
  }

  /** Re-asks about tokens Bloxity was unavailable for, and polls for purchases. */
  private tickSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (session.switching) continue;
      if (session.status === 'unavailable' && session.token && now >= session.reverifyAt) {
        session.reverifyAt = now + session.reverifyDelay;
        const client = this.clientOf(sessionId);
        if (client) void this.switchAuth(client, { token: session.token }, true);
      }
      if (session.accountKey && now >= session.grantPollAt) {
        session.grantPollAt = now + GRANT_POLL_MS;
        void this.applyGrants(sessionId);
      }
    }
  }

  // ---------------------------------------------------------------- grants

  /**
   * Pay out what the webhook recorded for this account: CLAIM (atomic per
   * grant, so no other pod pays the same one), add the Cash, SAVE the
   * profile, and only then mark the grants applied.
   */
  private async applyGrants(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    const player = this.state.players.get(sessionId);
    if (!session || !player || !session.accountKey || session.switching || session.granting) return;
    const accountKey = session.accountKey;
    session.granting = true;
    try {
      const grants = await buxGrants.claim(accountKey);
      if (grants.length === 0) return;
      if (this.sessions.get(sessionId) !== session || session.accountKey !== accountKey || session.switching) {
        logger.warn(SCOPE, `left ${grants.length} claimed grant(s) for ${accountKey} to a later session`);
        return;
      }
      for (const grant of grants) {
        if (grant.cash > 0) wallet.add(player, grant.cash);
        logger.info(SCOPE, `granted ${grant.sku} to ${sessionId} (+${grant.cash} cash) [${grant.transactionId}]`);
      }
      await profileStore.save(accountKey, player, session.data);
      await buxGrants.settle(grants.map((grant) => grant.transactionId));
    } catch (error) {
      logger.warn(SCOPE, `could not pay grants for ${accountKey}: ${String(error)}`);
    } finally {
      session.granting = false;
    }
  }

  // ----------------------------------------------------------------- saves

  /** A routine save. Held while the session is changing login. */
  private persist(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    const player = this.state.players.get(sessionId);
    if (!session || !player || !session.key || session.switching) return;
    void this.saveQuietly(session.key, player, session.data);
  }

  private async saveQuietly(key: string, player: PlayerState, data: PlayerData): Promise<void> {
    try {
      await profileStore.save(key, player, data);
    } catch (error) {
      logger.error(SCOPE, `save of ${key} failed:`, error);
    }
  }

  /** A save that is waited for only so long; it stays queued and retried regardless. */
  private async saveBounded(key: string, player: PlayerState, data: PlayerData): Promise<void> {
    const landed = await withTimeout(this.saveQuietly(key, player, data), LEAVE_SAVE_TIMEOUT_MS);
    if (!landed) logger.warn(SCOPE, `save of ${key} is queued; it lands when storage is back`);
  }
}

/** A guest key from a join option: valid, or empty when none was sent. Refuses the account prefix. */
const readGuestKey = (raw: unknown): string => {
  if (raw === undefined || raw === null || raw === '') return '';
  if (typeof raw === 'string' && isAccountKey(raw)) {
    logger.warn(SCOPE, `refused a join: browser id carries the account prefix`);
    throw new ServerError(JOIN_ERROR.BAD_PLAYER_ID, 'invalid player id');
  }
  if (!isValidGuestId(raw)) {
    logger.warn(SCOPE, `refused a join: malformed browser id`);
    throw new ServerError(JOIN_ERROR.BAD_PLAYER_ID, 'invalid player id');
  }
  return raw;
};

const readToken = (raw: unknown): string | null =>
  typeof raw === 'string' && raw.length > 0 && raw.length <= MAX_TOKEN_LENGTH ? raw : null;

const describe = (resolved: ResolvedProfile): string => {
  if (resolved.accountKey) return `account ${resolved.accountKey}`;
  const key = resolved.guestKey || '(no id)';
  return resolved.status === 'unavailable' ? `guest ${key} (bloxity unavailable, will re-ask)` : `guest ${key}`;
};

/** True if the promise settled within the deadline; it keeps running either way. */
const withTimeout = (promise: Promise<unknown>, ms: number): Promise<boolean> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    promise.then(
      () => {
        clearTimeout(timer);
        resolve(true);
      },
      () => {
        clearTimeout(timer);
        resolve(false);
      },
    );
  });
