import {
  CHARACTERS,
  DISPLAY_SLOTS,
  POTIONS,
  UNIT_LEVEL,
  characterById,
  cssColor,
  describePotion,
  displaySlotRebirths,
  effectiveOdds,
  formatCash,
  formatOdds,
  formatRate,
  formatStat,
  isDisplaySlotOpen,
  levelUpCost,
  potionById,
  potionRoom,
  rarityById,
  roleOf,
  sellValue,
  unitAttack,
  unitHealth,
  unitIncome,
  unitPower,
  cashMultiplier,
  type UnitRecord,
} from '@dice/shared';
import type { NetworkClient } from '../net/NetworkClient.js';
import type { PlayerStore } from '../state/PlayerStore.js';
import type { CharacterPortraits } from './CharacterPortraits.js';
import { BOOK_SVG, LOCK_SVG, potionSvg } from './glyphs.js';
import { ICON_URL } from './images.js';
import { GameWindow, button, el } from './Window.js';

type Tab = 'units' | 'items' | 'display' | 'index';
/** What tapping a unit does. */
type Mode = { kind: 'inspect' } | { kind: 'sell' } | { kind: 'potion'; potion: string } | { kind: 'place'; slot: number } | { kind: 'team'; slot: number };

/**
 * THE BACKPACK: every owned unit, the potions, the twenty display stands and
 * the collection index, with a detail pane for whichever unit is selected.
 * Every button is a REQUEST to the server; the view redraws from the store
 * when the server answers.
 */
export class BackpackWindow extends GameWindow {
  private tab: Tab = 'units';
  private mode: Mode = { kind: 'inspect' };
  private selected = 0;
  private selectedPotion = '';
  private readonly sellPicks = new Set<number>();
  private lockMode = false;
  private readonly grid: HTMLDivElement;
  private readonly detail: HTMLDivElement;
  private readonly tabs: HTMLDivElement;
  private readonly tabButtons = new Map<Tab, HTMLButtonElement>();
  private readonly counter: HTMLDivElement;
  private readonly footLeft: HTMLDivElement;
  private readonly cards = new Map<number, HTMLButtonElement>();
  private readonly cardKeys = new Map<number, string>();
  private drawnVersion = -1;
  /** Called when the player asks to pick a team member (the tower window listens). */
  onTeamPicked: (() => void) | null = null;
  /** Say why a tap did nothing (a locked unit in sell mode). */
  onRefuse: ((text: string) => void) | null = null;

  constructor(
    container: HTMLElement,
    private readonly store: PlayerStore,
    private readonly net: NetworkClient,
    private readonly portraits: CharacterPortraits,
  ) {
    super(container, {
      title: 'Backpack',
      icon: `<img class="dice-icon" src="${ICON_URL.backpack}" alt="" />`,
      head: ['#6b73ff', '#4b53e0'],
      width: 1060,
    });
    this.tabs = el('div', 'dice-tabs dice-tabs--inside');
    for (const [tab, label, glyph] of [
      ['units', 'Units', '&#9823;'],
      ['items', 'Items', '&#9879;'],
      ['display', 'Stands', '&#9733;'],
      ['index', 'Index', '&#128214;'],
    ] as const) {
      const node = el('button', 'dice-tab dice-out', `<span class="dice-tab__glyph">${glyph}</span>${label}`);
      node.type = 'button';
      node.addEventListener('click', () => this.show(tab));
      this.tabs.append(node);
      this.tabButtons.set(tab, node);
    }
    this.grid = el('div', 'dice-grid dice-scroll');
    this.detail = el('div', 'dice-detail dice-scroll');
    this.body.append(this.tabs, this.grid, this.detail);

    this.footLeft = el('div');
    this.footLeft.style.cssText = 'display:flex;gap:calc(12 * var(--u));margin-right:auto;flex-wrap:wrap';
    this.counter = el('div', 'dice-counter dice-out', '');
    this.foot.append(this.footLeft, this.counter);
    this.store.onChange(() => {
      if (this.isOpen) this.render();
    });
  }

  /** Open on a tab (and optionally a mode). */
  show(tab: Tab, mode: Mode = this.tab === tab ? this.mode : { kind: 'inspect' }): void {
    this.tab = tab;
    this.mode = mode;
    if (mode.kind !== 'sell') this.sellPicks.clear();
    this.setOpen(true);
    this.drawnVersion = -1;
    this.render();
  }

  openSell(): void {
    this.show('units', { kind: 'sell' });
  }

  /** Pick a unit for a team slot (from the tower). */
  pickTeam(slot: number): void {
    this.show('units', { kind: 'team', slot });
  }

