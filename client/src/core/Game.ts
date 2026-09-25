import {
  DICE,
  RARITIES,
  TOWER_FLOORS,
  WorldCollision,
  atTowerDoor,
  cashMultiplier,
  characterById,
  formatCash,
  onTowerTerrace,
  padAt,
  rarityById,
  rebirthCost,
  rollSpeedFraction,
  stallAt,
  unitIncome,
  type BattleMessage,
  type NoticeMessage,
  type RespawnMessage,
  type RolledMessage,
} from '@dice/shared';
import { AudioManager } from '../audio/AudioManager.js';
import { PlayerAudio } from '../audio/PlayerAudio.js';
import { AvatarDresser } from '../bloxity/AvatarDresser.js';
import { Bloxity } from '../bloxity/Bloxity.js';
import { lookFromLegion } from '../bloxity/avatarLook.js';
import { identityFromLegion } from '../bloxity/identity.js';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera.js';
import { clientConfig } from '../config/clientConfig.js';
import { InputManager } from '../input/InputManager.js';
import { NetworkClient } from '../net/NetworkClient.js';
import type { ConnectionStatus, NetPlayerState } from '../net/netTypes.js';
import { LocalPlayer } from '../player/LocalPlayer.js';
import { playerModelLoader, type PlayerModelReport } from '../player/PlayerModelLoader.js';
import { RemotePlayerManager } from '../player/RemotePlayerManager.js';
import { RendererManager } from '../rendering/RendererManager.js';
import { SceneManager } from '../rendering/SceneManager.js';
import { PlayerStore } from '../state/PlayerStore.js';
import { BackpackWindow } from '../ui/BackpackWindow.js';
import { BattleView } from '../ui/BattleView.js';
import { BloxityPanel } from '../ui/BloxityPanel.js';
import { CharacterPortraits } from '../ui/CharacterPortraits.js';
import { Hud, type ToastKind } from '../ui/Hud.js';
import { RebirthWindow } from '../ui/RebirthWindow.js';
import { RollView } from '../ui/RollView.js';
import { TowerWindow } from '../ui/TowerWindow.js';
import { UpgradesWindow } from '../ui/UpgradesWindow.js';
import { anyWindowOpen, closeAllWindows } from '../ui/Window.js';
import { anyPanelOpen } from '../ui/Panel.js';
import { logger } from '../util/logger.js';
import { DiceWorld } from '../world/DiceWorld.js';
import { PlotManager } from '../world/PlotManager.js';
import { Sky } from '../world/Sky.js';
import { vfxTime } from '../world/StandVfx.js';

const SCOPE = 'Game';

/** How long to wait for the server's answer to a roll before giving up on it. */
const ROLL_TIMEOUT_MS = 3000;

const shortcutOf = (event: KeyboardEvent): string => {
  const code = event.code;
  if (code.startsWith('Key') && code.length === 4) return code.slice(3).toLowerCase();
  return (code || event.key || '').toLowerCase();
};

const isTyping = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

/**
 * Composition root. Owns every subsystem and the per-frame order - input,
 * prediction, triggers (pads, doors, stalls), camera, network, render - and no
 * gameplay rules: every roll, unit, stat, purchase and battle is the server's.
 */
export class Game {
  private readonly renderer: RendererManager;
  private readonly sceneManager = new SceneManager();
  private readonly camera = new ThirdPersonCamera();
  private readonly input = new InputManager();
  private readonly collision = new WorldCollision();
  private readonly remotePlayers: RemotePlayerManager;
  private readonly sky = new Sky();
  private world!: DiceWorld;
  private readonly plots = new PlotManager();
  private readonly store = new PlayerStore();
  private readonly portraits: CharacterPortraits;
  private readonly hud: Hud;
  private readonly backpack: BackpackWindow;
  private readonly upgrades: UpgradesWindow;
  private readonly rebirth: RebirthWindow;
  private readonly tower: TowerWindow;
  private readonly rolls: RollView;
  private readonly battle: BattleView;
  private readonly audio = new AudioManager();
  private readonly playerAudio: PlayerAudio;
  private readonly bloxity: Bloxity;
  private readonly bloxityPanel: BloxityPanel;
  private readonly fpsReadout: HTMLDivElement;
  private readonly network: NetworkClient;
  private readonly container: HTMLElement;

  private dresser: AvatarDresser | null = null;
  private pendingAvatar: (() => void) | null = null;
  private localPlayer: LocalPlayer | null = null;
  private localSessionId: string | null = null;
  private local: NetPlayerState | null = null;
  private pendingRespawn: RespawnMessage | null = null;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private time = 0;

