import type { ObtainStyle, RarityId } from './rarities.js';

/**
 * THE CHARACTER SCHEMA. A character is a row of DATA: nothing in the game
 * branches on a character's id. Stats derive from `odds` and `role` through
 * `systems/stats.ts`; the 3D model and card art are drawn from `look`; stand
 * effects from `vfx`; the obtain animation from the rarity (or `obtain`);
 * tower abilities from `ability`, interpreted by the generic battle system.
 *
 * Add a character = add a row to `characters.ts`.
 */

/** Combat bias. Scales attack / health around the rarity curve. */
export type RoleId = 'balanced' | 'striker' | 'tank' | 'assassin' | 'support';

// ------------------------------------------------------------------- look

/** Hair silhouettes the model builder knows how to make. */
export type HairStyle =
  | 'none'
  | 'spiky' // Goku-like: big spikes up and back
  | 'super' // Super-Saiyan: tall gold spikes
  | 'flame' // Vegeta-like widow's peak flame
  | 'messy' // short and tousled
  | 'long' // straight to the shoulders
  | 'longSpiky' // long and wild down the back (Madara / Kenpachi)
  | 'slick' // swept back
  | 'bowl' // bowl cut
  | 'bob' // chin-length
  | 'ponytail'
  | 'topknot' // tied bun on top
  | 'twinTails'
  | 'mohawk'
  | 'afro'
  | 'boar' // a boar mask over the head
  | 'spikyShort' // short upward spikes (Bakugo / Gon)
  | 'fringe'; // straight fringe, medium length

export type EyeStyle = 'normal' | 'sharp' | 'closed' | 'glow' | 'wide' | 'hidden';

/** Upper-body garment patterns the painter knows. */
export type TopStyle =
  | 'gi' // martial-arts gi with a crossed collar and belt
  | 'jacket' // open zip jacket over a shirt
  | 'robe' // long robe / haori reaching the thighs
  | 'armor' // chest plate with shoulder bands
  | 'shirt' // plain tee
  | 'suit' // formal suit with a tie
  | 'bare' // skin, maybe a scarf
  | 'uniform' // high-collar school uniform
  | 'coat' // long coat, open
  | 'vest' // open vest on bare chest (Luffy)
  | 'bodysuit' // one colour head to toe (aliens, Frieza)
  | 'hoodie';

export type Marking =
  | 'whiskers'
  | 'thirdEye'
  | 'scar'
  | 'xScar'
  | 'tattoo' // sukuna-style face lines
  | 'cheekMarks' // two red fangs (Inuzuka)
  | 'foreheadMark'
  | 'blindfold'
  | 'eyepatch'
  | 'glasses'
  | 'stitches'
  | 'mask' // lower-face mask (Kakashi)
  | 'lines'; // sharp lines under the eyes

/** Accessories bolted onto the model's bones. Each is a generic builder, coloured by data. */
export type AccessoryId =
  | 'headband'
  | 'strawHat'
  | 'scouter'
  | 'horns'
  | 'domeHead' // smooth bald dome cap (Frieza's final form head plate)
  | 'crown'
  | 'halo'
  | 'hood'
  | 'helmet'
  | 'bandana'
  | 'ears' // pointed animal ears
  | 'antennae'
  | 'earrings'
  | 'gourd' // gourd on the back
  | 'cape'
  | 'wings'
  | 'tail'
  | 'katana' // katana in the right hand
  | 'swordBack' // big sword across the back
  | 'dualSwords'
  | 'staff'
  | 'scythe'
  | 'chainsaw'
  | 'shoulderPads'
  | 'scarf'
  | 'fanBack' // round fan / symbol disc on the back
  | 'gauntlets';

export interface HairLook {
  readonly style: HairStyle;
  readonly color: number;
  /** Tips / streak colour, when the style has one. */
  readonly color2?: number;
}

