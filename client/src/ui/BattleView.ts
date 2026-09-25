import {
  TOWER_FLOORS,
  characterById,
  cssColor,
  formatCash,
  formatStat,
  potionById,
  rarityById,
  type BattleEvent,
  type BattleMessage,
  type FighterInit,
} from '@dice/shared';
import type { CharacterPortraits } from './CharacterPortraits.js';
import { HEART_SVG, SWORD_SVG, potionSvg } from './glyphs.js';
import { injectDiceStyles } from './diceStyles.js';
import { button, el } from './Window.js';

const small = (svg: string): string => svg.replace('<svg', '<svg style="width:calc(28 * var(--u));height:calc(28 * var(--u))"');
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface Side {
  readonly fighters: readonly FighterInit[];
  readonly hp: number[];
  front: number;
  readonly card: HTMLDivElement;
  readonly minis: HTMLDivElement[];
  readonly tag: 'p' | 'e';
}

export interface BattleHooks {
  sound(name: 'punch' | 'katana' | 'death' | 'win' | 'lose' | 'ability'): void;
  music(battle: boolean): void;
  /** Fight again: the next floor (after a win) or the same one. */
  fight(floor: number): void;
  closed(): void;
}

/**
 * THE CARD BATTLE. No 3D: the two front cards face each other, lunge in to
 * strike, shake when hit, show damage numbers and ability effects, fall when
 * knocked out, and the next card of the team drops in - until one side is
 * empty. It PLAYS BACK the server's resolved log (`systems/battle.ts`), so the
 * fight shown is exactly the fight that was paid for.
 */
export class BattleView {
  private readonly root: HTMLDivElement;
  private readonly stage: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly result: HTMLDivElement;
  private readonly skip: HTMLButtonElement;
  private skipping = false;
  private playing = false;
  private token = 0;

  constructor(
    container: HTMLElement,
    private readonly portraits: CharacterPortraits,
    private readonly hooks: BattleHooks,
  ) {
    injectDiceStyles();
    this.root = el('div', 'dice dice-battle');
    this.root.hidden = true;
    this.stage = el('div', 'dice-battle__stage');
    this.title = el('div', 'dice-battle__title dice-out');
    this.result = el('div', 'dice-result');
    this.result.hidden = true;
    this.skip = button('Skip &#9193;', 'grey dice-btn--small dice-battle__skip', () => {
      this.skipping = true;
    });
    this.root.append(this.stage, this.skip);
    container.append(this.root);
  }

  get active(): boolean {
    return !this.root.hidden;
  }

  async play(message: BattleMessage, atTower: () => boolean): Promise<void> {
    this.token += 1;
    const token = this.token;
    this.playing = true;
    this.skipping = false;
    this.root.hidden = false;
    this.result.hidden = true;
    this.skip.hidden = false;
    this.hooks.music(true);
    this.portraits.prefetch([...message.player, ...message.enemy].map((f) => f.charId));

    this.stage.replaceChildren();
    this.title.textContent = `Floor ${message.floor}`;
    const vs = el('div', 'dice-battle__vs dice-out', 'VS');
    const player = this.side(message.player, 'p');
    const enemy = this.side(message.enemy, 'e');
    this.stage.append(this.title, vs, player.card, enemy.card, this.result);
    const queueP = el('div', 'dice-battle__queue dice-battle__queue--p');
    queueP.append(...player.minis);
    const queueE = el('div', 'dice-battle__queue dice-battle__queue--e');
    queueE.append(...enemy.minis);
    this.stage.append(queueP, queueE);
    this.show(player);
    this.show(enemy);
    player.card.classList.add('is-enter');
    enemy.card.classList.add('is-enter');
    await this.wait(900);

    const sides = { 0: player, 1: enemy } as const;
    for (let i = 0; i < message.events.length; i += 1) {
      if (token !== this.token) return;
      if (this.skipping) break;
      const event = message.events[i]!;
      const pace = i < 20 ? 1 : i < 60 ? 0.7 : 0.3;
      await this.step(event, sides[event.s], sides[event.s === 0 ? 1 : 0], pace);
    }
    if (token !== this.token) return;
    this.skip.hidden = true;
    this.hooks.sound(message.victory ? 'win' : 'lose');
    this.showResult(message, atTower);
    this.playing = false;
  }

  private side(fighters: readonly FighterInit[], tag: 'p' | 'e'): Side {
    const card = el('div', `dice-bcard dice-bcard--${tag}`);
    const minis = fighters.map((fighter) => {
      const mini = el('div', 'dice-mini');
      const character = characterById(fighter.charId);
      mini.style.setProperty('--r', cssColor(rarityById(character?.rarity ?? 'common').color));
      const img = el('img');
      img.alt = '';
      this.portraits.bind(img, fighter.charId);
      mini.append(img);
      return mini;
    });
    return { fighters, hp: fighters.map((f) => f.hp), front: 0, card, minis, tag };
  }

