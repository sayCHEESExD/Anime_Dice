import { characterById, type CharacterDef } from '@dice/shared';
import { Group, Matrix4, Mesh, MeshStandardMaterial, Vector3, type BufferGeometry, type Object3D } from 'three';
import { attachToMount } from '../animation/rig/BoneMounts.js';
import { PlayerRig } from '../animation/rig/PlayerRig.js';
import type { BoneName } from '../animation/rig/boneNames.js';
import { playerModelLoader } from '../player/PlayerModelLoader.js';
import { PartBuilder, meshesFor, type PartKind } from '../render/PartBuilder.js';
import { buildMount, type MountContext, type MountSlot } from './Accessories.js';
import { paintSuit, partBox, type BodyPart } from './HeroPainter.js';
import { lookPainter } from './LookPainter.js';

/**
 * CHARACTER MODELS: the supplied rigged player model, its atlas painted with
 * the character's look (`LookPainter`), and the look's hair and gear built as
 * primitives and bolted to the bones (`Accessories`). One texture and one set
 * of gear geometries per CHARACTER, shared by every copy of it on every stand,
 * card and portrait - so twenty Narutas cost one Naruto.
 *
 * Nothing here is per-character code: a model is a function of a data row.
 */

const materials = new Map<string, MeshStandardMaterial>();
const gear = new Map<string, Partial<Record<PartKind, BufferGeometry>> | null>();

const MOUNT_BONE: Readonly<Record<MountSlot, BoneName>> = {
  head: 'Neck1',
  back: 'Spine1',
  hip: 'Spine1',
  handR: 'ArmR2',
  handL: 'ArmL2',
};

const MOUNTS: readonly MountSlot[] = ['head', 'back', 'handR', 'handL'];

const centre = (part: BodyPart): Vector3 => {
  const box = partBox(part);
  return box ? box.min.clone().add(box.max).multiplyScalar(0.5) : new Vector3();
};

/** Where each mount sits on the measured body, in model space at the origin. */
const mountPoint = (slot: MountSlot): Vector3 => {
  const torso = partBox('torso');
  switch (slot) {
    case 'head':
      return centre('head');
    case 'back':
    case 'hip':
      return torso ? new Vector3((torso.min.x + torso.max.x) / 2, torso.max.y - 0.12, torso.min.z - 0.02) : new Vector3();
    case 'handR':
    case 'handL': {
      const arm = partBox(slot === 'handR' ? 'armR' : 'armL');
      return arm ? new Vector3((arm.min.x + arm.max.x) / 2, arm.min.y + 0.14, (arm.min.z + arm.max.z) / 2) : new Vector3();
    }
  }
};

let context: MountContext | null = null;

const contextOf = (): MountContext => {
  if (context) return context;
  const head = partBox('head');
  const torso = partBox('torso');
  const arm = partBox('armR');
  context = {
    head: head ? head.max.y - head.min.y : 0.9,
    torsoW: torso ? torso.max.x - torso.min.x : 1.1,
    torsoD: torso ? torso.max.z - torso.min.z : 0.55,
    torsoH: torso ? torso.max.y - torso.min.y : 1.1,
    limb: arm ? arm.max.x - arm.min.x : 0.55,
  };
  return context;
};

/** The painted body material of one character, painted once. */
const materialFor = (character: CharacterDef, model: Object3D): MeshStandardMaterial => {
  let material = materials.get(character.id);
  if (!material) {
    material = new MeshStandardMaterial({
      map: paintSuit(`char-${character.id}`, model, lookPainter(character.look)),
      roughness: 0.66,
      metalness: 0.04,
    });
    materials.set(character.id, material);
  }
  return material;
};

const gearFor = (character: CharacterDef, slot: MountSlot): Partial<Record<PartKind, BufferGeometry>> | null => {
  const key = `${character.id}:${slot}`;
  if (gear.has(key)) return gear.get(key) ?? null;
  const builder = new PartBuilder();
  const built = buildMount(builder, slot, contextOf(), character.look, character.id);
  const geometries = built && !builder.isEmpty ? builder.geometries() : null;
  gear.set(key, geometries);
  return geometries;
};

/** True once this character's texture exists (painting is the expensive part). */
export const isCharacterPainted = (id: string): boolean => materials.has(id);

export interface CharacterBody {
  readonly model: Object3D;
  /** Visual scale the character is drawn at. */
  readonly scale: number;
}

/**
 * A fresh, independently-animatable body for a character. Returns null for
 * an unknown id (a newer save on an older build): callers draw nothing.
 */
export const createCharacterBody = (id: string): CharacterBody | null => {
  const character = characterById(id);
  if (!character) return null;
  const model = playerModelLoader.createInstance();
  const material = materialFor(character, model);
  model.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.material = material;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
  });

  // Gear goes on in the bind pose with the body at the origin.
  const root = new Group();
  model.rotation.set(0, 0, 0);
  root.add(model);
  const rig = new PlayerRig(model, model);
  rig.resetToBindPose();
  root.updateMatrixWorld(true);
  for (const mount of MOUNTS) {
    const geometries = gearFor(character, mount);
    const bone = rig.getBone(MOUNT_BONE[mount]);
    if (!geometries || !bone) continue;
    const group = meshesFor(geometries, `char-${character.id}-${mount}`, true);
    group.userData['characterGear'] = true;
    const at = mountPoint(mount);
    attachToMount(group, { bone, frame: new Matrix4().makeTranslation(at.x, at.y, at.z) }, root);
  }
  model.removeFromParent();
  model.userData['characterBody'] = character.id;
  return { model, scale: character.look.scale ?? 1 };
};
