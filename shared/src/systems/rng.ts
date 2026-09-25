/** A random source: returns [0, 1). */
export type Random = () => number;

/**
 * Mulberry32: a tiny seeded generator. Battles are seeded so the log a client
 * plays back is exactly the fight the server resolved.
 */
export const seededRandom = (seed: number): Random => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Pick from weighted entries. */
export const weightedPick = <T extends { readonly weight: number }>(entries: readonly T[], random: Random): T | undefined => {
  let total = 0;
  for (const entry of entries) total += Math.max(0, entry.weight);
  if (total <= 0) return entries[0];
  let roll = random() * total;
  for (const entry of entries) {
    roll -= Math.max(0, entry.weight);
    if (roll < 0) return entry;
  }
  return entries[entries.length - 1];
};
