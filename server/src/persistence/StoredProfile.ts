import {
  DISPLAY_SLOTS,
  ECONOMY,
  TEAM_SIZE,
  UNIT_LEVEL,
  isCharacterId,
  isPotionId,
  isUpgradeId,
  type UnitRecord,
} from '@dice/shared';

/**
 * The facts of a player's progression that outlive a session. Everything a
 * session shows (Cash/s, Luck, capacity, stats) is DERIVED from these by the
 * shared formulas, so none of it is stored.
 */
export interface ProgressFields {
  cash: number;
  /** Cash earned, ever: the Money board. */
  lifetimeCash: number;
  rebirths: number;
  totalRolls: number;
  /** The rarest odds ever pulled (the "1 in N" of the best unit): the Rarest board. */
  bestOdds: number;
  towerBest: number;
  towerWins: number;
  /** Bitmask of rarity indices auto-sold as they are rolled. */
  autoSell: number;
  /** The next unit uid to hand out. */
  nextUid: number;
  playSeconds: number;
  units: UnitRecord[];
  /** DISPLAY_SLOTS unit uids (0 = empty). */
  display: number[];
  /** TEAM_SIZE unit uids (0 = empty). */
  team: number[];
  /** Potion id -> count held (not yet drunk). */
  potions: Record<string, number>;
  /** Upgrade id -> level. */
  upgrades: Record<string, number>;
  /** Character ids ever obtained. */
  discovered: string[];
}

/** What one save writes. */
export interface ProfileFields extends ProgressFields {
  /** The portal's display name and portrait as last seen. Cleared when empty. */
  displayName: string;
  avatarUrl: string;
  /** Wall clock of the save. */
  updatedAt: number;
}

/**
 * The first-login migration's bookkeeping: an ACCOUNT profile created from a
 * browser's guest progress carries `migratedFrom`; that guest profile is then
 * retired with `migratedTo`, `migratedAt` and a recovery `migratedSnapshot`.
 */
export interface MigrationFields {
  migratedFrom?: string;
  migratedTo?: string;
  migratedAt?: number;
  migratedSnapshot?: ProgressFields;
}

/**
 * A profile as READ from storage. Beyond the fields this build knows, it may
 * carry any field a newer or older build wrote: those are kept and written
 * back untouched, never dropped.
 */
export type StoredProfile = ProfileFields & MigrationFields & { [field: string]: unknown };

/** Just what the leaderboards read - a projection, so the board cache never holds inventories. */
export interface BoardRow {
  displayName: string;
  avatarUrl: string;
  lifetimeCash: number;
  totalRolls: number;
  bestOdds: number;
  updatedAt: number;
  migratedTo?: string;
}

export const BOARD_FIELDS = ['displayName', 'avatarUrl', 'lifetimeCash', 'totalRolls', 'bestOdds', 'updatedAt', 'migratedTo'] as const;

const NUMERIC_KEYS = [
  'cash',
  'lifetimeCash',
  'rebirths',
  'totalRolls',
  'bestOdds',
  'towerBest',
  'towerWins',
  'autoSell',
  'nextUid',
  'playSeconds',
] as const satisfies readonly (keyof ProgressFields)[];

/** Optional string fields a save may CLEAR. The only fields ever $unset. */
export const CLEARABLE_FIELDS = ['displayName', 'avatarUrl'] as const;

/** Most units a profile may hold, whatever the capacity says (a corrupt save cannot grow without bound). */
const MAX_STORED_UNITS = 2500;

const numeric = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0);

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const count = (value: unknown): number => Math.floor(numeric(value));

/** A save's units, with anything malformed dropped and every field clamped. */
const unitRecords = (value: unknown): UnitRecord[] => {
  if (!Array.isArray(value)) return [];
  const out: UnitRecord[] = [];
  const seen = new Set<number>();
  for (const entry of value.slice(0, MAX_STORED_UNITS)) {
    if (!entry || typeof entry !== 'object') continue;
    const raw = entry as Record<string, unknown>;
    const uid = count(raw['u']);
    const charId = raw['c'];
    if (uid <= 0 || seen.has(uid) || !isCharacterId(charId)) continue;
    seen.add(uid);
    const level = Math.max(1, Math.min(UNIT_LEVEL.max, count(raw['l']) || 1));
    const potions: Record<string, number> = {};
    const rawPotions = raw['p'];
    if (rawPotions && typeof rawPotions === 'object') {
      for (const [id, n] of Object.entries(rawPotions as Record<string, unknown>)) {
        const amount = count(n);
        if (isPotionId(id) && amount > 0) potions[id] = Math.min(999, amount);
      }
    }
    out.push({ u: uid, c: charId, l: level, p: potions, k: raw['k'] === true });
  }
  return out;
};

