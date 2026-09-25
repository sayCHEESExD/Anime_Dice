import type { AudioManager } from './AudioManager.js';

const MIN_AUDIBLE_SPEED = 2.5;
const STRIDE_DISTANCE = 2.6;

export interface PlayerAudioInput {
  readonly horizontalSpeed: number;
  readonly isGrounded: boolean;
  readonly jumpedEdge: boolean;
  readonly landedEdge: boolean;
  readonly riding: boolean;
}

/** The local player's movement sounds: soft footfalls per stride, the jump and the landing. */
export class PlayerAudio {
  private stride = 0;

  constructor(private readonly audio: AudioManager) {}

  update(delta: number, player: PlayerAudioInput): void {
    if (player.jumpedEdge) this.audio.play('jump', 0.7);
    if (player.landedEdge) this.audio.play('land', 0.5);
    if (!player.isGrounded || player.riding || player.horizontalSpeed < MIN_AUDIBLE_SPEED) {
      this.stride = 0;
      return;
    }
    this.stride += player.horizontalSpeed * delta;
    if (this.stride < STRIDE_DISTANCE) return;
    this.stride = 0;
    this.audio.play('step', 0.6);
  }
}
