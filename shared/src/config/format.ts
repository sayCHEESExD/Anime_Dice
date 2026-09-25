/**
 * Number formatting shared by the HUD, the world signs, the cards and the
 * boards, so a figure reads the same everywhere it appears.
 */

const SUFFIXES: readonly [number, string][] = [
  [1e33, 'Dc'],
  [1e30, 'No'],
  [1e27, 'Oc'],
  [1e24, 'Sp'],
  [1e21, 'Sx'],
  [1e18, 'Qi'],
  [1e15, 'Qa'],
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

/** Compact display: 940, 1.4K, 13.2K, 453K, 3.1M, 2.5B. Truncated, never rounded up. */
export const formatAmount = (value: number): string => {
  const amount = Number.isFinite(value) ? Math.max(0, value) : 0;
  for (const [divisor, suffix] of SUFFIXES) {
    if (amount >= divisor) {
      const scaled = amount / divisor;
      const text = scaled >= 100 ? Math.floor(scaled).toString() : (Math.floor(scaled * 10) / 10).toString();
      return `${text}${suffix}`;
    }
  }
  return Math.floor(amount).toString();
};

/** Cash: exact with separators under 100K, compact past it. */
export const formatCash = (value: number): string => {
  const amount = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return amount < 100_000 ? `$${amount.toLocaleString('en-US')}` : `$${formatAmount(amount)}`;
};

/** Income per second: "$17/s", "$1.2K/s", and a decimal for small fractional figures. */
export const formatRate = (value: number): string => {
  const amount = Number.isFinite(value) ? Math.max(0, value) : 0;
  if (amount < 10 && amount % 1 !== 0) return `$${(Math.floor(amount * 10) / 10).toString()}/s`;
  return `$${formatAmount(amount)}/s`;
};

/** A combat stat: one decimal under 100, compact above. */
export const formatStat = (value: number): string => {
  const amount = Number.isFinite(value) ? Math.max(0, value) : 0;
  if (amount < 100) return (Math.floor(amount * 10) / 10).toString();
  return formatAmount(amount);
};

/** Odds: "1 in 52", "1 in 9.5K", "1 in 2.5M". */
export const formatOdds = (odds: number): string => {
  if (!Number.isFinite(odds) || odds <= 0) return '1 in ?';
  if (odds < 1_000) return `1 in ${Math.round(odds)}`;
  return `1 in ${formatAmount(odds)}`;
};

/** A multiplier as the menus print it: 1x, 1.5x, 2.25x. */
export const formatMultiplier = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded}x`;
};

const ROMAN: readonly [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

/** Roman numerals for upgrade tiers: 1 -> I, 4 -> IV. */
export const roman = (value: number): string => {
  let n = Math.max(1, Math.floor(value));
  let out = '';
  for (const [amount, symbol] of ROMAN) {
    while (n >= amount) {
      out += symbol;
      n -= amount;
    }
  }
  return out;
};
