/**
 * Network-level constants. Must stay identical on client and server.
 */

/** Colyseus room registered by the server and joined by the client. */
export const ROOM_NAME = 'animedice';

/**
 * Default server port. Override with the PORT env var on the server.
 *
 * Deliberately not 2567: the other games in this series occupy the 2567-2610
 * range on the same machine, and sharing a port means whichever server starts
 * first silently serves both clients.
 */
export const DEFAULT_SERVER_PORT = 2620;

/**
 * Most players in ONE room. The matchmaker locks a room at this figure and
 * opens another, so a sixteenth player gets a new room rather than a refusal.
 */
export const MAX_PLAYERS_PER_ROOM = 15;

/** How many OTHER player avatars are drawn at once (rendering only). */
export const VISIBLE_REMOTE_PLAYERS = 14;

/** Server simulation / state broadcast rate, in Hz. */
export const SERVER_TICK_RATE = 20;

export const SERVER_TICK_MS = 1000 / SERVER_TICK_RATE;

/**
 * Client->server and server->client message identifiers.
 *
 * A const object rather than an enum so it survives `verbatimModuleSyntax`.
 * Every client -> server message is a REQUEST: the server validates it against
 * its own state and never copies a figure out of it.
 */
export const MessageType = {
  // ------------------------------------------------------------ movement
  /** Client -> server: one frame of INPUT. Never a transform. */
  Move: 'move',
  /** Server -> client: authoritative placement. */
  Respawn: 'respawn',
  /** Client -> server: "put me back on my plot". */
  RequestRespawn: 'requestRespawn',

  // ------------------------------------------------------------- dice
  /** Client -> server: roll the dice once ($1). */
  Roll: 'roll',
  /** Server -> client: what the roll produced. */
  Rolled: 'rolled',
  /** Client -> server: which rarities are auto-sold as they are rolled. */
  SetAutoSell: 'setAutoSell',

  // -------------------------------------------------------- inventory
  /** Server -> client: the whole private inventory (join / login change). */
  Inventory: 'inventory',
  /** Server -> client: units added / removed / changed since the last message. */
  UnitDelta: 'unitDelta',
  /** Server -> client: the small private progression (potions, upgrades, team, tower...). */
  Private: 'private',
  /** Client -> server: place / remove / best / clear on the display plot. */
  Display: 'display',
  /** Client -> server: set / remove / best / clear on the tower team. */
  Team: 'team',
  /** Client -> server: level a unit up with Cash. */
  LevelUp: 'levelUp',
  /** Client -> server: sell units for Cash. */
  Sell: 'sell',
  /** Client -> server: lock or unlock a unit (locked units are never sold). */
  Lock: 'lock',
  /** Client -> server: drink a potion into a unit. */
  UsePotion: 'usePotion',

  // ------------------------------------------------------ progression
  /** Client -> server: buy the next level of an upgrade. */
  Upgrade: 'upgrade',
  /** Client -> server: "rebirth me". Carries nothing. */
  Rebirth: 'rebirth',

  // ------------------------------------------------------------ tower
  /** Client -> server: fight a tower floor with the current team. */
  TowerFight: 'towerFight',
  /** Server -> client: the resolved battle, to be played back, and its rewards. */
  Battle: 'battle',

  // ------------------------------------------------------------ misc
  /** Server -> client: the outcome of a request, for feedback. */
  Notice: 'notice',
  /** Client -> server: "this is what my Bloxity avatar looks like". */
  SetAvatar: 'setAvatar',
  /** Client -> server: the player's Bloxity DISPLAY NAME and portrait. */
  SetIdentity: 'setIdentity',
  /** Client -> server: the portal's game TOKEN, or null when signed out. */
  SetAuth: 'setAuth',
  /** Server -> client: whose progress this session is now playing on. */
  AuthState: 'authState',
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];
