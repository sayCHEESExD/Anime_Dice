import {
  DISPLAY_SLOTS,
  PLAYER_HEIGHT,
  PLOT,
  STAND_SPOTS,
  characterById,
  cssColor,
  displaySlotRebirths,
  formatCash,
  formatOdds,
  formatRate,
  isDisplaySlotOpen,
  levelUpCost,
  rarityById,
  visibleName,
  type PlotPlacement,
  type StandSpot,
  type UnitRecord,
} from '@dice/shared';
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import { PlayerRig } from '../animation/rig/PlayerRig.js';
import { drawPortrait, portraitFor } from '../bloxity/Portraits.js';
import { createCharacterBody } from '../characters/CharacterModels.js';
import { StandAnimator } from '../characters/StandAnimator.js';
import { meshesFor } from '../render/PartBuilder.js';
import { iconImage } from '../ui/images.js';
import { LabelSprite } from './LabelSprite.js';
import { plotShellGeometry } from './PlotShell.js';
import { createStandVfx } from './StandVfx.js';
import { TextPlane, outlinedText, roundedRect } from './TextPlane.js';

/** What one stand shows, as replicated. */
export interface StandData {
  readonly charId: string;
  readonly level: number;
  readonly income: number;
  readonly uid: number;
}

/** A plot's owner, as the view needs them. */
export interface PlotOwner {
  readonly name: string;
  readonly avatarUrl: string;
  readonly rebirths: number;
  readonly cashPerSec: number;
  readonly local: boolean;
}

/** Stands this close to the camera breathe and glance around; further ones hold still. */
const ANIMATE_DISTANCE = 62;

const lockPlateGeometry = new PlaneGeometry(PLOT.standSize - 0.2, PLOT.standSize - 0.2).rotateX(-Math.PI / 2);
const lockPlateMaterial = new MeshBasicMaterial({ color: 0x0b0d18 });
const WORLD = new Vector3();

/** Character bodies that may be built per frame, across every plot (painting a new character is the costly part). */
export const buildBudget = { remaining: 3 };

/** One pedestal: its state, and the character, labels and effects on it. */
class StandView {
  readonly root = new Group();
  private charId = '';
  private level = 0;
  private body: { visual: Group; animator: StandAnimator; height: number } | null = null;
  private vfx: Group | null = null;
  private info: LabelSprite | null = null;
  private lockLabel: LabelSprite | null = null;
  private lockPlate: Mesh | null = null;
  private pad: TextPlane | null = null;
  private board: TextPlane | null = null;
  private held = false;

  constructor(readonly spot: StandSpot) {
    this.root.position.set(spot.x, spot.y, spot.z);
    this.root.rotation.y = spot.yaw;
  }

  /** Apply what the stand shows. `detail` false strips everything expensive. False when a build was deferred. */
  sync(data: StandData, owner: PlotOwner | null, detail: boolean, units: ReadonlyMap<number, UnitRecord> | null, cash: number): boolean {
    const open = owner ? isDisplaySlotOpen(this.spot.slot, owner.rebirths) : false;
    this.syncLock(owner !== null && !open, detail);

    const want = detail && open && data.charId && characterById(data.charId) ? data.charId : '';
    let complete = true;
    if (want !== this.charId) {
      if (want && buildBudget.remaining <= 0) {
        complete = false;
      } else {
        this.clearCharacter();
        this.charId = want;
        if (want) {
          buildBudget.remaining -= 1;
          this.buildCharacter(want);
        }
      }
    }
    if (this.info && this.charId) {
      const character = characterById(this.charId)!;
      const rarity = rarityById(character.rarity);
      this.info.set([
        { text: character.name, color: '#ffffff', size: 1.25 },
        { text: rarity.name, color: cssColor(rarity.color), size: 0.95 },
        { text: formatOdds(character.odds), color: '#ffe14a', size: 0.95 },
        { text: formatRate(data.income), color: '#5dff6a', size: 1.05 },
      ]);
    }
    this.level = data.level;

    // The owner's own plot: the price board and the green level pad.
    const unit = owner?.local && units && data.uid ? units.get(data.uid) : undefined;
    this.syncPad(detail && owner?.local === true && open && !!this.charId && !!unit, data, unit, cash);
    return complete;
  }

  private syncLock(locked: boolean, detail: boolean): void {
    if (locked && !this.lockPlate) {
      this.lockPlate = new Mesh(lockPlateGeometry, lockPlateMaterial);
      this.lockPlate.position.y = 0.02;
      this.root.add(this.lockPlate);
    } else if (!locked && this.lockPlate) {
      this.lockPlate.removeFromParent();
      this.lockPlate = null;
    }
    const wantLabel = locked && detail;
    if (wantLabel && !this.lockLabel) {
      this.lockLabel = new LabelSprite(5.4, 1.5, 256);
      this.lockLabel.sprite.position.y = 2.2;
      this.root.add(this.lockLabel.sprite);
      this.drawLock();
    } else if (!wantLabel && this.lockLabel) {
      this.lockLabel.dispose();
      this.lockLabel = null;
    }
  }