  protected override onOpen(): void {
    this.drawnVersion = -1;
    this.render();
  }

  private render(): void {
    if (this.drawnVersion === this.store.version && this.grid.childElementCount > 0) return;
    this.drawnVersion = this.store.version;
    for (const [tab, node] of this.tabButtons) node.classList.toggle('is-on', tab === this.tab);
    const titles: Record<Tab, string> = { units: 'Backpack', items: 'Items', display: 'Stands', index: 'Index' };
    this.title.textContent = this.mode.kind === 'sell' ? 'Sell Units' : titles[this.tab];
    switch (this.tab) {
      case 'units':
        this.renderUnits();
        break;
      case 'items':
        this.renderItems();
        break;
      case 'display':
        this.renderDisplay();
        break;
      case 'index':
        this.renderIndex();
        break;
    }
    this.renderFoot();
  }

  // ------------------------------------------------------------------ units

  private sortedUnits(): UnitRecord[] {
    const units = [...this.store.units.values()];
    if (this.mode.kind === 'team') return units.sort((a, b) => unitPower(b) - unitPower(a) || b.u - a.u);
    return units.sort((a, b) => unitIncome(b) - unitIncome(a) || b.u - a.u);
  }

  private renderUnits(): void {
    const units = this.sortedUnits();
    if (!this.store.units.has(this.selected)) this.selected = units[0]?.u ?? 0;
    // Keyed reuse: cards are built once per unit and moved, so a roll does not rebuild hundreds.
    const seen = new Set<number>();
    const fragment = document.createDocumentFragment();
    for (const unit of units) {
      seen.add(unit.u);
      fragment.append(this.unitCard(unit));
    }
    for (const [uid, card] of this.cards) {
      if (!seen.has(uid)) {
        card.remove();
        this.cards.delete(uid);
        this.cardKeys.delete(uid);
      }
    }
    this.grid.replaceChildren(fragment);
    if (units.length === 0) this.grid.append(el('div', 'dice-empty-note', 'No units yet - press ROLL to get your first anime characters!'));
    this.renderUnitDetail();
  }

  private unitCard(unit: UnitRecord): HTMLButtonElement {
    const character = characterById(unit.c);
    const rarity = rarityById(character?.rarity ?? 'common');
    const displayed = this.store.isDisplayed(unit.u);
    const teamed = this.store.inTeam(unit.u);
    const fresh = this.store.fresh.has(unit.u);
    const picked = this.mode.kind === 'sell' ? this.sellPicks.has(unit.u) : this.selected === unit.u;
    const statText = this.mode.kind === 'team' ? `&#9876;${formatStat(unitAttack(unit))}` : formatRate(unitIncome(unit));
    const key = `${unit.c}|${unit.l}|${unit.k}|${displayed}|${teamed}|${fresh}|${picked}|${statText}|${this.mode.kind}`;
    let card = this.cards.get(unit.u);
    if (!card) {
      card = el('button', 'dice-card');
      card.type = 'button';
      const uid = unit.u;
      card.addEventListener('click', () => this.tapUnit(uid));
      this.cards.set(unit.u, card);
    }
    if (this.cardKeys.get(unit.u) === key) return card;
    this.cardKeys.set(unit.u, key);
    card.className = `dice-card${picked ? ' is-selected' : ''}${this.mode.kind === 'sell' ? ' dice-card--sell' : ''}`;
    card.style.setProperty('--r', cssColor(rarity.color));
    const tags: string[] = [];
    if (fresh) tags.push('<span class="dice-tag dice-tag--new">NEW</span>');
    if (displayed) tags.push('<span class="dice-tag dice-tag--d">D</span>');
    if (teamed) tags.push('<span class="dice-tag dice-tag--t">T</span>');
    if (unit.k) tags.push(`<span class="dice-tag dice-tag--k">&#128274;</span>`);
    card.innerHTML =
      `<img alt="" draggable="false" />` +
      `<div class="dice-card__tags">${tags.join('')}</div>` +
      `<div class="dice-card__lvl dice-out">Lv${unit.l}</div>` +
      `<div class="dice-card__stat dice-out">${statText}</div>`;
    this.portraits.bind(card.querySelector('img')!, unit.c);
    card.title = `${character?.name ?? unit.c} (${rarity.name})`;
    return card;
  }