  private auto = false;
  private awaitingRoll = false;
  private rollTimer = 0;
  private lastCash = -1;
  /** The trigger the player last stood in, so each fires once per visit. */
  private onTrigger = '';
  private unitsChanged = true;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new RendererManager(container);
    this.remotePlayers = new RemotePlayerManager(this.sceneManager.scene);
    this.portraits = new CharacterPortraits(this.renderer.renderer);
    this.playerAudio = new PlayerAudio(this.audio);

    this.network = new NetworkClient({
      onStatusChange: (status) => this.onStatusChange(status),
      onSelfJoined: (sessionId) => {
        this.localSessionId = sessionId;
        this.plots.setLocalSession(sessionId);
        const roomId = this.network.roomId;
        this.bloxity.updateRoom(roomId);
        this.bloxityPanel.setRoom(roomId);
      },
      onPlayerAdded: (sessionId, player) => this.onPlayerState(sessionId, player, true),
      onPlayerChanged: (sessionId, player) => this.onPlayerState(sessionId, player, false),
      onDisplayChanged: (sessionId, player) => this.plots.apply(sessionId, player),
      onPlayerRemoved: (sessionId) => {
        this.remotePlayers.remove(sessionId);
        this.plots.remove(sessionId);
      },
      onRespawn: (message) => {
        this.pendingRespawn = message;
        this.applyPendingRespawn();
      },
      onInventory: (message) => {
        this.store.applyInventory(message);
        this.unitsChanged = true;
      },
      onUnitDelta: (message) => {
        this.store.applyDelta(message);
        this.unitsChanged = true;
        this.hud.backpackBadge.hidden = !this.betterUnitsWaiting();
      },
      onPrivate: (message) => {
        this.store.applyPrivate(message);
        this.hud.backpackBadge.hidden = !this.betterUnitsWaiting();
        this.hud.setAutoSellMask(message.autoSell);
        this.unitsChanged = true;
      },
      onRolled: (message) => void this.onRolled(message),
      onBattle: (message) => void this.onBattle(message),
      onNotice: (message) => this.onNotice(message),
    });

    this.hud = new Hud(container, {
      roll: () => this.requestRoll(false),
      toggleAuto: () => this.setAuto(!this.auto),
      backpack: () => this.toggleWindow(() => this.backpack.show('units')),
      upgrades: () => this.toggleWindow(() => this.upgrades.toggle()),
      rebirth: () => this.toggleWindow(() => this.rebirth.toggle()),
      tower: () => this.toggleWindow(() => this.tower.toggle()),
      index: () => this.toggleWindow(() => this.backpack.show('index')),
      music: () => this.audio.toggleMuted(),
      setAutoSell: (mask) => this.network.setAutoSell(mask),
    });
    this.backpack = new BackpackWindow(container, this.store, this.network, this.portraits);
    this.upgrades = new UpgradesWindow(container, this.store, this.network);
    this.rebirth = new RebirthWindow(container, this.store, this.network);
    this.tower = new TowerWindow(container, this.store, this.network, this.portraits);
    this.tower.onPickSlot = (slot) => this.backpack.pickTeam(slot);
    this.backpack.onTeamPicked = () => this.tower.setOpen(true);
    this.rolls = new RollView(container, this.portraits, {
      tick: () => this.audio.play('tick', 0.8),
      landed: (index, fanfare) => {
        this.audio.play(fanfare ? 'fanfare' : 'reveal', fanfare ? index : 1);
      },
    });
    this.battle = new BattleView(container, this.portraits, {
      sound: (name) => this.audio.play(name),
      music: (battle) => this.audio.setMusic(battle ? 'battle' : 'hub'),
      fight: (floor) => this.network.towerFight(Math.min(TOWER_FLOORS, floor)),
      closed: () => {
        if (this.atTower()) this.tower.setOpen(true);
      },
    });

