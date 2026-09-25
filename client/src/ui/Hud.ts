import { DICE, RARITIES, cssColor, formatCash, formatMultiplier, formatRate } from '@dice/shared';
import { injectDiceStyles } from './diceStyles.js';
import { BOOK_SVG, CASTLE_SVG, CLOVER_SVG, DICE_SVG } from './glyphs.js';
import { ICON_URL } from './images.js';
import { button, el } from './Window.js';

export type ToastKind = 'good' | 'bad' | 'info' | 'gold' | 'rebirth' | 'levelup';

export interface HudActions {
  roll(): void;
  toggleAuto(): void;
  backpack(): void;
  upgrades(): void;
  rebirth(): void;
  tower(): void;
  index(): void;
  music(): boolean;
  setAutoSell(mask: number): void;
}

/** One rail / corner tile. */
class Tile {
  readonly node: HTMLButtonElement;
  private readonly badge: HTMLDivElement;

  constructor(parent: HTMLElement, label: string, art: string, colors: readonly [string, string], key: string, onPress: () => void) {
    this.node = el('button', 'dice-tile');
    this.node.type = 'button';
    this.node.style.setProperty('--a', colors[0]);
    this.node.style.setProperty('--b', colors[1]);
    this.node.innerHTML = `${art}<span class="dice-tile__label dice-out">${label}</span>${key ? `<span class="dice-tile__key">${key}</span>` : ''}`;
    this.badge = el('div', 'dice-badge dice-out', '!');
    this.badge.hidden = true;
    this.node.append(this.badge);
    this.node.addEventListener('click', onPress);
    parent.append(this.node);
  }

  setBadge(text: string | null): void {
    this.badge.hidden = text === null;
    if (text !== null) this.badge.textContent = text;
  }
}

/**
 * THE HUD, laid out like the reference: Cash and Cash/s top-left with the Luck
 * and Rebirth chips, the rail on the left (Rebirth, Tower, Index), the big
 * BACKPACK / ROLL / UPGRADES bar bottom-centre with AUTO over the die, music in
 * the corner, a hint line at the top and toasts under it. Every number it
 * shows is the server's.
 */
export class Hud {
  readonly root: HTMLDivElement;
  private readonly cashValue: HTMLDivElement;
  private readonly cashRate: HTMLDivElement;
  private readonly luck: HTMLDivElement;
  private readonly rebirthChip: HTMLDivElement;
  private readonly hint: HTMLDivElement;
  private readonly toasts: HTMLDivElement;
  private readonly rollButton: HTMLButtonElement;
  private readonly autoButton: HTMLButtonElement;
  private readonly rollCost: HTMLDivElement;
  private readonly popover: HTMLDivElement;
  readonly rebirthTile: Tile;
  readonly towerTile: Tile;
  readonly upgradesBadge: HTMLDivElement;
  readonly backpackBadge: HTMLDivElement;
  private readonly musicTile: Tile;
  private shownCash = 0;
  private targetCash = 0;
  private autoMask = 0;

  constructor(container: HTMLElement, private readonly actions: HudActions) {
    injectDiceStyles();
    this.root = el('div', 'dice dice-hud');
    container.append(this.root);

    const cash = el('div', 'dice-cash');
    const icon = el('div', 'dice-cash__icon', `<img class="dice-icon" src="${ICON_URL.cash}" alt="" />`);
    this.cashValue = el('div', 'dice-cash__value dice-out', '$0');
    this.cashRate = el('div', 'dice-cash__rate dice-out', '+$0/s');
    cash.append(icon, this.cashValue, this.cashRate);
    const chips = el('div', 'dice-chips');
    this.luck = el('div', 'dice-chip dice-out', '');
    this.rebirthChip = el('div', 'dice-chip dice-chip--rebirth dice-out', '');
    chips.append(this.luck, this.rebirthChip);

    const rail = el('div', 'dice-rail');
    this.rebirthTile = new Tile(rail, 'Rebirth', `<img class="dice-icon" src="${ICON_URL.rebirth}" alt="" />`, ['#ff8ad0', '#c8327a'], 'R', () => actions.rebirth());
    this.towerTile = new Tile(rail, 'Team', `<img class="dice-icon" src="${ICON_URL.sword}" alt="" />`, ['#6fdc6a', '#279e3a'], 'T', () => actions.tower());
    new Tile(rail, 'Index', BOOK_SVG.replace('<svg', '<svg class="dice-icon"'), ['#ffd966', '#e09a10'], 'I', () => actions.index());

    const bar = el('div', 'dice-bar');
    const backpack = this.big('BACKPACK', `<img class="dice-icon" src="${ICON_URL.backpack}" alt="" />`, () => actions.backpack(), 'B');
    this.backpackBadge = el('div', 'dice-badge dice-out', '!');
    this.backpackBadge.hidden = true;
    backpack.append(this.backpackBadge);
    this.rollButton = this.big('ROLL', DICE_SVG, () => actions.roll(), 'E');
    this.rollButton.classList.add('dice-big--roll');
    this.rollCost = el('div', 'dice-rollcost dice-out', `${formatCash(DICE.cost)} / roll`);
    this.autoButton = button('AUTO', 'grey dice-btn--small dice-auto', (event?: unknown) => {
      void event;
      actions.toggleAuto();
    });
    this.autoButton.addEventListener('click', (event) => event.stopPropagation());
    // Its hotkey, badged like every other button's (hidden in touch mode).
    this.autoButton.insertAdjacentHTML('beforeend', '<span class="dice-tile__key">Q</span>');
    const autoSell = button('SELL&#9662;', 'red dice-btn--small dice-autosell-btn', () => {
      this.popover.hidden = !this.popover.hidden;
    });
    autoSell.addEventListener('click', (event) => event.stopPropagation());
    autoSell.title = 'Auto-sell rarities as they are rolled';
    const rollWrap = el('div');
    rollWrap.style.position = 'relative';
    rollWrap.append(this.rollButton, this.autoButton, autoSell, this.rollCost);
    const upgrades = this.big('UPGRADES', `<img class="dice-icon" src="${ICON_URL.upgrades}" alt="" />`, () => actions.upgrades(), 'U');
    this.upgradesBadge = el('div', 'dice-badge dice-out', '!');
    this.upgradesBadge.hidden = true;
    upgrades.append(this.upgradesBadge);
    bar.append(backpack, rollWrap, upgrades);

    this.popover = el('div', 'dice dice-popover');
    this.popover.hidden = true;
    this.buildPopover();

    const corner = el('div', 'dice-corner');
    this.musicTile = new Tile(corner, '', `<img class="dice-icon" src="${ICON_URL.sound}" alt="" />`, ['#6fb8ff', '#2f7ae0'], 'M', () => {
      this.musicTile.node.classList.toggle('is-off', !actions.music());
    });

    this.hint = el('div', 'dice-hint dice-out');
    this.toasts = el('div', 'dice-toasts');
    // Cash, the chips and the rail stand together as ONE column at the left
    // middle, so the figures sit right above the buttons they go with.
    const left = el('div', 'dice-left');
    left.append(cash, chips, rail);
    this.root.append(left, bar, this.popover, corner, this.hint, this.toasts);
    void CLOVER_SVG;
  }