  private tapUnit(uid: number): void {
    const unit = this.store.units.get(uid);
    if (!unit) return;
    this.store.fresh.delete(uid);
    switch (this.mode.kind) {
      case 'sell':
        // Stand and team units can be picked (the server takes them off to
        // sell them); only the lock protects a unit.
        if (this.sellPicks.has(uid)) this.sellPicks.delete(uid);
        else if (unit.k) this.onRefuse?.('That unit is locked. Unlock it to sell it.');
        else this.sellPicks.add(uid);
        break;
      case 'potion':
        this.net.usePotion(uid, this.mode.potion);
        this.selected = uid;
        break;
      case 'place':
        this.net.display('place', uid, this.mode.slot);
        this.mode = { kind: 'inspect' };
        this.tab = 'display';
        break;
      case 'team':
        this.net.team('set', uid, this.mode.slot);
        this.mode = { kind: 'inspect' };
        this.setOpen(false);
        this.onTeamPicked?.();
        return;
      default:
        if (this.lockMode) this.net.lock(uid, !unit.k);
        this.selected = uid;
        break;
    }
    this.drawnVersion = -1;
    this.render();
  }

  private renderUnitDetail(): void {
    const unit = this.store.units.get(this.selected);
    const character = unit ? characterById(unit.c) : undefined;
    this.detail.hidden = !unit || !character || this.mode.kind === 'sell';
    if (!unit || !character) {
      this.detail.replaceChildren();
      return;
    }
    const rarity = rarityById(character.rarity);
    const stats = this.store.stats;
    const multiplier = cashMultiplier(stats.rebirths, this.store.private.upgrades);
    const displayed = this.store.isDisplayed(unit.u);
    const teamed = this.store.inTeam(unit.u);
    const cost = levelUpCost(unit);
    const luckOdds = effectiveOdds(stats.luck).get(character.id) ?? character.odds;
    const potions = Object.entries(unit.p)
      .map(([id, n]) => `${potionById(id)?.name ?? id} x${n}`)
      .join(', ');

    this.detail.style.setProperty('--r', cssColor(rarity.color));
    this.detail.innerHTML =
      `<div class="dice-detail__art"><img alt="" /></div>` +
      `<div class="dice-detail__name dice-out">${character.name}</div>` +
      `<div class="dice-detail__sub"><span style="color:${cssColor(rarity.color)}">${rarity.name}</span> &middot; ${formatOdds(character.odds)} &middot; ${character.series}</div>` +
      `<div class="dice-stats">` +
      `<div class="dice-stat"><span>Cash/s</span>${formatRate(unitIncome(unit) * multiplier)}</div>` +
      `<div class="dice-stat"><span>Level</span>${unit.l}/${UNIT_LEVEL.max}</div>` +
      `<div class="dice-stat"><span>Attack</span>&#9876; ${formatStat(unitAttack(unit))}</div>` +
      `<div class="dice-stat"><span>Health</span>&#10084; ${formatStat(unitHealth(unit))}</div>` +
      `<div class="dice-stat"><span>Role</span>${roleOf(character).name}</div>` +
      `<div class="dice-stat"><span>Your odds</span>${formatOdds(luckOdds)}</div>` +
      `</div>` +
      (character.ability ? `<div class="dice-detail__ability">&#10022; ${character.ability.name}: ${abilityText(character.ability.kind, character.ability.every, character.ability.power)}</div>` : '') +
      (potions ? `<div class="dice-detail__sub">Potions: ${potions}</div>` : '') +
      `<div class="dice-detail__actions"></div>`;
    this.portraits.bind(this.detail.querySelector('img')!, unit.c);
    const actions = this.detail.querySelector('.dice-detail__actions')!;
    actions.append(
      button(displayed ? 'Unstand' : 'Stand', displayed ? 'grey' : '', () => this.net.display(displayed ? 'remove' : 'place', unit.u)),
      button(teamed ? 'Unteam' : 'Team', teamed ? 'grey' : 'blue', () => this.net.team(teamed ? 'remove' : 'set', unit.u)),
      button(Number.isFinite(cost) ? `Lv Up ${formatCash(cost)}` : 'Max Lv', 'gold', () => this.net.levelUp({ uid: unit.u })),
      button(unit.k ? 'Unlock' : 'Lock', 'purple', () => this.net.lock(unit.u, !unit.k)),
      button('Potion', 'blue', () => this.show('items')),
      button(`Sell ${formatCash(sellValue(unit))}`, 'red', () => this.net.sell([unit.u])),
    );
    const levelButton = actions.children[2] as HTMLButtonElement;
    if (!Number.isFinite(cost) || stats.cash < cost) levelButton.classList.add('is-off');
    const sell = actions.children[5] as HTMLButtonElement;
    if (unit.k) {
      sell.disabled = true;
      sell.title = 'Unlock it to sell it';
    }
  }

  // ------------------------------------------------------------------ items

