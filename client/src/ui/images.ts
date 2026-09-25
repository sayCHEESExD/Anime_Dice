/**
 * The supplied HUD icons (`assets/ui/*.png`), decoded once and shared by the
 * DOM (as URLs) and by canvas labels (as images).
 */
export const ICON_URL = {
  backpack: '/ui/inventory.png',
  upgrades: '/ui/Upgrades.png',
  rebirth: '/ui/rebirth.png',
  cash: '/ui/Bills.png',
  sword: '/ui/Katana.png',
  shop: '/ui/shop.png',
  sound: '/ui/Sound.png',
} as const;

export type IconName = keyof typeof ICON_URL;

const images = new Map<IconName, HTMLImageElement>();
const waiters = new Map<IconName, (() => void)[]>();

/** The decoded icon, or null while loading (the callback fires once when it lands). */
export const iconImage = (name: IconName, onReady?: () => void): HTMLImageElement | null => {
  let image = images.get(name);
  if (!image) {
    image = new Image();
    image.decoding = 'async';
    const created = image;
    created.addEventListener('load', () => {
      for (const wake of waiters.get(name) ?? []) wake();
      waiters.delete(name);
    });
    created.src = ICON_URL[name];
    images.set(name, created);
  }
  if (image.complete && image.naturalWidth > 0) return image;
  if (onReady) {
    const list = waiters.get(name) ?? [];
    list.push(onReady);
    waiters.set(name, list);
  }
  return null;
};
