import { UPGRADES, formatCash, roman, upgradeCost, upgradeLevel, type UpgradeId } from '@dice/shared';
import type { NetworkClient } from '../net/NetworkClient.js';
import type { PlayerStore } from '../state/PlayerStore.js';
import { upgradeGlyph } from './glyphs.js';
import { ICON_URL } from './images.js';
import { GameWindow, el } from './Window.js';

/** Where each upgrade's hex sits around the Start hex, in design units (flat-top hex grid). */
const HEX_AT: Readonly<Record<UpgradeId, readonly [number, number]>> = {
  money: [-158, -92],
  luck: [158, -92],
  storage: [-158, 92],
  damage: [0, 184],
  health: [-316, -184],
  rollSpeed: [316, -184],
  potionLuck: [-316, 184],
  crit: [316, 92],
};

/**
 * THE UPGRADE TREE, laid out as the reference's honeycomb: Start in the middle,
 * Money, Luck, Unit Storage and Damage around it, and the rebirth-locked
 * upgrades as "?" hexes further out until they open. Each hex shows the NEXT
 * level and its price; a tap is a purchase request.
 */
export class UpgradesWindow extends GameWindow {
  private readonly hexes: HTMLDivElement;
  private drawn = -1;

  constructor(
    container: HTMLElement,
    private readonly store: PlayerStore,
    private readonly net: NetworkClient,
  ) {
    super(container, {
      title: 'Upgrades',
      icon: `<img class="dice-icon" src="${ICON_URL.upgrades}" alt="" />`,
      head: ['#4fd35a', '#25a33a'],
      width: 900,
    });
    this.hexes = el('div', 'dice-hexes');
    this.body.append(this.hexes);
    this.foot.append(el('div', 'dice-out', 'Upgrades are permanent - they survive every rebirth.'));
    this.foot.style.justifyContent = 'center';
    store.onChange(() => {
      if (this.isOpen) this.render();
    });
  }

  protected override onOpen(): void {
    this.drawn = -1;
    this.render();
  }

  /** True when an upgrade the player can afford is waiting (for the HUD badge). */
  get affordable(): boolean {
    const stats = this.store.stats;
    return UPGRADES.some((upgrade) => stats.rebirths >= upgrade.unlockRebirths && stats.cash >= upgradeCost(upgrade.id, upgradeLevel(this.store.private.upgrades, upgrade.id)));
  }

  private render(): void {
    if (this.drawn === this.store.version) return;
    this.drawn = this.store.version;
    this.hexes.replaceChildren();
    const start = this.hex(0, 0, 'dice-hex dice-hex--start', '<div class="dice-hex__glyph">&#127795;</div><div class="dice-hex__name dice-out">Start</div>');
    this.hexes.append(start);
    const stats = this.store.stats;
    for (const upgrade of UPGRADES) {
      const [x, y] = HEX_AT[upgrade.id];
      const level = upgradeLevel(this.store.private.upgrades, upgrade.id);
      if (stats.rebirths < upgrade.unlockRebirths) {
        this.hexes.append(
          this.hex(x, y, 'dice-hex dice-hex--locked', `<div class="dice-hex__glyph dice-out" style="font-size:calc(70 * var(--u))">?</div><div class="dice-hex__effect">Rebirth ${upgrade.unlockRebirths}</div>`),
        );
        continue;
      }
      const cost = upgradeCost(upgrade.id, level);
      const maxed = !Number.isFinite(cost);
      const ready = !maxed && stats.cash >= cost;
      const node = this.hex(
        x,
        y,
        `dice-hex${ready ? ' dice-hex--ready' : ''}`,
        `<div class="dice-hex__glyph">${upgradeGlyph(upgrade.icon)}</div>` +
          `<div class="dice-hex__name dice-out">${upgrade.name} ${roman(level + 1)}</div>` +
          (maxed
            ? '<div class="dice-hex__cost dice-out">MAX</div>'
            : `<div class="dice-hex__cost dice-out"><img src="${ICON_URL.cash}" alt="" />${formatCash(cost).slice(1)}</div>`) +
          `<div class="dice-hex__effect">${level > 0 ? upgrade.describe(level) : upgrade.describe(1)}</div>`,
      );
      node.title = `${upgrade.name}: ${upgrade.describe(level + 1)} at level ${level + 1}`;
      node.addEventListener('click', () => this.net.upgrade(upgrade.id));
      this.hexes.append(node);
    }
  }

  private hex(x: number, y: number, className: string, html: string): HTMLDivElement {
    const node = el('div', `dice ${className}`);
    node.style.left = `calc(50% + ${x} * var(--u))`;
    node.style.top = `calc(50% + ${y - 20} * var(--u))`;
    node.innerHTML = `<div class="dice-hex__inner">${html}</div>`;
    return node;
  }
}