  private renderItems(): void {
    this.grid.replaceChildren();
    const held = this.store.private.potions;
    const list = el('div', 'dice-potions');
    let any = false;
    for (const potion of POTIONS) {
      const count = held[potion.id] ?? 0;
      if (count <= 0) continue;
      any = true;
      const node = el(
        'button',
        `dice-potion${this.selectedPotion === potion.id ? ' is-selected' : ''}`,
        `${potionSvg(potion.color, potion.color2, potion.tier)}<div class="dice-potion__name dice-out">${potion.name}</div><div class="dice-potion__count dice-out">x${count}</div>`,
      );
      node.style.setProperty('--p', cssColor(potion.color));
      node.type = 'button';
      node.addEventListener('click', () => {
        this.selectedPotion = potion.id;
        this.drawnVersion = -1;
        this.render();
      });
      list.append(node);
    }
    if (!any) list.append(el('div', 'dice-empty-note', 'No potions yet - win Tower battles to earn them!'));
    this.grid.append(list);

    const potion = potionById(this.selectedPotion);
    this.detail.hidden = !potion || (held[this.selectedPotion] ?? 0) <= 0;
    if (!potion) return;
    this.detail.style.setProperty('--r', cssColor(potion.color));
    this.detail.innerHTML =
      `<div class="dice-detail__art" style="display:grid;place-items:center">${potionSvg(potion.color, potion.color2, potion.tier)}</div>` +
      `<div class="dice-detail__name dice-out">${potion.name}</div>` +
      `<div class="dice-detail__sub">${describePotion(potion)} &middot; permanent</div>` +
      `<div class="dice-detail__sub">Up to ${potion.effect === 'level' ? `level ${UNIT_LEVEL.max}` : `${potion.maxPerUnit} per unit`}. You have ${held[potion.id] ?? 0}.</div>` +
      `<div class="dice-detail__actions"></div>`;
    const target = this.store.units.get(this.selected);
    const actions = this.detail.querySelector('.dice-detail__actions')!;
    actions.append(button('Choose Unit', '', () => this.show('units', { kind: 'potion', potion: potion.id })));
    if (target && potionRoom(target, potion.id) > 0) {
      actions.append(button(`Give ${characterById(target.c)?.name ?? ''}`, 'blue', () => this.net.usePotion(target.u, potion.id)));
    }
  }

  // ---------------------------------------------------------------- display

  private renderDisplay(): void {
    this.grid.replaceChildren();
    const rebirths = this.store.stats.rebirths;
    const display = this.store.private.display;
    for (let slot = 0; slot < DISPLAY_SLOTS; slot += 1) {
      const uid = display[slot] ?? 0;
      const unit = uid ? this.store.units.get(uid) : undefined;
      if (!isDisplaySlotOpen(slot, rebirths)) {
        const locked = el('div', 'dice-card dice-card--locked-slot dice-out', `${LOCK_SVG.replace('<svg', '<svg style="width:40%;height:40%"')}<div>Rebirth ${displaySlotRebirths(slot)}</div>`);
        this.grid.append(locked);
        continue;
      }
      if (!unit) {
        const empty = el('button', 'dice-card dice-card--empty dice-out', '+');
        empty.type = 'button';
        empty.title = `Stand ${slot + 1}: tap to place a unit`;
        empty.addEventListener('click', () => this.show('units', { kind: 'place', slot }));
        this.grid.append(empty);
        continue;
      }
      const card = this.unitCard(unit);
      this.grid.append(card);
    }
    this.renderUnitDetail();
  }

  // ------------------------------------------------------------------ index

  private renderIndex(): void {
    this.grid.replaceChildren();
    const discovered = new Set(this.store.private.discovered);
    for (const character of CHARACTERS) {
      const rarity = rarityById(character.rarity);
      const known = discovered.has(character.id);
      const card = el('div', `dice-card${known ? '' : ' dice-card--undiscovered'}`);
      card.style.setProperty('--r', cssColor(rarity.color));
      card.innerHTML = `<img alt="" draggable="false" /><div class="dice-card__lvl dice-out" style="color:${cssColor(rarity.color)}">${rarity.name}</div><div class="dice-card__stat dice-out" style="font-size:calc(16 * var(--u))">${known ? character.name : '???'}<br>${formatOdds(character.odds)}</div>`;
      this.portraits.bind(card.querySelector('img')!, character.id);
      card.title = known ? `${character.name} - ${character.series}` : 'Not discovered yet';
      this.grid.append(card);
    }
    this.detail.hidden = false;
    this.detail.style.setProperty('--r', '#ffd23a');
    this.detail.innerHTML =
      `<div class="dice-detail__art" style="display:grid;place-items:center">${BOOK_SVG.replace('<svg', '<svg style="width:60%;height:60%"')}</div>` +
      `<div class="dice-detail__name dice-out">Collection</div>` +
      `<div class="dice-detail__sub">Discovered ${discovered.size} / ${CHARACTERS.length}</div>` +
      `<div class="dice-detail__sub">Total rolls: ${this.store.private.totalRolls.toLocaleString('en-US')}</div>` +
      `<div class="dice-detail__sub">Rarest pull: ${this.store.private.bestOdds > 0 ? formatOdds(this.store.private.bestOdds) : '-'}</div>` +
      `<div class="dice-detail__sub">Luck makes every rare character more likely. Rebirth and the Luck upgrade raise it.</div>`;
  }