/** A fixed-length list of uids, each either one of `valid` or 0, no duplicates. */
const slots = (value: unknown, length: number, valid: ReadonlySet<number>): number[] => {
  const out = new Array<number>(length).fill(0);
  if (!Array.isArray(value)) return out;
  const used = new Set<number>();
  for (let i = 0; i < length; i += 1) {
    const uid = count(value[i]);
    if (uid > 0 && valid.has(uid) && !used.has(uid)) {
      out[i] = uid;
      used.add(uid);
    }
  }
  return out;
};

const counts = (value: unknown, isKnown: (id: string) => boolean, cap: number): Record<string, number> => {
  const out: Record<string, number> = {};
  if (!value || typeof value !== 'object') return out;
  for (const [id, n] of Object.entries(value as Record<string, unknown>)) {
    const amount = count(n);
    if (isKnown(id) && amount > 0) out[id] = Math.min(cap, amount);
  }
  return out;
};

const idList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value.slice(0, 1000)) if (isCharacterId(entry) && !out.includes(entry)) out.push(entry);
  return out;
};

export const emptyProgress = (): ProgressFields => ({
  cash: ECONOMY.startingCash,
  lifetimeCash: 0,
  rebirths: 0,
  totalRolls: 0,
  bestOdds: 0,
  towerBest: 0,
  towerWins: 0,
  autoSell: 0,
  nextUid: 1,
  playSeconds: 0,
  units: [],
  display: new Array<number>(DISPLAY_SLOTS).fill(0),
  team: new Array<number>(TEAM_SIZE).fill(0),
  potions: {},
  upgrades: {},
  discovered: [],
});

/** Just the progression of a profile, coerced. */
export const progressOf = (source: Partial<ProgressFields>): ProgressFields => {
  const out = emptyProgress();
  const raw = source as Record<string, unknown>;
  for (const key of NUMERIC_KEYS) out[key] = numeric(raw[key]);
  // A profile that never stored cash is a new one: it gets the starting cash.
  if (raw['cash'] === undefined) out.cash = ECONOMY.startingCash;
  out.rebirths = Math.floor(out.rebirths);
  out.autoSell = Math.floor(out.autoSell) & 0xff;
  out.units = unitRecords(raw['units']);
  const uids = new Set(out.units.map((unit) => unit.u));
  let next = Math.max(1, Math.floor(out.nextUid));
  for (const uid of uids) if (uid >= next) next = uid + 1;
  out.nextUid = next;
  out.display = slots(raw['display'], DISPLAY_SLOTS, uids);
  out.team = slots(raw['team'], TEAM_SIZE, uids);
  out.potions = counts(raw['potions'], isPotionId, 1_000_000);
  out.upgrades = counts(raw['upgrades'], isUpgradeId, 10_000);
  out.discovered = idList(raw['discovered']);
  for (const unit of out.units) if (!out.discovered.includes(unit.c)) out.discovered.push(unit.c);
  return out;
};

/** Coerce whatever storage held into a profile, KEEPING every unknown field. */
export const coerceProfile = (raw: unknown): StoredProfile | null => {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const profile: StoredProfile = {
    ...source,
    ...progressOf(source as Partial<ProgressFields>),
    displayName: text(source['displayName']),
    avatarUrl: text(source['avatarUrl']),
    updatedAt: numeric(source['updatedAt']),
  };
  if (typeof source['migratedFrom'] !== 'string') delete profile.migratedFrom;
  if (typeof source['migratedTo'] !== 'string') delete profile.migratedTo;
  if (typeof source['migratedAt'] !== 'number') delete profile.migratedAt;
  if (source['migratedSnapshot'] && typeof source['migratedSnapshot'] === 'object') {
    profile.migratedSnapshot = progressOf(source['migratedSnapshot'] as Partial<ProgressFields>);
  } else {
    delete profile.migratedSnapshot;
  }
  return profile;
};

/** A board row from whatever storage held (a full profile or a projection). */
export const coerceBoardRow = (raw: unknown): BoardRow | null => {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const row: BoardRow = {
    displayName: text(source['displayName']),
    avatarUrl: text(source['avatarUrl']),
    lifetimeCash: numeric(source['lifetimeCash']),
    totalRolls: numeric(source['totalRolls']),
    bestOdds: numeric(source['bestOdds']),
    updatedAt: numeric(source['updatedAt']),
  };
  if (typeof source['migratedTo'] === 'string') row.migratedTo = source['migratedTo'];
  return row;
};

/**
 * Whether a profile holds anything worth carrying into an account. A player
 * who opened the game and stood still has nothing to migrate.
 */
export const hasProgress = (p: ProgressFields): boolean =>
  p.totalRolls > 0 || p.units.length > 0 || p.rebirths > 0 || p.lifetimeCash > 0 || p.towerWins > 0;
