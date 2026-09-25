import { cssColor } from '@dice/shared';

/**
 * Inline SVG glyphs for everything the supplied icons do not cover: the big
 * white die of the ROLL button, luck's clover, the heart and blade of the tower
 * cards, potion flasks in any colour, a lock and a castle. A few hundred bytes
 * each, no files.
 */

/** The ROLL button's die, like the reference: a white cube with navy pips. */
export const DICE_SVG =
  '<svg viewBox="0 0 120 120" class="dice-icon" aria-hidden="true">' +
  '<path d="M60 8 106 32v52L60 110 14 84V32z" fill="#dfe3f5" stroke="#16181f" stroke-width="6" stroke-linejoin="round"/>' +
  '<path d="M60 8 106 32 60 56 14 32z" fill="#ffffff" stroke="#16181f" stroke-width="5" stroke-linejoin="round"/>' +
  '<path d="M60 56v54L14 84V32z" fill="#eef0fa" stroke="#16181f" stroke-width="5" stroke-linejoin="round"/>' +
  '<g fill="#2a3490"><ellipse cx="60" cy="32" rx="7" ry="4"/>' +
  '<ellipse cx="26" cy="50" rx="4.5" ry="6"/><ellipse cx="46" cy="82" rx="4.5" ry="6"/><ellipse cx="36" cy="66" rx="4.5" ry="6"/>' +
  '<ellipse cx="74" cy="66" rx="4.5" ry="6"/><ellipse cx="94" cy="50" rx="4.5" ry="6"/><ellipse cx="74" cy="90" rx="4.5" ry="6"/><ellipse cx="94" cy="76" rx="4.5" ry="6"/></g></svg>';

export const CLOVER_SVG =
  '<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="#3fcf5a" stroke="#16181f" stroke-width="3">' +
  '<circle cx="22" cy="22" r="12"/><circle cx="42" cy="22" r="12"/><circle cx="22" cy="40" r="12"/><circle cx="42" cy="40" r="12"/></g>' +
  '<path d="M32 34 40 58" stroke="#16181f" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="31" r="6" fill="#7dff8a"/></svg>';

export const HEART_SVG =
  '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 56S6 40 6 22C6 12 14 6 22 6c5 0 8 3 10 6 2-3 5-6 10-6 8 0 16 6 16 16 0 18-26 34-26 34z" fill="#ff4a6a" stroke="#16181f" stroke-width="4"/><circle cx="20" cy="20" r="5" fill="#ffb0c0"/></svg>';

export const SWORD_SVG =
  '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M50 6 58 14 24 48 16 40z" fill="#8fd4ff" stroke="#16181f" stroke-width="4" stroke-linejoin="round"/>' +
  '<path d="M12 36 28 52" stroke="#16181f" stroke-width="7" stroke-linecap="round"/><path d="M12 36 28 52" stroke="#ffb030" stroke-width="3" stroke-linecap="round"/>' +
  '<path d="M16 48 6 58" stroke="#16181f" stroke-width="8" stroke-linecap="round"/><path d="M16 48 6 58" stroke="#c07a3a" stroke-width="4" stroke-linecap="round"/></svg>';

export const LOCK_SVG =
  '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 28v-8a14 14 0 0 1 28 0v8" fill="none" stroke="#16181f" stroke-width="10"/>' +
  '<path d="M18 28v-8a14 14 0 0 1 28 0v8" fill="none" stroke="#c9ced8" stroke-width="5"/>' +
  '<rect x="10" y="26" width="44" height="32" rx="8" fill="#ffc233" stroke="#16181f" stroke-width="4"/><circle cx="32" cy="41" r="5" fill="#16181f"/></svg>';

export const CASTLE_SVG =
  '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 58V22h8v6h8v-6h16v6h8v-6h8v36z" fill="#dfe6f6" stroke="#16181f" stroke-width="4" stroke-linejoin="round"/>' +
  '<path d="M26 58V44a6 6 0 0 1 12 0v14z" fill="#3a4a8f" stroke="#16181f" stroke-width="3"/><path d="M20 8h24v14H20z" fill="#c9d3f0" stroke="#16181f" stroke-width="4"/></svg>';

export const BOOK_SVG =
  '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 12c10-4 18-4 24 2 6-6 14-6 24-2v42c-10-4-18-4-24 2-6-6-14-6-24-2z" fill="#ffd23a" stroke="#16181f" stroke-width="4" stroke-linejoin="round"/>' +
  '<path d="M32 14v42" stroke="#16181f" stroke-width="4"/><path d="M14 22h12M14 30h12M38 22h12M38 30h12" stroke="#b07a10" stroke-width="3"/></svg>';

export const STAR_SVG =
  '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 4 40 24 60 24 44 37 50 58 32 45 14 58 20 37 4 24 24 24z" fill="#ffd23a" stroke="#16181f" stroke-width="4" stroke-linejoin="round"/></svg>';

/** A potion bottle in the potion's colours; tier 3 is a crystal. */
export const potionSvg = (color: number, color2: number, tier: number): string => {
  const c = cssColor(color);
  const d = cssColor(color2);
  if (tier >= 3) {
    return (
      '<svg viewBox="0 0 64 64" class="dice-flask" aria-hidden="true">' +
      `<path d="M32 4 54 22 32 60 10 22z" fill="${c}" stroke="#16181f" stroke-width="4" stroke-linejoin="round"/>` +
      `<path d="M32 4 42 22 32 60 22 22z" fill="${d}" opacity=".55"/><path d="M10 22h44" stroke="#16181f" stroke-width="3"/>` +
      '<path d="M22 12 28 8" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/></svg>'
    );
  }
  const big = tier === 2;
  return (
    '<svg viewBox="0 0 64 64" class="dice-flask" aria-hidden="true">' +
    `<rect x="24" y="${big ? 4 : 8}" width="16" height="10" rx="3" fill="#f4e6c8" stroke="#16181f" stroke-width="3"/>` +
    `<path d="M26 14v8C${big ? '8 28 6 40 8 48' : '14 30 12 40 14 48'}c2 8 12 12 18 12s16-4 18-12c${big ? '2-8 0-20-18-26' : '2-8 0-18-12-26'}v-8z" fill="${c}" stroke="#16181f" stroke-width="4" stroke-linejoin="round"/>` +
    `<path d="M${big ? 12 : 16} 40c6 4 34 4 40 0" stroke="${d}" stroke-width="5" fill="none"/>` +
    '<ellipse cx="24" cy="36" rx="4" ry="8" fill="#fff" opacity=".45"/>' +
    (big ? '<path d="M20 14 14 8M44 14 50 8" stroke="#16181f" stroke-width="4" stroke-linecap="round"/>' : '') +
    '</svg>'
  );
};

/** The upgrade tree's glyph per icon name. */
export const upgradeGlyph = (icon: string): string => {
  switch (icon) {
    case 'bills':
      return '<img class="dice-icon" src="/ui/Bills.png" alt="" draggable="false" />';
    case 'backpack':
      return '<img class="dice-icon" src="/ui/inventory.png" alt="" draggable="false" />';
    case 'sword':
      return SWORD_SVG;
    case 'clover':
      return CLOVER_SVG;
    case 'heart':
      return HEART_SVG;
    case 'dice':
      return DICE_SVG;
    case 'potion':
      return potionSvg(0x6aff5a, 0x1f9e3a, 1);
    case 'star':
      return STAR_SVG;
    default:
      return STAR_SVG;
  }
};
