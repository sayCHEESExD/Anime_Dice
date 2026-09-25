import type { RoleId } from '@dice/shared';
import { PoseBuffer } from '../animation/PoseBuffer.js';
import type { PlayerRig } from '../animation/rig/PlayerRig.js';
import { STAND_IDLE, standPose } from '../config/animationConfig.js';

/**
 * THE TROPHY IDLE: a character on a stand holds its role's pose and breathes,
 * sways its arms a little and glances around. Cheap enough to run on every
 * nearby stand; far ones call `hold()` once and are never touched again.
 */
export class StandAnimator {
  private readonly pose = new PoseBuffer();
  private time: number;

  constructor(
    private readonly rig: PlayerRig,
    private readonly role: RoleId,
    /** Offsets the cycle so a row of stands does not breathe in unison. */
    phase: number,
  ) {
    this.time = phase * 7.3;
  }

  /** Apply the still pose (no breathing): for stands too far to animate. */
  hold(): void {
    this.pose.applyDefinition(standPose(this.role));
    this.rig.applyPose(this.pose);
  }

  /** Advance and apply. Returns the vertical bob for the caller's visual node. */
  update(delta: number): number {
    this.time += delta;
    const breath = Math.sin(this.time * STAND_IDLE.breathFrequency * Math.PI * 2);
    const look = Math.sin(this.time * STAND_IDLE.headLookFrequency * Math.PI * 2);
    const sway = Math.sin(this.time * STAND_IDLE.breathFrequency * Math.PI * 2 + 1.3);
    this.pose.applyDefinition(standPose(this.role));
    this.pose.add('Spine1', breath * STAND_IDLE.breathAmount);
    this.pose.add('Spine2', breath * STAND_IDLE.breathAmount * 0.5);
    this.pose.add('Neck1', -breath * STAND_IDLE.breathAmount * 0.5, look * STAND_IDLE.headLook);
    this.pose.add('ArmL1', sway * STAND_IDLE.armSway, 0, sway * STAND_IDLE.armSway * 0.5);
    this.pose.add('ArmR1', -sway * STAND_IDLE.armSway, 0, sway * STAND_IDLE.armSway * 0.5);
    this.rig.applyPose(this.pose);
    return breath * STAND_IDLE.bob;
  }
}