export interface TopLook {
  readonly style: TopStyle;
  readonly color: number;
  /** Undershirt / lining / second colour. */
  readonly color2?: number;
  /** Collar, cuffs and hems. */
  readonly trim?: number;
  /** A round emblem on the chest (kanji disc, crest). */
  readonly emblem?: number;
  /** Surface pattern. */
  readonly pattern?: 'none' | 'checker' | 'flames' | 'stripes' | 'clouds' | 'spots';
  readonly patternColor?: number;
}

export interface CharacterLook {
  readonly skin: number;
  readonly hair: HairLook;
  readonly eyes: number;
  readonly eyeStyle?: EyeStyle;
  readonly top: TopLook;
  readonly pants: number;
  readonly pantsStyle?: 'plain' | 'hakama' | 'shorts';
  readonly shoes?: number;
  readonly belt?: number;
  readonly gloves?: number;
  readonly markings?: readonly Marking[];
  readonly markColor?: number;
  readonly accessories?: readonly AccessoryId[];
  /** Colours of held gear (blades, staffs, gauntlets) - and of any gear without its own colour below. */
  readonly accColor?: number;
  readonly accColor2?: number;
  /** Head gear (headbands, hats, helmets, earrings); defaults to accColor / accColor2. */
  readonly hatColor?: number;
  readonly hatColor2?: number;
  /** Capes and scarves; defaults to accColor. */
  readonly capeColor?: number;
  /** Visual scale of the body on stands and cards. */
  readonly scale?: number;
}

// -------------------------------------------------------------------- vfx

/** Ability-inspired display effects. The client maps each to a lightweight shader/particle rig. */
export type VfxKind =
  | 'none'
  | 'aura' // flickering energy column
  | 'lightning' // crackling arcs
  | 'flames' // rising fire tongues
  | 'orbit' // orbs circling
  | 'shadow' // dark smoke wisps
  | 'petals' // falling petals / leaves
  | 'frost' // ice crystals
  | 'water' // rings of water
  | 'wind' // swirling streaks
  | 'cosmic'; // stars and a halo ring

export interface VfxDef {
  readonly kind: VfxKind;
  readonly color: number;
  readonly color2?: number;
}

// ---------------------------------------------------------------- ability

/**
 * Tower abilities. The battle system understands the KIND; the data sets the
 * numbers and the flavour.
 *
 *  - burst:   every `every` attacks, hit for `power` x attack
 *  - pierce:  every `every` attacks, hit for `power` x attack and splash half to the next enemy
 *  - heal:    every `every` attacks, heal `power` x max health (and still attack)
 *  - drain:   every attack heals `power` x the damage dealt
 *  - shield:  every `every` attacks, the next hit taken is reduced by `power` (0..1)
 *  - stun:    every `every` attacks, the target skips its next attack
 *  - rage:    every `every` attacks, attack grows by `power` (x) for the rest of the fight
 */
export type AbilityKind = 'burst' | 'pierce' | 'heal' | 'drain' | 'shield' | 'stun' | 'rage';

/** How an ability looks on the card battle. */
export type AbilityFx = 'beam' | 'slash' | 'fire' | 'lightning' | 'dark' | 'punch' | 'ice' | 'water' | 'wind' | 'light';

export interface AbilityDef {
  readonly name: string;
  readonly kind: AbilityKind;
  readonly every: number;
  readonly power: number;
  readonly fx: AbilityFx;
  readonly color: number;
}

// -------------------------------------------------------------- character

export interface CharacterDef {
  /** Stable id: persisted in saves. Never rename. */
  readonly id: string;
  readonly name: string;
  /** The (parody) series the character is from, shown on the card. */
  readonly series: string;
  /** Base odds: 1 in `odds`. Luck divides it. */
  readonly odds: number;
  readonly rarity: RarityId;
  readonly role?: RoleId;
  /** Per-character tuning on top of the curve (defaults 1). */
  readonly incomeMul?: number;
  readonly statMul?: number;
  readonly ability?: AbilityDef;
  readonly look: CharacterLook;
  readonly vfx: VfxDef;
  /** Overrides the tier's obtain animation. */
  readonly obtain?: ObtainStyle;
  /** Card background colours (top, bottom). Defaults come from the rarity. */
  readonly card?: readonly [number, number];
}
