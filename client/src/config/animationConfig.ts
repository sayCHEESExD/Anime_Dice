import type { RoleId } from '@dice/shared';
import type { PoseDefinition } from '../animation/PoseBuffer.js';

const deg = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Procedural animation tuning. Every number the animators use lives here.
 * All rotations are in CHARACTER space (see `PlayerRig`): +X pitch swings a
 * limb BACKWARD, so a raised arm is a large negative X.
 */

/** The walk/run cycle: ONE cycle at three depths. */
export const LOCOMOTION = {
  minFrequency: 0.7,
  maxFrequency: 3.6,
  strideDistance: 5.2,
  idleSpeed: 0.6,
  walkSpeed: 4,
  runSpeed: 14,
  sprintSpeed: 30,

  hipSwing: { walk: deg(22), run: deg(42), sprint: deg(56) },
  kneeBend: { walk: deg(30), run: deg(58), sprint: deg(72) },
  armSwing: { walk: deg(18), run: deg(36), sprint: deg(52) },
  elbowBend: { walk: deg(14), run: deg(44), sprint: deg(70) },
  torsoTwist: { walk: deg(4), run: deg(7), sprint: deg(9) },
  torsoLean: { walk: deg(3), run: deg(10), sprint: deg(18) },
  headCounterTwist: { walk: deg(2), run: deg(4), sprint: deg(5) },
  torsoRoll: { walk: deg(2), run: deg(3), sprint: deg(3) },
  bob: { walk: 0.05, run: 0.11, sprint: 0.15 },
  bankAngle: deg(9),
  bankRate: 8,
} as const;

/** The player's idle: relaxed, breathing. */
export const IDLE = {
  breathFrequency: 0.35,
  breathAmount: deg(1.8),
  breathBob: 0.012,
  basePose: {
    ArmL1: { x: deg(2), z: deg(8) },
    ArmL2: { x: deg(10) },
    ArmR1: { x: deg(2), z: deg(-8) },
    ArmR2: { x: deg(10) },
    LegL1: { x: deg(-3) },
    LegR1: { x: deg(3) },
  } satisfies PoseDefinition,
} as const;

/** In the air: knees tucked on the way up, legs reaching on the way down. */
export const AIRBORNE = {
  rise: {
    LegL1: { x: deg(-38) },
    LegR1: { x: deg(8) },
    LegL2: { x: deg(62) },
    LegR2: { x: deg(40) },
    ArmL1: { x: deg(-40), z: deg(34) },
    ArmR1: { x: deg(-30), z: deg(-34) },
    ArmL2: { x: deg(30) },
    ArmR2: { x: deg(30) },
    Spine1: { x: deg(6) },
  } satisfies PoseDefinition,
  fall: {
    LegL1: { x: deg(-14) },
    LegR1: { x: deg(10) },
    LegL2: { x: deg(22) },
    LegR2: { x: deg(18) },
    ArmL1: { x: deg(-70), z: deg(40) },
    ArmR1: { x: deg(-60), z: deg(-40) },
    ArmL2: { x: deg(20) },
    ArmR2: { x: deg(20) },
    Spine1: { x: deg(-4) },
  } satisfies PoseDefinition,
  velocityReference: 20,
} as const;

/** The landing crouch. */
export const LANDING = {
  duration: 0.16,
  pose: {
    LegL1: { x: deg(-34) },
    LegR1: { x: deg(-34) },
    LegL2: { x: deg(58) },
    LegR2: { x: deg(58) },
    ArmL1: { x: deg(-18), z: deg(20) },
    ArmR1: { x: deg(-18), z: deg(-20) },
    Spine1: { x: deg(14) },
  } satisfies PoseDefinition,
  bobY: -0.32,
} as const;

/** Seconds a pose change takes to blend in. */
export const TRANSITIONS = {
  toLocomotion: 0.14,
  toAirborne: 0.12,
  toLanding: 0.06,
} as const;

// ------------------------------------------------------- trophy poses

/**
 * How a character stands on its display stand and on its card: a pose per
 * ROLE, so a new character needs no animation data. The stand animator adds
 * breathing and a slow sway on top.
 */
export const STAND_POSES: Readonly<Record<RoleId, PoseDefinition>> = {
  // Hands on hips, chest out.
  balanced: {
    ArmL1: { x: deg(-6), z: deg(38) },
    ArmL2: { x: deg(70), y: deg(-30) },
    ArmR1: { x: deg(-6), z: deg(-38) },
    ArmR2: { x: deg(70), y: deg(30) },
    Spine1: { x: deg(-4) },
    LegL1: { z: deg(6) },
    LegR1: { z: deg(-6) },
  },
  // Fighting guard: fists up, weight forward.
  striker: {
    ArmL1: { x: deg(-62), z: deg(18) },
    ArmL2: { x: deg(96) },
    ArmR1: { x: deg(-40), z: deg(-10) },
    ArmR2: { x: deg(108) },
    Spine1: { x: deg(6), y: deg(-10) },
    LegL1: { x: deg(-16), z: deg(6) },
    LegR1: { x: deg(14), z: deg(-6) },
    LegL2: { x: deg(18) },
    LegR2: { x: deg(10) },
  },
  // Arms folded: the unshakeable wall.
  tank: {
    ArmL1: { x: deg(-58), z: deg(-8) },
    ArmL2: { x: deg(96), y: deg(40) },
    ArmR1: { x: deg(-50), z: deg(8) },
    ArmR2: { x: deg(96), y: deg(-40) },
    Spine1: { x: deg(-6) },
    LegL1: { z: deg(8) },
    LegR1: { z: deg(-8) },
  },
  // Low and ready: one hand forward, one back.
  assassin: {
    ArmL1: { x: deg(-78), z: deg(10) },
    ArmL2: { x: deg(20) },
    ArmR1: { x: deg(26), z: deg(-22) },
    ArmR2: { x: deg(30) },
    Spine1: { x: deg(14), y: deg(14) },
    LegL1: { x: deg(-30), z: deg(8) },
    LegR1: { x: deg(22), z: deg(-8) },
    LegL2: { x: deg(40) },
    LegR2: { x: deg(20) },
  },
  // One hand raised, calm.
  support: {
    ArmL1: { x: deg(4), z: deg(10) },
    ArmL2: { x: deg(14) },
    ArmR1: { x: deg(-120), z: deg(-18) },
    ArmR2: { x: deg(24) },
    Spine1: { x: deg(-2) },
    LegL1: { z: deg(4) },
    LegR1: { z: deg(-4) },
  },
};

/** The stand idle on top of the pose. */
export const STAND_IDLE = {
  breathFrequency: 0.45,
  breathAmount: deg(2.4),
  armSway: deg(3),
  headLook: deg(9),
  headLookFrequency: 0.11,
  bob: 0.04,
} as const;