  /** Draw a side's front card. */
  private show(side: Side): void {
    const fighter = side.fighters[side.front];
    side.minis.forEach((mini, index) => {
      mini.classList.toggle('is-out', index < side.front);
      mini.classList.toggle('is-active', index === side.front);
    });
    if (!fighter) {
      side.card.style.opacity = '0';
      return;
    }
    side.card.style.opacity = '1';
    const character = characterById(fighter.charId);
    const rarity = rarityById(character?.rarity ?? 'common');
    side.card.style.setProperty('--r', cssColor(rarity.color));
    side.card.innerHTML =
      `<div class="dice-bcard__stats dice-out"><span>${small(HEART_SVG)} ${formatStat(fighter.hp)}</span><span>${small(SWORD_SVG)} ${formatStat(fighter.atk)}</span></div>` +
      `<div class="dice-bcard__face">` +
      (fighter.boss ? '<div class="dice-bcard__boss dice-out">BOSS</div>' : '') +
      `<img alt="" draggable="false" />` +
      `<div class="dice-bcard__name dice-out">${character?.name ?? '?'}</div>` +
      `<div class="dice-hpbar"><div class="dice-hpbar__lag"></div><div class="dice-hpbar__fill"></div><div class="dice-hpbar__text dice-out"></div></div>` +
      `</div>`;
    this.portraits.bind(side.card.querySelector('img')!, fighter.charId);
    this.setHp(side);
  }

  private setHp(side: Side): void {
    const fighter = side.fighters[side.front];
    if (!fighter) return;
    const hp = side.hp[side.front] ?? 0;
    const pct = `${Math.max(0, Math.min(100, (hp / Math.max(1e-6, fighter.hp)) * 100))}%`;
    const fill = side.card.querySelector<HTMLDivElement>('.dice-hpbar__fill');
    const lag = side.card.querySelector<HTMLDivElement>('.dice-hpbar__lag');
    const text = side.card.querySelector<HTMLDivElement>('.dice-hpbar__text');
    if (fill) fill.style.width = pct;
    if (lag) lag.style.width = pct;
    if (text) text.textContent = `${formatStat(hp)} / ${formatStat(fighter.hp)}`;
  }

  private async step(event: BattleEvent, actor: Side, target: Side, pace: number): Promise<void> {
    if (event.k === 'skip') {
      this.callout('Stunned!', '#9ad8ff');
      await this.wait(420 * pace);
      return;
    }
    const attacker = actor.fighters[actor.front];
    const ability = event.ab ? attacker?.ability : undefined;
    // Wind up and lunge.
    actor.card.classList.add(actor.tag === 'p' ? 'is-lunge-p' : 'is-lunge-e');
    await this.wait(150 * pace);
    if (ability) {
      this.callout(ability.name, cssColor(ability.color));
      this.effect(ability.fx, cssColor(ability.color), actor, target);
      this.hooks.sound('ability');
    }
    this.hooks.sound(ability?.fx === 'slash' ? 'katana' : 'punch');
    actor.card.classList.remove('is-lunge-p', 'is-lunge-e');

    // The hit lands.
    target.hp[event.t] = event.hp;
    if (event.t === target.front) {
      target.card.classList.remove('is-hit');
      void target.card.offsetWidth;
      target.card.classList.add('is-hit');
      this.setHp(target);
    }
    this.number(target, event.c ? `CRIT ${formatStat(event.d)}` : formatStat(event.d), event.c ? 'crit' : ability ? 'ability' : '');
    if (event.c) {
      this.stage.classList.remove('dice-shake');
      void this.stage.offsetWidth;
      this.stage.classList.add('dice-shake');
    }
    if (event.heal && event.ahp !== undefined) {
      actor.hp[actor.front] = event.ahp;
      this.setHp(actor);
      this.number(actor, `+${formatStat(event.heal)}`, 'heal');
    }
    if (event.sh) this.number(actor, 'SHIELD', 'heal');
    if (event.rg) this.number(actor, 'RAGE UP', 'ability');
    if (event.st) this.number(target, 'STUN', 'ability');
    if (event.sp) {
      target.hp[event.sp.t] = event.sp.hp;
      const mini = target.minis[event.sp.t];
      if (mini) {
        mini.animate([{ transform: 'scale(1.2)', filter: 'brightness(2)' }, { transform: 'scale(1)', filter: 'none' }], { duration: 300 });
        if (event.sp.ko) mini.classList.add('is-out');
      }
    }
    await this.wait(260 * pace);

    if (event.ko) {
      this.hooks.sound('death');
      target.card.classList.add('is-dead');
      await this.wait(620 * pace);
      target.card.classList.remove('is-dead', 'is-hit');
      target.front = event.t + 1;
      // A splash may already have knocked out the next card too.
      while (target.front < target.fighters.length && (target.hp[target.front] ?? 0) <= 0) target.front += 1;
      this.show(target);
      if (target.front < target.fighters.length) {
        target.card.classList.remove('is-enter');
        void target.card.offsetWidth;
        target.card.classList.add('is-enter');
        await this.wait(380 * pace);
      }
    }
  }