    this.bloxity = new Bloxity({
      setMasterVolume: (level) => this.audio.setMasterVolume(level),
      setMusicVolume: (level) => this.audio.setMusicVolume(level),
      setGraphicsQuality: (level) => this.renderer.setQuality(level),
      setShowFps: (show) => {
        this.fpsReadout.hidden = !show;
      },
      setCameraSensitivity: (scale) => this.input.look.setSensitivityScale(scale),
      respawn: () => this.network.requestRespawn(),
      pointerLockChanged: (locked) => this.input.look.setCursorFree(!locked),
      avatarChanged: (equipped, proportions) => {
        const look = lookFromLegion(equipped, proportions);
        this.network.sendAvatar(look);
        const apply = (): void => this.dresser?.setLook(look.appearance, look.proportions);
        if (this.dresser) apply();
        else this.pendingAvatar = apply;
      },
    });
    this.fpsReadout = document.createElement('div');
    this.fpsReadout.className = 'aoe-fps aoe-font';
    this.fpsReadout.style.cssText = 'position:fixed;right:8px;top:48px;color:#fff;font:600 12px monospace;z-index:30;text-shadow:0 1px 2px #000';
    this.fpsReadout.hidden = !clientConfig.debug;
    container.appendChild(this.fpsReadout);
    this.bloxityPanel = new BloxityPanel(container, this.bloxity);

    window.addEventListener('keydown', this.onHotkey);
    window.addEventListener('keydown', this.onGesture);
    window.addEventListener('pointerdown', this.onGesture);
    window.addEventListener('touchstart', this.onGesture, { passive: true });
    window.addEventListener('pointerdown', () => this.hud.closePopover());
    this.renderer.onResize((width, height) => this.camera.setViewport(width, height));
    this.camera.setObstruction((ox, oy, oz, dx, dy, dz) => this.collision.raycast(ox, oy, oz, dx, dy, dz));
    this.camera.setFloor((x, y, z) => this.collision.floorBelow(x, y, z, 0));

