/**
 * THE DICE. One roll costs `cost` Cash and produces one character, chosen by
 * `systems/roll.ts` from the pool's odds divided by the player's Luck.
 *
 * The server refuses a roll that arrives sooner than `cooldownSeconds` (scaled
 * down by the Roll Speed upgrade) after the last one; the client's roll
 * presentation is always at least that long, so Auto Spin never trips it.
 */
export const DICE = {
  cost: 1,
  /** Minimum seconds between two accepted rolls, before Roll Speed. */
  cooldownSeconds: 1.05,
  /** How long the full roll presentation lasts, before Roll Speed. */
  presentSeconds: 2.3,
  /** Auto Spin's shorter presentation for results below the fanfare tiers. */
  autoPresentSeconds: 1.25,
  /**
   * The free roll: a player who cannot afford a roll AND earns nothing (no
   * displayed units) rolls for free, so nobody can ever be stranded at $0.
   */
  freeRollWhenBroke: true,
} as const;

/** Seconds between rolls for a Roll Speed level (the shared figure both sides use). */
export const rollCooldown = (rollSpeedFraction: number): number =>
  DICE.cooldownSeconds * Math.max(0.4, 1 - rollSpeedFraction);

export const rollPresentSeconds = (rollSpeedFraction: number, auto: boolean): number =>
  (auto ? DICE.autoPresentSeconds : DICE.presentSeconds) * Math.max(0.4, 1 - rollSpeedFraction);
