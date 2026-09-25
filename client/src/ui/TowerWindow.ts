import {
  POTIONS,
  TEAM_SIZE,
  TOWER_FLOORS,
  TOWER_REWARDS,
  characterById,
  cssColor,
  floorDef,
  floorFighters,
  formatCash,
  formatStat,
  guaranteedPotionsFor,
  lineupPower,
  potionById,
  rarityById,
  teamFighters,
  tierOfFloor,
  type UnitRecord,
} from '@dice/shared';
import type { NetworkClient } from '../net/NetworkClient.js';
import type { PlayerStore } from '../state/PlayerStore.js';
import type { CharacterPortraits } from './CharacterPortraits.js';
import { CASTLE_SVG, HEART_SVG, SWORD_SVG, potionSvg } from './glyphs.js';
import { GameWindow, button, el } from './Window.js';

const small = (svg: string): string => svg.replace('<svg', '<svg style="width:calc(26 * var(--u));height:calc(26 * var(--u))"');

/**
 * THE TOWER: the 4-card team (with Auto Equip Best and manual picks), the
 * floors grouped by difficulty, what guards the chosen floor, the drop table,
 * and FIGHT - which only works standing at the tower (the server checks).
 */
export class TowerWindow extends GameWindow {
  private readonly team: HTMLDivElement;
  private readonly floors: HTMLDivElement;
  private readonly info: HTMLDivElement;
  private readonly drops: HTMLDivElement;
  private readonly fight: HTMLButtonElement;
  private floor = 1;
  private atTower = false;
  private drawn = -1;
  /** Ask the backpack to pick a unit for a team slot. */
  onPickSlot: ((slot: number) => void) | null = null;

  constructor(
    container: HTMLElement,
    private readonly store: PlayerStore,
    private readonly net: NetworkClient,
    private readonly portraits: CharacterPortraits,
  ) {
    super(container, { title: 'Dragon Tower', icon: CASTLE_SVG.replace('<svg', '<svg class="dice-icon"'), head: ['#4fd35a', '#25a33a'], width: 1180 });
    const column = el('div', 'dice-tower-col dice-scroll');
    column.append(el('div', 'dice-section-title dice-out', 'Your Team'));
    this.team = el('div', 'dice-team');
    column.append(this.team);
    const teamButtons = el('div');
    teamButtons.style.cssText = 'display:flex;justify-content:center;gap:calc(12 * var(--u))';
    this.fight = button(`${small(SWORD_SVG)} Fight`, 'blue', () => this.net.towerFight(this.floor));
    teamButtons.append(button('Equip Best', '', () => this.net.team('best')), this.fight);
    column.append(teamButtons);
    this.info = el('div', 'dice-floorinfo');
    column.append(this.info);
    column.append(el('div', 'dice-section-title dice-out', 'Floors'));
    this.floors = el('div', 'dice-floors');
    column.append(this.floors);
    this.drops = el('div', 'dice-drops');
    this.body.append(column, this.drops);
    this.foot.remove();
    store.onChange(() => {
      if (this.isOpen) this.render();
    });
  }

  /** Whether the player is at a tower door (Fight is only offered there). */
  setAtTower(value: boolean): void {
    if (value === this.atTower) return;
    this.atTower = value;
    this.drawn = -1;
    if (this.isOpen) this.render();
  }

  protected override onOpen(): void {
    this.floor = Math.min(TOWER_FLOORS, this.store.private.towerBest + 1);
    this.drawn = -1;
    this.render();
  }

  private teamUnits(): (UnitRecord | undefined)[] {
    return this.store.private.team.map((uid) => (uid ? this.store.units.get(uid) : undefined));
  }