  private drawLock(): void {
    const icon = iconImage('rebirth', () => this.drawLock());
    this.lockLabel?.set([{ text: `Rebirth ${displaySlotRebirths(this.spot.slot)}`, color: '#ffffff', icon }]);
  }

  private buildCharacter(charId: string): void {
    const made = createCharacterBody(charId);
    const character = characterById(charId);
    if (!made || !character) return;
    const visual = new Group();
    visual.scale.setScalar(made.scale);
    visual.add(made.model);
    this.root.add(visual);
    const rig = new PlayerRig(made.model, made.model);
    const animator = new StandAnimator(rig, character.role ?? 'balanced', this.spot.slot * 0.37 + this.spot.x * 0.01);
    animator.hold();
    const height = PLAYER_HEIGHT * made.scale;
    this.body = { visual, animator, height };
    this.vfx = createStandVfx(character, height);
    this.root.add(this.vfx);
    this.info = new LabelSprite(4.8, 3.2, 256);
    this.info.sprite.position.y = height + 2.2;
    this.root.add(this.info.sprite);
    this.held = true;
  }

  private clearCharacter(): void {
    if (this.body) {
      this.body.visual.removeFromParent();
      this.body = null;
    }
    if (this.vfx) {
      this.vfx.removeFromParent();
      this.vfx = null;
    }
    if (this.info) {
      this.info.dispose();
      this.info = null;
    }
  }

  private syncPad(show: boolean, data: StandData, unit: UnitRecord | undefined, cash: number): void {
    if (!show || !unit) {
      this.pad?.dispose();
      this.board?.dispose();
      this.pad = null;
      this.board = null;
      return;
    }
    if (!this.pad) {
      this.pad = new TextPlane(PLOT.padHalf * 2, PLOT.padHalf * 2, 64);
      this.pad.mesh.rotation.x = -Math.PI / 2;
      // Pad centre relative to the stand, in the stand's (turned) frame: toward the carpet.
      this.pad.mesh.position.set(0, (this.spot.upper ? PLOT.deckTop : PLOT.floorTop) - this.spot.y + 0.07, PLOT.padOffset);
      this.root.add(this.pad.mesh);
      this.board = new TextPlane(4.4, 1.15, 72);
      this.board.mesh.position.set(0, -0.62, PLOT.standSize / 2 + 0.03);
      this.root.add(this.board.mesh);
    }
    const cost = levelUpCost(unit);
    const maxed = !Number.isFinite(cost);
    const affordable = !maxed && cash >= cost;
    this.pad.draw(`${maxed}:${cost}:${affordable}`, (ctx, w, h) => {
      ctx.fillStyle = maxed ? '#6b7390' : affordable ? '#35e25c' : '#1f8f3c';
      roundedRect(ctx, w * 0.04, h * 0.04, w * 0.92, h * 0.92, w * 0.14);
      ctx.fill();
      ctx.lineWidth = w * 0.05;
      ctx.strokeStyle = maxed ? '#3a4058' : '#136b2a';
      ctx.stroke();
      outlinedText(ctx, maxed ? 'MAX' : formatCash(cost), w / 2, h * 0.52, h * 0.34, '#ffffff', w * 0.84);
    });
    this.board?.draw(`${data.income}:${unit.l}:${maxed}`, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(20, 28, 60, 0.92)';
      roundedRect(ctx, 0, 0, w, h, h * 0.2);
      ctx.fill();
      outlinedText(ctx, formatRate(data.income), w * 0.27, h * 0.5, h * 0.52, '#ffffff', w * 0.5);
      outlinedText(ctx, maxed ? `Lvl ${unit.l}` : `Lvl ${unit.l} > ${unit.l + 1}`, w * 0.74, h * 0.5, h * 0.44, '#bfe0ff', w * 0.48);
    });
  }

  /** Breathe when near, hold still when far. */
  update(delta: number, camera: Vector3): void {
    if (!this.body) return;
    this.root.getWorldPosition(WORLD);
    const near = WORLD.distanceToSquared(camera) < ANIMATE_DISTANCE * ANIMATE_DISTANCE;
    if (near) {
      this.body.visual.position.y = this.body.animator.update(delta);
      this.held = false;
    } else if (!this.held) {
      this.body.animator.hold();
      this.body.visual.position.y = 0;
      this.held = true;
    }
    if (this.vfx) {
      for (const child of this.vfx.children) if (child.userData['spin'] === true) child.rotation.y += delta * 0.8;
    }
  }

  dispose(): void {
    this.clearCharacter();
    this.syncLock(false, false);
    this.syncPad(false, { charId: '', level: 0, income: 0, uid: 0 }, undefined, 0);
    this.root.removeFromParent();
  }
}

/**
 * ONE PLAYER'S DISPLAY HALL: the shared shell at this plot's place, the
 * owner's banner over the entrance, and twenty `StandView`s. Characters,
 * labels and effects exist only while the plot is NEAR the camera (with some
 * hysteresis), so sixteen full plots never cost more than the few in view.
 */
