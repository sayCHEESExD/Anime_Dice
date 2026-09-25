import { ArraySchema, Schema, type } from '@colyseus/schema';
import { DISPLAY_SLOTS } from '@dice/shared';
import { AvatarState } from './AvatarState.js';

/**
 * One stand on a player's plot, as everybody in the room sees it. Only what a
 * visitor needs to draw and label it: which character, which unit and its
 * level (for the Cash/s sign). Potions and the rest stay private.
 */
export class DisplaySlotState extends Schema {
  @type('string') charId = '';
  @type('uint32') uid = 0;
  @type('uint8') level = 0;
  /** Cash/s this stand earns (after the owner's multiplier), for its sign. */
  @type('float64') income = 0;
}

const displaySlots = (): ArraySchema<DisplaySlotState> => {
  const list = new ArraySchema<DisplaySlotState>();
  for (let i = 0; i < DISPLAY_SLOTS; i += 1) list.push(new DisplaySlotState());
  return list;
};

/**
 * Replicated per-player state: what EVERY client needs to draw this player and
 * their plot. Every field is written by the SERVER; nothing is ever copied from
 * a client message. The private inventory (units, potions, upgrades, team,
 * tower) travels as messages to its owner only.
 */
export class PlayerState extends Schema {
  @type('string') sessionId = '';

  // ---- the movement simulation, for reconciliation and remote drawing
  @type('float32') x = 0;
  @type('float32') y = 0;
  @type('float32') z = 0;
  @type('float32') rotationY = 0;
  @type('float32') speed = 0;
  @type('boolean') grounded = true;
  @type('float32') velocityX = 0;
  @type('float32') velocityY = 0;
  @type('float32') velocityZ = 0;
  @type('boolean') jumpLatched = false;
  @type('uint32') jumpCount = 0;
  @type('uint32') lastInputSeq = 0;
  /** True once the server has simulated at least one input for this player. */
  @type('boolean') ready = false;

  @type(AvatarState) avatar = new AvatarState();
  @type('string') displayName = '';
  @type('string') avatarUrl = '';

  // ---- the plot and its showcase
  /** Which of the 16 plots is theirs (-1 while unassigned). */
  @type('int8') plot = -1;
  @type([DisplaySlotState]) display = displaySlots();

  // ---- progression, public
  /** Written through `Wallet` only. */
  @type('float64') cash = 0;
  @type('float64') lifetimeCash = 0;
  /** Cash/s earned by the display, after every multiplier. */
  @type('float64') cashPerSec = 0;
  @type('uint16') rebirths = 0;
  /** Total Luck multiplier. */
  @type('float32') luck = 1;
  @type('uint32') totalRolls = 0;
  @type('float64') bestOdds = 0;
  @type('uint16') towerBest = 0;
  /** Bumped on every roll, so visitors can see the owner rolling. */
  @type('uint32') rollPulse = 0;
  @type('float64') playSeconds = 0;
}