    this.network.setTokenProvider(() => this.bloxity.getToken());
    this.network.setLookProvider(() => lookFromLegion(this.bloxity.getEquipped(), this.bloxity.getProportions()));
    this.network.setDisplayProvider(() => identityFromLegion(this.bloxity.getUser(), this.bloxity.getGuest()));
    this.bloxity.onUserChanged((user) => {
      this.network.sendAuth(this.bloxity.getToken());
      this.network.sendIdentity(identityFromLegion(user, this.bloxity.getGuest()));
    });
  }

  // ------------------------------------------------------------ lifecycle

  startBloxity(): void {
    this.bloxity.start();
    document.body.classList.toggle('aoe-portal-embedded', this.bloxity.embedded);
  }

  loadingStep(text: string): void {
    this.bloxity.loadingStep(text);
  }

  async initialise(): Promise<PlayerModelReport> {
    const scene = this.sceneManager.scene;
    const report = await playerModelLoader.load();
    this.world = new DiceWorld();
    scene.add(this.sky.root, this.world.root, this.plots.root);
    this.localPlayer = new LocalPlayer(this.collision);
    this.dresser = new AvatarDresser(this.localPlayer.character);
    this.pendingAvatar?.();
    this.pendingAvatar = null;
    scene.add(this.localPlayer.character.root);
    this.camera.snapTo(this.localPlayer.position);
    logger.info(SCOPE, 'world ready');
    return report;
  }

  async connect(): Promise<void> {
    await this.network.connect();
  }

  start(): void {
    this.input.attach(this.renderer.renderer.domElement);
    if (document.body.classList.contains('aoe-touch-mode')) document.body.classList.add('dice-touch');
    this.bloxity.loadingEnd();
    this.bloxity.gameplayStart();
  }

  // ---------------------------------------------------------------- frame

  update(delta: number, _now: number): void {
    this.time += delta;
    vfxTime.value = this.time;
    if (document.body.classList.contains('aoe-touch-mode')) document.body.classList.add('dice-touch');
    this.input.setSuppressed(anyWindowOpen() || anyPanelOpen() || this.battle.active);
    const input = this.input.sample();
    const player = this.localPlayer;
    this.camera.setOrbit(this.input.look.yaw, this.input.look.pitch);
    this.camera.setZoom(this.input.look.zoom);

    if (player) {
      player.update(delta, input, this.input.look.yaw);
      this.snapCameraIfPlaced();
      this.camera.setTarget(player.position);
      this.sceneManager.followShadow(player.position.x, player.position.y, player.position.z);
      for (const message of player.drainOutgoing()) this.network.sendInput(message);
      this.updateTriggers(player);
      this.playerAudio.update(delta, {
        horizontalSpeed: player.horizontalSpeed,
        isGrounded: player.isGrounded,
        jumpedEdge: player.jumpedEdge,
        landedEdge: player.landedEdge,
        riding: player.riding,
      });
    }

    this.updateRollTimeout(delta);
    this.hud.update(delta);
    this.updateHint();
    this.tickFps(delta);
    this.world.scoreboard.update(this.network.leaderboard);
    const px = player?.position.x ?? 0;
    const pz = player?.position.z ?? 0;
    this.sky.follow(px, pz);
    this.sky.update(this.time);
    this.world.update(delta);
    this.plots.setLocal(this.store.units, this.store.stats.cash, this.unitsChanged);
    this.unitsChanged = false;
    this.plots.update(delta, this.camera.camera.position);
    this.remotePlayers.advance(delta, player?.position ?? null);
    this.camera.update(delta, player?.horizontalSpeed ?? 0);
    this.portraits.update();
    this.renderer.renderer.render(this.sceneManager.scene, this.camera.camera);
  }

  // ------------------------------------------------------------------ dice

  private requestRoll(auto: boolean): void {
    this.audio.resume();
    if (this.awaitingRoll || this.rolls.rolling || this.battle.active) return;
    if (!this.network.connected) {
      this.toast('Not connected to the game server', 'bad');
      return;
    }
    const stats = this.store.stats;
    const free = stats.cash < DICE.cost && stats.cashPerSec <= 0;
    if (stats.cash < DICE.cost && !free) {
      this.toast(`Not enough Cash to roll (${formatCash(DICE.cost)})`, 'bad');
      this.audio.play('refuse');
      this.setAuto(false);
      return;
    }
    if (this.store.unitCount >= this.store.private.storage) {
      this.toast('Backpack full! Sell units, set Auto-Sell, or upgrade Unit Storage', 'bad');
      this.audio.play('refuse');
      this.setAuto(false);
      return;
    }
    this.awaitingRoll = true;
    this.rollTimer = 0;
    this.hud.setRolling(true);
    this.audio.play('roll');
    this.network.roll(auto);
  }

  private setAuto(on: boolean): void {
    if (on === this.auto) return;
    this.auto = on;
    this.hud.setAuto(on);
    if (on) this.requestRoll(true);
    else if (!this.rolls.rolling) this.rolls.close();
  }

  private updateRollTimeout(delta: number): void {
    if (!this.awaitingRoll) return;
    this.rollTimer += delta * 1000;
    if (this.rollTimer < ROLL_TIMEOUT_MS) return;
    // The server refused (cooldown, cash, full) or the answer was lost: stand down.
    this.awaitingRoll = false;
    this.hud.setRolling(false);
    if (this.auto) {
      this.rollTimer = 0;
      this.requestRoll(true);
    }
  }

  private async onRolled(message: RolledMessage): Promise<void> {
    this.awaitingRoll = false;
    const character = characterById(message.charId);
    const multiplier = cashMultiplier(this.store.stats.rebirths, this.store.private.upgrades);
    await this.rolls.play(message, rollSpeedFraction(this.store.private.upgrades), multiplier, this.auto);
    this.hud.setRolling(false);
    if (!this.auto) this.rolls.close();
    if (character && rarityById(character.rarity).index >= 4) this.toast(`${rarityById(character.rarity).name} ${character.name}!`, 'gold');
    if (this.auto) {
      // A beat between rolls, so the result registers.
      setTimeout(() => {
        if (this.auto) this.requestRoll(true);
        else this.rolls.close();
      }, 60);
    }
  }

  /** True when an open stand is empty, or a unit off the stands out-earns one on them. */
  private betterUnitsWaiting(): boolean {
    const display = this.store.private.display;
    const shown = new Set(display.filter((uid) => uid > 0));
    const open = Math.min(display.length, 5 + this.store.stats.rebirths);
    if (shown.size < open && this.store.unitCount > shown.size) return true;
    let worst = Number.POSITIVE_INFINITY;
    for (const uid of shown) {
      const unit = this.store.units.get(uid);
      if (unit) worst = Math.min(worst, unitIncome(unit));
    }
    for (const unit of this.store.units.values()) if (!shown.has(unit.u) && unitIncome(unit) > worst) return true;
    return false;
  }

  // ----------------------------------------------------------------- tower

  private atTower(): boolean {
    const p = this.localPlayer?.position;
    return !!p && onTowerTerrace(p.x, p.y, p.z);
  }

  private async onBattle(message: BattleMessage): Promise<void> {
    closeAllWindows();
    this.setAuto(false);
    await this.battle.play(message, () => this.atTower());
  }

  // -------------------------------------------------------------- triggers

  /**
   * PADS, DOORS AND STALLS: standing in one is a REQUEST or opens a window,
   * once per visit. The server re-checks anything that matters (a level-up
   * costs Cash; a fight needs the player at the tower).
   */
  private updateTriggers(player: LocalPlayer): void {
    const p = player.position;
    this.tower.setAtTower(onTowerTerrace(p.x, p.y, p.z));
    let trigger = '';
    const plot = this.plots.ownPlot;
    const pad = plot >= 0 ? padAt(plot, p.x, p.y, p.z) : -1;
    if (pad >= 0 && this.store.private.display[pad]) {
      trigger = `pad:${pad}`;
      if (this.onTrigger !== trigger) {
        this.network.levelUp({ slot: pad });
        this.audio.play('click');
      }
    } else if (atTowerDoor(p.x, p.y, p.z)) {
      trigger = 'tower';
      if (this.onTrigger !== trigger && !this.battle.active) this.tower.setOpen(true);
    } else {
      const stall = stallAt(p.x, p.z);
      if (stall && p.y < 2) {
        trigger = `stall:${stall.id}`;
        if (this.onTrigger !== trigger) {
          if (stall.id === 'upgrades') this.upgrades.setOpen(true);
          else this.backpack.openSell();
        }
      }
    }
    this.onTrigger = trigger;
  }

  // ------------------------------------------------------------------ HUD

  private updateHint(): void {
    if (anyWindowOpen() || this.battle.active || this.rolls.rolling) {
      this.hud.setHint('');
      return;
    }
    const s = this.store;
    const touch = document.body.classList.contains('dice-touch');
    let hint = '';
    if (!this.network.connected) hint = '';
    else if (s.ready && s.unitCount === 0) hint = `Press ROLL${touch ? '' : ' (E)'} to get your first anime characters!`;
    else if (s.stats.cash >= rebirthCost(s.stats.rebirths)) hint = `You can Rebirth! Open Rebirth${touch ? '' : ' (R)'} for more Cash, Luck and stands`;
    else if (s.ready && s.unitCount >= 4 && s.private.towerBest === 0) hint = 'Walk up the escalator to the TOWER in the centre to battle!';
    else if (s.ready && s.unitCount >= s.private.storage) hint = 'Backpack full! Sell units at SELL UNITS or set Auto-Sell';
    this.hud.setHint(hint);
  }

  private onPlayerState(sessionId: string, state: NetPlayerState, added: boolean): void {
    if (sessionId === this.localSessionId) {
      this.applyLocalState(state);
      this.plots.apply(sessionId, state);
      return;
    }
    if (added) {
      this.remotePlayers.add(sessionId, state);
      this.bloxity.playerJoined(sessionId);
      this.bloxity.playerInRoom(sessionId);
    } else {
      this.remotePlayers.update(sessionId, state);
    }
    this.plots.apply(sessionId, state);
  }

  /** Everything the server says about the local player. It derives none of it. */
  private applyLocalState(state: NetPlayerState): void {
    const player = this.localPlayer;
    this.local = state;
    if (player) {
      player.setDisplayName(state.displayName, state.avatarUrl);
      if (state.ready) {
        player.reconcile({
          x: state.x,
          y: state.y,
          z: state.z,
          rotationY: state.rotationY,
          velocityX: state.velocityX,
          velocityY: state.velocityY,
          velocityZ: state.velocityZ,
          grounded: state.grounded,
          jumpLatched: state.jumpLatched,
          jumpCount: state.jumpCount,
          lastInputSeq: state.lastInputSeq,
        });
      }
    }
    const before = this.store.stats.rebirths;
    this.store.applyStats({
      cash: state.cash,
      cashPerSec: state.cashPerSec,
      rebirths: state.rebirths,
      luck: state.luck,
      totalRolls: state.totalRolls,
      bestOdds: state.bestOdds,
    });
    if (this.lastCash >= 0 && state.rebirths > before) this.audio.play('rebirth');
    if (this.lastCash >= 0 && state.cash > this.lastCash + 0.5 && state.cash - this.lastCash > state.cashPerSec * 1.6) {
      this.hud.floater(`+${formatCash(state.cash - this.lastCash)}`);
    }
    this.lastCash = state.cash;
    this.hud.setStats(state.cash, state.cashPerSec, state.luck, state.rebirths);
    this.hud.rebirthTile.setBadge(state.cash >= rebirthCost(state.rebirths) ? '!' : null);
    this.hud.upgradesBadge.hidden = !this.upgrades.affordable;
  }

  private onNotice(message: NoticeMessage): void {
    const kind: ToastKind = message.kind;
    this.toast(message.text, kind);
    switch (message.kind) {
      case 'bad':
        this.audio.play('refuse');
        if (/Backpack full|costs/.test(message.text)) this.setAuto(false);
        break;
      case 'good':
        this.audio.play('buy');
        break;
      case 'levelup':
        this.audio.play('levelup');
        break;
      case 'gold':
        this.audio.play('coin');
        break;
      default:
        break;
    }
  }

  private toast(text: string, kind: ToastKind): void {
    this.hud.toast(text, kind);
  }

  private toggleWindow(open: () => void): void {
    this.audio.resume();
    this.audio.play('click');
    open();
  }

  private readonly onHotkey = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || isTyping(event.target)) return;
    if (this.battle.active) return;
    switch (shortcutOf(event)) {
      case 'e':
      case 'enter':
        this.requestRoll(false);
        break;
      case 'q':
        this.setAuto(!this.auto);
        break;
      case 'b':
        this.toggleWindow(() => (this.backpack.isOpen ? this.backpack.setOpen(false) : this.backpack.show('units')));
        break;
      case 'u':
        this.toggleWindow(() => this.upgrades.toggle());
        break;
      case 'r':
        this.toggleWindow(() => this.rebirth.toggle());
        break;
      case 't':
        this.toggleWindow(() => this.tower.toggle());
        break;
      case 'i':
        this.toggleWindow(() => this.backpack.show('index'));
        break;
      case 'm':
        this.audio.toggleMuted();
        break;
      case 'escape':
        closeAllWindows();
        this.bloxity.showPortalMenu(true);
        break;
      default:
        break;
    }
  };

  private readonly onGesture = (): void => {
    this.audio.resume();
  };

  private tickFps(delta: number): void {
    if (this.fpsReadout.hidden) return;
    this.fpsAccum += delta;
    this.fpsFrames += 1;
    if (this.fpsAccum < 0.5) return;
    this.fpsReadout.textContent = `${Math.round(this.fpsFrames / this.fpsAccum)} FPS`;
    this.fpsAccum = 0;
    this.fpsFrames = 0;
  }

  private applyPendingRespawn(): void {
    const player = this.localPlayer;
    const message = this.pendingRespawn;
    if (!player || !message) return;
    this.pendingRespawn = null;
    player.teleport(message.x, message.y, message.z, message.rotationY);
    this.input.look.setYaw(message.rotationY);
  }

  private snapCameraIfPlaced(): void {
    const player = this.localPlayer;
    if (!player) return;
    const placement = player.consumePlacement();
    if (placement === 'none') return;
    this.camera.snapTo(player.position, placement === 'respawn');
  }

  private onStatusChange(status: ConnectionStatus): void {
    if (clientConfig.debug) logger.info(SCOPE, `connection: ${status}`);
    if (status === 'disconnected' || status === 'error') {
      this.setAuto(false);
      this.toast('Disconnected from the server - reload to rejoin', 'bad');
    }
  }

  /** Debug/verification handle: counts for automated checks. */
  get debugState(): Record<string, unknown> {
    return {
      units: this.store.unitCount,
      cash: this.store.stats.cash,
      cashPerSec: this.store.stats.cashPerSec,
      rebirths: this.store.stats.rebirths,
      plot: this.plots.ownPlot,
      private: this.store.private,
      position: this.localPlayer ? { ...this.localPlayer.position } : null,
      rarities: RARITIES.length,
      players: this.network.players?.size ?? 0,
      connected: this.network.connected,
      local: this.local?.sessionId,
    };
  }

  dispose(): void {
    this.input.detach();
    void this.network.disconnect();
    this.hud.dispose();
    this.backpack.dispose();
    this.upgrades.dispose();
    this.rebirth.dispose();
    this.tower.dispose();
    this.portraits.dispose();
    window.removeEventListener('keydown', this.onHotkey);
    window.removeEventListener('keydown', this.onGesture);
    window.removeEventListener('pointerdown', this.onGesture);
    window.removeEventListener('touchstart', this.onGesture);
    this.bloxity.dispose();
    this.bloxityPanel.dispose();
    this.dresser?.dispose();
    this.fpsReadout.remove();
    this.audio.dispose();
    this.remotePlayers.dispose();
    this.plots.dispose();
    this.world?.dispose();
    this.sky.dispose();
    this.renderer.dispose();
    void this.container;
  }
}