  private render(): void {
    if (this.drawn === this.store.version) return;
    this.drawn = this.store.version;
    const upgrades = this.store.private.upgrades;
    const units = this.teamUnits();

    this.team.replaceChildren();
    for (let slot = 0; slot < TEAM_SIZE; slot += 1) {
      const unit = units[slot];
      const character = unit ? characterById(unit.c) : undefined;
      const card = el('button', `dice-fighter${unit ? '' : ' dice-fighter--empty dice-out'}`);
      card.type = 'button';
      if (unit && character) {
        const [fighter] = teamFighters([unit], upgrades);
        card.style.setProperty('--r', cssColor(rarityById(character.rarity).color));
        card.innerHTML =
          `<div class="dice-fighter__hp dice-out">${small(HEART_SVG)} ${formatStat(fighter?.hp ?? 0)}</div>` +
          `<img alt="" draggable="false" />` +
          `<div class="dice-fighter__name dice-out">${character.name} Lv${unit.l}</div>` +
          `<div class="dice-fighter__atk dice-out">${small(SWORD_SVG)} ${formatStat(fighter?.atk ?? 0)}</div>`;
        this.portraits.bind(card.querySelector('img')!, unit.c);
        card.title = 'Tap to change';
      } else {
        card.textContent = '+';
        card.title = 'Tap to pick a unit';
      }
      card.addEventListener('click', () => this.onPickSlot?.(slot));
      this.team.append(card);
    }

    const best = this.store.private.towerBest;
    this.floors.replaceChildren();
    for (let floor = 1; floor <= TOWER_FLOORS; floor += 1) {
      const tier = tierOfFloor(floor);
      const node = el('button', `dice-floor dice-out${floor === this.floor ? ' is-selected' : ''}`, `${floor}${floor <= best ? ' &#10003;' : ''}<small>${tier.name}${floor % 5 === 0 ? ' Boss' : ''}</small>`);
      node.type = 'button';
      node.style.setProperty('--t', cssColor(tier.color));
      node.disabled = floor > best + 1;
      node.addEventListener('click', () => {
        this.floor = floor;
        this.drawn = -1;
        this.render();
      });
      this.floors.append(node);
    }

    const def = floorDef(this.floor);
    const enemy = floorFighters(this.floor);
    const present = units.filter((unit): unit is UnitRecord => !!unit);
    const ours = lineupPower(teamFighters(present, upgrades));
    const theirs = lineupPower(enemy);
    const ratio = theirs > 0 ? ours / theirs : 0;
    const verdict = ratio >= 3 ? ['Easy', '#6dff5a'] : ratio >= 1.2 ? ['Fair', '#ffe14a'] : ratio >= 0.6 ? ['Risky', '#ff9a3a'] : ['Deadly', '#ff4b4b'];
    this.info.innerHTML = '';
    const left = el('div', 'dice-out', `Floor ${this.floor} &middot; ${def?.tier.name ?? ''}<br><span style="color:${verdict[1]}">${verdict[0]}</span> &middot; Win: ${formatCash(def?.cash ?? 0)}${this.floor > best ? ` <span style="color:#ffd23a">(x${TOWER_REWARDS.firstClearCash} first clear)</span>` : ''}`);
    const faces = el('div', 'dice-enemies');
    for (const fighter of enemy) {
      const img = el('img');
      img.alt = '';
      img.title = `${characterById(fighter.charId)?.name ?? ''}${fighter.boss ? ' (BOSS)' : ''}: ${formatStat(fighter.atk)} atk / ${formatStat(fighter.hp)} hp`;
      this.portraits.bind(img, fighter.charId);
      faces.append(img);
    }
    this.info.append(left, faces);

    this.fight.disabled = present.length === 0 || !this.atTower;
    this.fight.title = !this.atTower ? 'Walk into the Tower to fight' : present.length === 0 ? 'Pick a team first' : '';
    this.fight.innerHTML = this.atTower ? `${small(SWORD_SVG)} Fight Floor ${this.floor}` : 'Enter the Tower';

    this.renderDrops();
  }

  private renderDrops(): void {
    const tile = (id: string, pct: number, mega: boolean): string => {
      const potion = potionById(id);
      if (!potion) return '';
      return `<div class="dice-drop${mega ? ' dice-drop--mega' : ''}" title="${potion.name}">${potionSvg(potion.color, potion.color2, potion.tier)}<span class="dice-out">${pct}%</span></div>`;
    };
    const chances = (pool: readonly { id: string; weight: number }[]): string => {
      const total = pool.reduce((sum, entry) => sum + entry.weight, 0) || 1;
      return pool.map((entry) => tile(entry.id, Math.round((entry.weight / total) * 100), (potionById(entry.id)?.tier ?? 1) > 1)).join('');
    };
    const guaranteed = guaranteedPotionsFor(this.floor);
    this.drops.innerHTML =
      `<div class="dice-drops__head dice-out">Drops</div>` +
      `<div class="dice-drops__list dice-scroll">` +
      `<div class="dice-drops__title dice-out">Floor 1+</div>${chances(TOWER_REWARDS.pool)}` +
      `<div class="dice-drops__title dice-out">Floor ${TOWER_REWARDS.megaFrom}+</div>${chances(TOWER_REWARDS.megaPool)}` +
      `<div class="dice-drops__title" style="font-size:calc(14 * var(--u));color:#b8c0d8">${guaranteed} potion${guaranteed === 1 ? '' : 's'} per win + ${Math.round(TOWER_REWARDS.bonusChance * 100)}% bonus. ${POTIONS.length} kinds.</div>` +
      `</div>`;
  }
}