  private number(side: Side, text: string, kind: string): void {
    const node = el('div', `dice-dmg dice-out${kind ? ` dice-dmg--${kind}` : ''}`, text);
    const left = side.tag === 'p' ? 27 : 73;
    node.style.left = `${left + (Math.random() * 8 - 4)}%`;
    node.style.top = `${30 + Math.random() * 10}%`;
    this.stage.append(node);
    setTimeout(() => node.remove(), 950);
  }

  private callout(text: string, color: string): void {
    const node = el('div', 'dice-callout dice-out', text);
    node.style.color = color;
    this.stage.append(node);
    setTimeout(() => node.remove(), 950);
  }

  private effect(fx: string, color: string, actor: Side, target: Side): void {
    const fromLeft = actor.tag === 'p';
    const node = el('div', 'dice-fx');
    node.style.setProperty('--c', color);
    const targetX = target.tag === 'p' ? 27 : 73;
    switch (fx) {
      case 'beam':
      case 'lightning':
      case 'light':
        node.classList.add('dice-fx--beam');
        node.style.left = '27%';
        node.style.width = '46%';
        node.style.top = '40%';
        node.style.transformOrigin = fromLeft ? 'left center' : 'right center';
        break;
      case 'slash':
      case 'wind':
        node.classList.add('dice-fx--slash');
        node.style.left = `${targetX}%`;
        node.style.top = '44%';
        break;
      case 'water':
      case 'ice':
      case 'dark':
        node.classList.add('dice-fx--ring');
        node.style.left = `${targetX}%`;
        node.style.top = '44%';
        break;
      default:
        node.classList.add('dice-fx--burst');
        node.style.left = `${targetX}%`;
        node.style.top = '44%';
        break;
    }
    this.stage.append(node);
    setTimeout(() => node.remove(), 700);
  }

  private showResult(message: BattleMessage, atTower: () => boolean): void {
    const loot: string[] = [];
    if (message.victory) {
      loot.push(`<div class="dice-loot dice-out" style="color:#6dff5a">+${formatCash(message.cash)}</div>`);
      for (const [id, count] of Object.entries(message.potions)) {
        const potion = potionById(id);
        if (potion) loot.push(`<div class="dice-loot dice-out">${potionSvg(potion.color, potion.color2, potion.tier)} ${potion.name} x${count}</div>`);
      }
    }
    this.result.innerHTML =
      `<div class="dice-result__panel dice">` +
      `<div class="dice-result__title dice-out ${message.victory ? 'dice-result__title--win' : 'dice-result__title--lose'}">${message.victory ? 'VICTORY!' : 'DEFEAT'}</div>` +
      (message.firstClear ? '<div class="dice-out" style="color:#ffd23a;font-size:calc(24 * var(--u))">First clear bonus!</div>' : '') +
      (message.victory ? `<div class="dice-result__loot">${loot.join('')}</div>` : '<div class="dice-out" style="font-size:calc(20 * var(--u));color:#cfd6ee;text-align:center">Level up your units, drink potions, or roll for stronger characters.</div>') +
      `<div class="dice-result__buttons" style="display:flex;gap:calc(12 * var(--u))"></div></div>`;
    const buttons = this.result.querySelector('.dice-result__buttons')!;
    const next = message.victory && message.floor < TOWER_FLOORS ? message.floor + 1 : message.floor;
    if (atTower()) {
      buttons.append(
        button(message.victory ? (next > message.floor ? `Floor ${next}` : 'Again') : 'Retry', message.victory ? '' : 'gold', () => {
          this.hooks.fight(next);
        }),
      );
    }
    buttons.append(button('Close', 'grey', () => this.close()));
    this.result.hidden = false;
  }

  close(): void {
    this.token += 1;
    this.root.hidden = true;
    this.playing = false;
    this.hooks.music(false);
    this.hooks.closed();
  }

  private async wait(ms: number): Promise<void> {
    if (this.skipping) return;
    await sleep(ms);
  }
}