  private big(label: string, art: string, onPress: () => void, key: string): HTMLButtonElement {
    const node = el('button', 'dice-big');
    node.type = 'button';
    node.innerHTML = `<div class="dice-big__art">${art}</div><div class="dice-big__label dice-out">${label}</div>${key ? `<span class="dice-tile__key" style="top:0;left:0">${key}</span>` : ''}`;
    node.addEventListener('click', onPress);
    return node;
  }

  private buildPopover(): void {
    this.popover.replaceChildren();
    this.popover.append(el('h3', 'dice-out', 'Auto-Sell'));
    RARITIES.forEach((rarity) => {
      const label = el('label', 'dice-out');
      const name = el('span', '', rarity.name);
      name.style.color = cssColor(rarity.color);
      const box = el('input');
      box.type = 'checkbox';
      box.checked = (this.autoMask & (1 << rarity.index)) !== 0;
      box.addEventListener('change', () => {
        const mask = box.checked ? this.autoMask | (1 << rarity.index) : this.autoMask & ~(1 << rarity.index);
        this.actions.setAutoSell(mask);
      });
      label.append(name, box);
      this.popover.append(label);
    });
    this.popover.append(el('small', '', 'Rolled units of ticked rarities are sold on the spot. New discoveries are always kept.'));
  }

  setAutoSellMask(mask: number): void {
    if (mask === this.autoMask) return;
    this.autoMask = mask;
    this.buildPopover();
  }

  closePopover(): void {
    this.popover.hidden = true;
  }

  setStats(cash: number, perSecond: number, luck: number, rebirths: number): void {
    if (Math.abs(cash - this.targetCash) > perSecond * 3 + 1 || cash < this.targetCash) this.shownCash = cash;
    this.targetCash = cash;
    this.cashRate.textContent = `+${formatRate(perSecond)}`;
    this.luck.innerHTML = `${CLOVER_SVG.replace('<svg', '<svg style="width:calc(24 * var(--u));height:calc(24 * var(--u))"')} Luck <b>${formatMultiplier(luck)}</b>`;
    this.rebirthChip.innerHTML = `Rebirth <b>${rebirths}</b>`;
    this.perSecond = perSecond;
  }

  private perSecond = 0;

  /** Count the shown Cash up smoothly between the server's once-a-second credits. */
  update(delta: number): void {
    if (this.shownCash < this.targetCash) {
      this.shownCash = Math.min(this.targetCash, this.shownCash + Math.max(this.perSecond, (this.targetCash - this.shownCash) * 4) * delta);
    }
    const text = formatCash(this.shownCash);
    if (this.cashValue.textContent !== text) this.cashValue.textContent = text;
  }

  setRolling(rolling: boolean): void {
    this.rollButton.classList.toggle('is-busy', rolling);
  }

  setAuto(on: boolean): void {
    this.autoButton.classList.toggle('is-on', on);
    this.autoButton.classList.toggle('dice-btn--grey', !on);
    // innerHTML, not textContent: the Q key badge is part of the label.
    this.autoButton.innerHTML = `${on ? 'AUTO ON' : 'AUTO'}<span class="dice-tile__key">Q</span>`;
  }

  setHint(text: string): void {
    if (this.hint.textContent !== text) this.hint.textContent = text;
  }

  toast(text: string, kind: ToastKind = 'info'): void {
    const node = el('div', `dice-toast dice-out dice-toast--${kind}`, '');
    node.textContent = text;
    this.toasts.append(node);
    while (this.toasts.childElementCount > 4) this.toasts.firstElementChild?.remove();
    setTimeout(() => node.remove(), 3300);
  }

  /** A "+$N" floater near the cash counter. */
  floater(text: string): void {
    const node = el('div', 'dice-float dice-out', text);
    const rect = this.cashValue.getBoundingClientRect();
    node.style.left = `${rect.left + rect.width * 0.6}px`;
    node.style.top = `${rect.bottom}px`;
    this.root.append(node);
    setTimeout(() => node.remove(), 1250);
  }

  dispose(): void {
    this.root.remove();
  }
}
