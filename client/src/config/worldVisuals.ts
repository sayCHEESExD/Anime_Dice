/**
 * THE PALETTE of Anime Dice: a bright studded toy island under a clear blue
 * sky - lime grass, a pale-yellow tiled plaza, navy display plots with red
 * carpets, a glass-blue tower, ocean all around and hazy blue mountains on the
 * horizon. COLOUR ONLY: every coordinate lives in `@dice/shared`'s map config.
 */
export const PALETTE = {
  grass: 0x4fc84a,
  grassDark: 0x3aa53a,
  sand: 0xf3dd9a,
  plaza: '#f6efb4',
  plazaLine: '#e3d888',
  plazaAccent: '#fff8d0',
  path: 0xf2e6a8,
  ocean: 0x3cb6ee,
  oceanDeep: 0x1f84cf,
  mountain: 0x5a8fe0,
  mountainDark: 0x3f6fc4,

  /** Plots. */
  plotBase: 0x3a4a8f,
  plotRim: 0x8f9ed4,
  plotEdge: 0xc9d3f0,
  carpet: 0xec2b45,
  carpetEdge: 0xb81a33,
  stand: 0x2e3866,
  standTop: 0x4a5796,
  standLocked: 0x15182a,
  padGreen: 0x35e25c,
  padGreenDark: 0x1e9e3c,
  deck: 0x4d5ea6,
  pillar: 0xdfe5f7,
  rail: 0xf4f6ff,

  /** Tower. */
  towerGlass: 0x3d8ae6,
  towerGlassLight: 0x9fd4ff,
  towerTrim: 0xf4f8ff,
  towerGold: 0xffc93a,
  terrace: 0x8fa0d8,
  terraceTop: 0xe9eefc,

  /** Escalators. */
  escalatorSide: 0xdfe7f5,
  escalatorGlass: 0x9fd8ff,
  escalatorRail: 0x1c2233,
  escalatorStep: 0x5b6378,

  /** Stalls. */
  stallWood: 0x2c3a66,
  stallCounter: 0x3b4d86,

  /** Nature. */
  trunk: 0x9a6a3e,
  palm: 0x3fbf4a,
  palmDark: 0x2e9a3a,
  flower: 0xff7ab0,
  water: 0x55c8ff,

  /** Boards. */
  boardFrame: 0x2c3a78,
  boardFrameDark: 0x1b2450,
  boardPanel: '#1a2350',
  boardPanelEdge: '#34448a',
  boardStripe: 'rgba(255, 255, 255, 0.05)',
  boardInk: '#050912',
  boardHeading: '#ffffff',
  boardName: '#ffffff',
  boardValue: '#7fe6ff',

  /** Sky and fog. */
  skyTop: 0x3d9cf0,
  sky: 0x8fd3ff,
  fog: 0xcfeafb,
  skyCloud: 0xffffff,
  skyCloudShade: 0xdcecfb,
} as const;

/**
 * THE HORIZON FOG, by distance from the camera. Everything on the island a
 * player looks at (their plot, the plaza, the tower) sits well inside `near`
 * and stays crisp; the far plots haze a little; the sea past the beach thickens
 * to the fog colour by `far`, so the world ends in a soft horizon instead of
 * scenery running on for ever. The sky dome and the ocean blend to the same
 * colour, so there is no seam.
 */
export const WORLD_FOG = {
  near: 170,
  far: 470,
} as const;

/** Yaw correction for the supplied player FBX. It already faces +Z. */
export const PLAYER_MODEL_YAW_OFFSET = 0;

/** '#rrggbb' from a hex number. */
export const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;