  // ------------------------------------------------------------------- foot

  private renderFoot(): void {
    this.footLeft.replaceChildren();
    const count = this.store.unitCount;
    const cap = this.store.private.storage;
    this.counter.innerHTML = `<img src="${ICON_URL.backpack}" alt="" /> ${count}/${cap}`;
    this.counter.classList.toggle('is-full', count >= cap);
    switch (this.mode.kind) {
      case 'sell': {
        let total = 0;
        for (const uid of this.sellPicks) {
          const unit = this.store.units.get(uid);
          if (unit) total += sellValue(unit);
        }
        this.footLeft.append(
          button('Pick Commons', 'grey', () => this.pickRarity(0)),
          button('Pick Uncommons', 'grey', () => this.pickRarity(1)),
          button('Clear', 'grey', () => {
            this.sellPicks.clear();
            this.drawnVersion = -1;
            this.render();
          }),
        );
        const sell = button(`Sell ${this.sellPicks.size} (+${formatCash(total)})`, 'red', () => {
          this.net.sell([...this.sellPicks]);
          this.sellPicks.clear();
        });
        if (this.sellPicks.size === 0) sell.disabled = true;
        this.footLeft.append(sell);
        break;
      }
      case 'potion': {
        const potion = potionById(this.mode.potion);
        this.footLeft.append(
          el('div', 'dice-out', `Tap a unit to give it ${potion?.name ?? 'the potion'} (${this.store.private.potions[this.mode.potion] ?? 0} left)`),
          button('Done', 'blue', () => this.show('items', { kind: 'inspect' })),
        );
        break;
      }
      case 'place':
        this.footLeft.append(el('div', 'dice-out', `Tap a unit to put it on stand ${this.mode.slot + 1}`), button('Cancel', 'grey', () => this.show('display', { kind: 'inspect' })));
        break;
      case 'team':
        this.footLeft.append(el('div', 'dice-out', `Tap a unit for team slot ${this.mode.slot + 1}`), button('Cancel', 'grey', () => this.setOpen(false)));
        break;
      default: {
        if (this.tab === 'units' || this.tab === 'display') {
          const lock = el('button', `dice-btn dice-btn--red dice-btn--small${this.lockMode ? '' : ' is-off'}`, LOCK_SVG.replace('<svg', '<svg style="width:calc(34 * var(--u));height:calc(34 * var(--u))"'));
          lock.type = 'button';
          lock.title = 'Lock mode: tap units to lock / unlock them';
          lock.addEventListener('click', () => {
            this.lockMode = !this.lockMode;
            this.drawnVersion = -1;
            this.render();
          });
          this.footLeft.append(lock, button('Equip Best', '', () => this.net.display('best')));
        }
        break;
      }
    }
  }

  private pickRarity(index: number): void {
    for (const unit of this.store.units.values()) {
      const character = characterById(unit.c);
      if (!character || rarityById(character.rarity).index !== index) continue;
      if (unit.k || this.store.isDisplayed(unit.u) || this.store.inTeam(unit.u)) continue;
      this.sellPicks.add(unit.u);
    }
    this.drawnVersion = -1;
    this.render();
  }
}

const abilityText = (kind: string, every: number, power: number): string => {
  switch (kind) {
    case 'burst':
      return `every ${every} attacks, hits for ${power}x`;
    case 'pierce':
      return `every ${every} attacks, hits for ${power}x and splashes the next enemy`;
    case 'heal':
      return `every ${every} attacks, heals ${Math.round(power * 100)}% health`;
    case 'drain':
      return `heals ${Math.round(power * 100)}% of damage dealt`;
    case 'shield':
      return `every ${every} attacks, blocks ${Math.round(power * 100)}% of the next hit`;
    case 'stun':
      return `every ${every} attacks, stuns the enemy for a turn`;
    case 'rage':
      return `every ${every} attacks, attack grows x${power}`;
    default:
      return '';
  }
};
