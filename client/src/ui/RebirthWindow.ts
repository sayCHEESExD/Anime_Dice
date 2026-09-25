import { REBIRTH, formatAmount, formatCash, formatMultiplier, openDisplaySlots, rebirthCost } from '@dice/shared';
import type { NetworkClient } from '../net/NetworkClient.js';
import type { PlayerStore } from '../state/PlayerStore.js';
import { CLOVER_SVG } from './glyphs.js';
import { ICON_URL } from './images.js';
import { GameWindow, button, el } from './Window.js';

/**
 * REBIRTH, as in the reference: this rebirth's Luck and Cash multipliers, an
 * arrow, the next one's, the warning that Cash resets, the progress bar toward
 * the price, and the button. The server decides.
 */
export class RebirthWindow extends GameWindow {
  private readonly content: HTMLDivElement;
  private readonly action: HTMLButtonElement;
  private drawn = -1;

  constructor(
    container: HTMLElement,
    private readonly store: PlayerStore,
    private readonly net: NetworkClient,
  ) {
    super(container, {
      title: 'Rebirth',
      icon: `<img class="dice-icon" src="${ICON_URL.rebirth}" alt="" />`,
      head: ['#f4f4f8', '#cfd4e2'],
      width: 760,
    });
    this.title.style.color = '#fff';
    this.content = el('div', 'dice-rebirth');
    this.body.append(this.content);
    this.action = button('Rebirth', 'grey', () => this.net.rebirth());
    this.foot.style.justifyContent = 'center';
    this.foot.append(this.action);
    store.onChange(() => {
      if (this.isOpen) this.render();
    });
  }

  protected override onOpen(): void {
    this.drawn = -1;
    this.render();
  }

  /** 0..1 progress toward the next rebirth. */
  get progress(): number {
    const cost = rebirthCost(this.store.stats.rebirths);
    return Number.isFinite(cost) ? Math.min(1, this.store.stats.cash / cost) : 0;
  }

  get eligible(): boolean {
    return this.progress >= 1;
  }

  private render(): void {
    if (this.drawn === this.store.version) return;
    this.drawn = this.store.version;
    const r = this.store.stats.rebirths;
    const cost = rebirthCost(r);
    const now = 1 + REBIRTH.luckPerRebirth * r;
    const next = 1 + REBIRTH.luckPerRebirth * (r + 1);
    const cashNow = 1 + REBIRTH.cashPerRebirth * r;
    const cashNext = 1 + REBIRTH.cashPerRebirth * (r + 1);
    const pct = Math.floor(this.progress * 100);
    const slotsNow = openDisplaySlots(r);
    const slotsNext = openDisplaySlots(r + 1);
    this.content.innerHTML =
      `<div class="dice-rebirth__row"><div class="dice-rebirth__box dice-out">${CLOVER_SVG.replace('<svg', '<svg class="glyph"')} ${formatMultiplier(now)} Luck</div><div class="dice-rebirth__arrow dice-out">&#10140;</div><div class="dice-rebirth__box dice-out">${CLOVER_SVG.replace('<svg', '<svg class="glyph"')} ${formatMultiplier(next)} Luck</div></div>` +
      `<div class="dice-rebirth__row"><div class="dice-rebirth__box dice-out"><img src="${ICON_URL.cash}" alt="" /> ${formatMultiplier(cashNow)} Cash</div><div class="dice-rebirth__arrow dice-out">&#10140;</div><div class="dice-rebirth__box dice-out"><img src="${ICON_URL.cash}" alt="" /> ${formatMultiplier(cashNext)} Cash</div></div>` +
      (slotsNext > slotsNow ? `<div class="dice-rebirth__unlock dice-out">Unlocks display stand ${slotsNext} on your plot</div>` : '') +
      `<div class="dice-rebirth__warn dice-out">Rebirthing resets your cash!</div>` +
      `<div class="dice-progress"><div class="dice-progress__fill" style="width:${pct}%"></div><div class="dice-progress__text dice-out">${formatCash(this.store.stats.cash)}/${Number.isFinite(cost) ? formatAmount(cost) : 'MAX'}</div></div>` +
      `<div class="dice-rebirth__unlock" style="color:#b8c0d8">Units, levels, potions, upgrades and tower progress are kept.</div>`;
    this.action.className = `dice-btn dice-out ${this.eligible ? '' : 'dice-btn--grey'}`;
    this.action.textContent = r >= REBIRTH.max ? 'Max Rebirth' : `Rebirth ${r + 1}`;
  }
}