export class PlotView {
  readonly root = new Group();
  private readonly stands: StandView[] = [];
  private readonly banner: TextPlane;
  private readonly bannerBack: Mesh;
  private readonly centre = new Vector3();
  private owner: PlotOwner | null = null;
  private data: StandData[] = [];
  private detail = false;
  private units: ReadonlyMap<number, UnitRecord> | null = null;
  private cash = 0;
  private dirty = true;

  constructor(readonly placement: PlotPlacement) {
    this.root.position.set(placement.x, 0, placement.z);
    this.root.rotation.y = placement.yaw;
    const shell = meshesFor(plotShellGeometry(), `plot-${placement.index}`, true);
    this.root.add(shell);
    for (const spot of STAND_SPOTS) {
      const stand = new StandView(spot);
      this.stands.push(stand);
      this.root.add(stand.root);
    }
    this.banner = new TextPlane(26, 5, 40);
    // Facing out to the plaza (plot -Z), under the arch.
    this.banner.mesh.position.set(0, 14.6, -0.05);
    this.banner.mesh.rotation.y = Math.PI;
    this.root.add(this.banner.mesh);
    this.bannerBack = new Mesh(this.banner.mesh.geometry, this.banner.mesh.material);
    this.bannerBack.position.set(0, 14.6, 1.45);
    this.root.add(this.bannerBack);
    this.centre.set(placement.x, 6, placement.z);
    const inward = { x: Math.sin(placement.yaw), z: Math.cos(placement.yaw) };
    this.centre.x += inward.x * PLOT.depth * 0.5;
    this.centre.z += inward.z * PLOT.depth * 0.5;
    this.data = new Array(DISPLAY_SLOTS).fill(null).map(() => ({ charId: '', level: 0, income: 0, uid: 0 }));
    this.drawBanner();
  }

  get index(): number {
    return this.placement.index;
  }

  setOwner(owner: PlotOwner | null): void {
    const before = JSON.stringify(this.owner);
    this.owner = owner;
    if (JSON.stringify(owner) !== before) {
      this.dirty = true;
      this.drawBanner();
    }
  }

  setStands(stands: readonly StandData[]): void {
    this.data = stands.slice(0, DISPLAY_SLOTS);
    this.dirty = true;
  }

  /** The local player's units and cash, for the price boards on their own plot. */
  setLocal(units: ReadonlyMap<number, UnitRecord> | null, cash: number): void {
    if (!this.owner?.local) return;
    this.units = units;
    this.cash = cash;
  }

  /** Force the stands to re-sync (the local inventory changed). */
  touch(): void {
    this.dirty = true;
  }

  update(delta: number, camera: Vector3): void {
    const distance = camera.distanceTo(this.centre);
    const detail = this.detail ? distance < 130 : distance < 110;
    if (detail !== this.detail) {
      this.detail = detail;
      this.dirty = true;
    }
    if (this.dirty) {
      this.dirty = false;
      for (let i = 0; i < this.stands.length; i += 1) {
        const done = this.stands[i]!.sync(this.data[i] ?? { charId: '', level: 0, income: 0, uid: 0 }, this.owner, this.detail, this.units, this.cash);
        if (!done) this.dirty = true;
      }
    }
    if (this.detail) for (const stand of this.stands) stand.update(delta, camera);
  }

  private drawBanner(): void {
    const owner = this.owner;
    const face = owner?.avatarUrl ? portraitFor(owner.avatarUrl, () => {
      this.banner.invalidate();
      this.drawBanner();
    }) : null;
    const key = owner ? `${owner.name}|${owner.rebirths}|${owner.avatarUrl}|${face ? 1 : 0}` : 'empty';
    this.banner.draw(key, (ctx, w, h) => {
      ctx.fillStyle = owner ? 'rgba(24, 32, 78, 0.94)' : 'rgba(24, 32, 78, 0.6)';
      roundedRect(ctx, w * 0.01, h * 0.04, w * 0.98, h * 0.92, h * 0.3);
      ctx.fill();
      ctx.lineWidth = h * 0.06;
      ctx.strokeStyle = owner?.local ? '#ffd23a' : '#8f9ed4';
      ctx.stroke();
      if (!owner) {
        outlinedText(ctx, 'Empty Plot', w / 2, h / 2, h * 0.5, '#aab4d8', w * 0.8);
        return;
      }
      const name = visibleName(owner.name);
      const faceSize = h * 0.7;
      if (face) drawPortrait(ctx, face, w * 0.06, h / 2, faceSize);
      const textX = w * 0.06 + (face ? faceSize + h * 0.2 : 0);
      outlinedText(ctx, name, textX, h * 0.38, h * 0.42, '#ffffff', w * 0.6, '#0b1030', 'left');
      outlinedText(ctx, owner.rebirths > 0 ? `Rebirth ${owner.rebirths}` : 'Collector', textX, h * 0.74, h * 0.26, owner.local ? '#ffd23a' : '#bfe0ff', w * 0.5, '#0b1030', 'left');
    });
  }

  dispose(): void {
    for (const stand of this.stands) stand.dispose();
    this.banner.dispose();
    this.bannerBack.removeFromParent();
    this.root.removeFromParent();
  }
}
