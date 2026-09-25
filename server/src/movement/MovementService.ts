import {
  MAX_SIM_DELTA,
  WorldCollision,
  createMotion,
  createSimEvents,
  createSimParams,
  horizontalSpeed,
  resetMotion,
  sanitiseInput,
  stepPlayer,
  type MoveMessage,
  type PlayerMotion,
  type SimEvents,
  type SimParams,
} from '@dice/shared';
import type { PlayerState } from '../rooms/state/PlayerState.js';

/** Simulated seconds a client may bank per real second. */
const MAX_TIME_BUDGET_RATIO = 1.5;
/** Seconds of simulated time a fresh client starts with, to absorb bursts. */
const INITIAL_BUDGET = 0.5;
/** Largest jump in sequence number the server will follow. */
const MAX_SEQ_JUMP = 600;
/** A client silent this long is stepped by the server with no input, so nobody hangs in the air. */
const IDLE_AFTER_MS = 250;

export type RejectReason = 'malformed' | 'stale-seq' | 'seq-jump' | 'budget';

interface Sim {
  motion: PlayerMotion;
  events: SimEvents;
  params: SimParams;
  lastSeq: number;
  budget: number;
  lastRefill: number;
  lastInput: number;
}

const IDLE_INPUT = sanitiseInput({});

/**
 * Server-authoritative movement.
 *
 * The client sends INPUT and nothing else; this runs the shared simulation and
 * the result becomes the player's position, velocity, rotation and grounded
 * state. The same `stepPlayer` runs on the client for prediction, so the two
 * agree by construction rather than by trust.
 */
export class MovementService {
  private readonly sims = new Map<string, Sim>();
  readonly collision = new WorldCollision();

  private lastReject: RejectReason | null = null;

  initialise(player: PlayerState): void {
    const sim: Sim = {
      motion: createMotion(player.x, player.y, player.z, player.rotationY),
      events: createSimEvents(),
      params: createSimParams(),
      lastSeq: 0,
      budget: INITIAL_BUDGET,
      lastRefill: Date.now(),
      lastInput: Date.now(),
    };
    this.sims.set(player.sessionId, sim);
    this.publish(player, sim);
  }

  has(sessionId: string): boolean {
    return this.sims.has(sessionId);
  }

  forget(sessionId: string): void {
    this.sims.delete(sessionId);
  }

  get rejectReason(): RejectReason | null {
    return this.lastReject;
  }

  /** Teleport authoritatively. Only the server calls this. */
  teleport(sessionId: string, player: PlayerState, x: number, y: number, z: number, yaw: number): void {
    const sim = this.sims.get(sessionId);
    if (!sim) return;
    resetMotion(sim.motion, x, y, z, yaw);
    this.publish(player, sim);
  }

  /** Consume one input and advance the authoritative simulation. */
  applyInput(sessionId: string, player: PlayerState, message: MoveMessage): boolean {
    this.lastReject = null;
    const sim = this.sims.get(sessionId);
    if (!sim) return false;

    const seq = message?.seq;
    const dt = message?.dt;
    if (typeof seq !== 'number' || !Number.isFinite(seq) || typeof dt !== 'number' || !Number.isFinite(dt) || dt < 0) {
      this.lastReject = 'malformed';
      return false;
    }
    if (seq <= sim.lastSeq) {
      this.lastReject = 'stale-seq';
      return false;
    }
    if (seq > sim.lastSeq + MAX_SEQ_JUMP) {
      this.lastReject = 'seq-jump';
      return false;
    }

    const step = Math.min(dt, MAX_SIM_DELTA);
    this.refill(sim);
    if (step > sim.budget) {
      this.lastReject = 'budget';
      return false;
    }
    sim.budget -= step;
    sim.lastSeq = seq;
    sim.lastInput = Date.now();

    stepPlayer(sim.motion, sanitiseInput(message), sim.params, step, this.collision, sim.events);
    this.publish(player, sim);
    return true;
  }

  /**
   * Step a player whose client has gone quiet (a hidden tab) with no input,
   * so a jump still lands and an escalator still carries them.
   */
  idle(sessionId: string, player: PlayerState, delta: number): void {
    const sim = this.sims.get(sessionId);
    if (!sim || Date.now() - sim.lastInput < IDLE_AFTER_MS) return;
    stepPlayer(sim.motion, IDLE_INPUT, sim.params, Math.min(delta, MAX_SIM_DELTA), this.collision, sim.events);
    this.publish(player, sim);
  }

  private publish(player: PlayerState, sim: Sim): void {
    const m = sim.motion;
    if (player.x !== m.x) player.x = m.x;
    if (player.y !== m.y) player.y = m.y;
    if (player.z !== m.z) player.z = m.z;
    if (player.rotationY !== m.yaw) player.rotationY = m.yaw;
    if (player.velocityX !== m.vx) player.velocityX = m.vx;
    if (player.velocityY !== m.vy) player.velocityY = m.vy;
    if (player.velocityZ !== m.vz) player.velocityZ = m.vz;
    const speed = horizontalSpeed(m);
    if (player.speed !== speed) player.speed = speed;
    if (player.grounded !== m.grounded) player.grounded = m.grounded;
    if (player.jumpLatched !== m.jumpLatched) player.jumpLatched = m.jumpLatched;
    if (player.jumpCount !== m.jumpCount) player.jumpCount = m.jumpCount;
    if (player.lastInputSeq !== sim.lastSeq) player.lastInputSeq = sim.lastSeq;
    if (!player.ready) player.ready = true;
  }

  private refill(sim: Sim): void {
    const now = Date.now();
    const elapsed = Math.max(0, (now - sim.lastRefill) / 1000);
    sim.lastRefill = now;
    sim.budget = Math.min(sim.budget + elapsed * MAX_TIME_BUDGET_RATIO, MAX_SIM_DELTA * 20);
  }
}
