import {
  CHARACTERS,
  characterById,
  cssColor,
  formatCash,
  formatOdds,
  formatRate,
  rarityById,
  rollPresentSeconds,
  baseIncome,
  type CharacterDef,
  type RolledMessage,
} from '@dice/shared';
import type { CharacterPortraits } from './CharacterPortraits.js';
import { injectDiceStyles } from './diceStyles.js';
import { el } from './Window.js';

const STRIP = 44;
/** Where the result sits in the strip. */
const RESULT_AT = 38;

/** Filler weights: mostly commons, with enough rares flashing past to tease. */
const FILLER_WEIGHTS = CHARACTERS.map((character) => 1 / Math.pow(character.odds, 0.45));
const FILLER_TOTAL = FILLER_WEIGHTS.reduce((sum, weight) => sum + weight, 0);

const filler = (): CharacterDef => {
  let roll = Math.random() * FILLER_TOTAL;
  for (let i = 0; i < CHARACTERS.length; i += 1) {
    roll -= FILLER_WEIGHTS[i]!;
    if (roll <= 0) return CHARACTERS[i]!;
  }
  return CHARACTERS[0]!;
};

export interface RollHooks {
  /** A card passed the marker. */
  tick(): void;
  /** The strip stopped on the result (rarity index). */
  landed(rarityIndex: number, fanfare: boolean): void;
}

/**
 * THE ROLL: a strip of character cards flies past a gold marker, slows, and
 * stops on the character the SERVER rolled - then the reveal: rays, a burst
 * and the card popping out in its rarity's colours, grander the rarer it is
 * (confetti from Legendary, a rainbow card for Divine), with a NEW badge on a
 * first discovery.
 *
 * Auto Spin runs the same strip faster and, below the fanfare tiers, shows a
 * small result pill instead of the full reveal. Card elements are pooled: a
 * thousand auto rolls build the strip once.
 */
export class RollView {
  private readonly root: HTMLDivElement;
  private readonly window: HTMLDivElement;
  private readonly strip: HTMLDivElement;
  private readonly reveal: HTMLDivElement;
  private readonly cards: { node: HTMLDivElement; img: HTMLImageElement; name: HTMLDivElement; odds: HTMLDivElement }[] = [];
  private mini: HTMLDivElement | null = null;
  private busy = false;
  private skipReveal: (() => void) | null = null;

  constructor(
    container: HTMLElement,
    private readonly portraits: CharacterPortraits,
    private readonly hooks: RollHooks,
  ) {
    injectDiceStyles();
    this.root = el('div', 'dice dice-roll');
    this.root.hidden = true;
    const dim = el('div', 'dice-roll__dim');
    this.window = el('div', 'dice-roll__window');
    this.strip = el('div', 'dice-roll__strip');
    this.window.append(this.strip, el('div', 'dice-roll__marker'));
    this.reveal = el('div', 'dice-reveal');
    this.reveal.hidden = true;
    this.root.append(dim, this.window, this.reveal);
    container.append(this.root);
    for (let i = 0; i < STRIP; i += 1) {
      const node = el('div', 'dice-rollcard');
      const img = el('img');
      img.alt = '';
      img.draggable = false;
      const name = el('div', 'dice-rollcard__name dice-out');
      const odds = el('div', 'dice-rollcard__odds dice-out');
      node.append(img, name, odds);
      this.strip.append(node);
      this.cards.push({ node, img, name, odds });
    }
    // Tap anywhere during the reveal to dismiss it early.
    this.reveal.addEventListener('pointerdown', () => this.skipReveal?.());
    this.portraits.prefetch(CHARACTERS.filter((c) => c.odds < 400).map((c) => c.id));
  }

  get rolling(): boolean {
    return this.busy;
  }

  /** Play a roll. Resolves when the presentation is over. */
  async play(result: RolledMessage, rollSpeed: number, multiplier: number, keepOpen = false): Promise<void> {
    const character = characterById(result.charId);
    if (!character) return;
    this.busy = true;
    const rarity = rarityById(character.rarity);
    const auto = result.auto;
    const seconds = rollPresentSeconds(rollSpeed, auto);

    for (let i = 0; i < STRIP; i += 1) {
      const pick = i === RESULT_AT ? character : filler();
      const card = this.cards[i]!;
      const r = rarityById(pick.rarity);
      card.node.style.setProperty('--r', cssColor(r.color));
      card.name.textContent = pick.name;
      card.odds.textContent = formatOdds(pick.odds);
      this.portraits.bind(card.img, pick.id);
    }
    this.mini?.remove();
    this.mini = null;
    this.reveal.hidden = true;
    this.window.style.display = '';
    this.root.hidden = false;
    requestAnimationFrame(() => this.root.classList.add('is-open'));

    await this.spin(seconds, rarity.fanfare && !auto);
    this.hooks.landed(rarity.index, rarity.fanfare);

    const full = !auto || rarity.fanfare || result.discovered;
    if (full) await this.showReveal(character, result, multiplier, auto ? 1300 : 2600);
    else await this.showMini(character, result, multiplier);

    this.busy = false;
    // Auto Spin keeps the overlay up between rolls, so it does not flicker.
    if (!keepOpen) this.close();
  }

  /** Put the overlay away (Auto Spin stopped). */
  close(): void {
    if (this.busy) return;
    this.mini?.remove();
    this.mini = null;
    this.root.classList.remove('is-open');
    this.root.hidden = true;
  }

  /** The strip: fast, then easing out onto the result under the marker. */
  private spin(seconds: number, dramatic: boolean): Promise<void> {
    return new Promise((resolve) => {
      const first = this.cards[0]!.node;
      const cardWidth = first.offsetWidth;
      const gap = parseFloat(getComputedStyle(this.strip).columnGap || getComputedStyle(this.strip).gap || '0') || 0;
      const pitch = cardWidth + gap;
      const centre = this.window.clientWidth / 2;
      // Land a little off-centre on the card, like a real wheel.
      const jitter = (Math.random() - 0.5) * cardWidth * 0.5;
      const end = RESULT_AT * pitch + cardWidth / 2 - centre + jitter;
      const duration = seconds * 1000 * (dramatic ? 1.15 : 1);
      const start = performance.now();
      let lastCard = -1;
      const frame = (now: number): void => {
        const t = Math.min(1, (now - start) / duration);
        // Quintic ease-out: a fast blur of cards that crawls to a stop.
        const eased = 1 - Math.pow(1 - t, dramatic ? 5 : 4);
        const x = end * eased;
        this.strip.style.transform = `translate3d(${-x}px, 0, 0)`;
        const under = Math.floor((x + centre) / pitch);
        if (under !== lastCard) {
          lastCard = under;
          this.hooks.tick();
        }
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
      // A hidden tab never runs requestAnimationFrame: finish on a timer too.
      setTimeout(resolve, duration + 400);
    });
  }

  private showReveal(character: CharacterDef, result: RolledMessage, multiplier: number, hold: number): Promise<void> {
    const rarity = rarityById(character.rarity);
    this.window.style.display = 'none';
    this.reveal.hidden = false;
    this.reveal.style.setProperty('--r', cssColor(rarity.color));
    const rays = rarity.index >= 2 ? '<div class="dice-reveal__rays"></div>' : '';
    const rainbow = rarity.id === 'divine' ? ' dice-reveal__card--rainbow' : '';
    const income = formatRate(baseIncome(character) * multiplier);
    const foot = result.sold > 0 ? `Auto-sold for <b>${formatCash(result.sold)}</b>` : `<b>${income}</b> &middot; ${formatOdds(character.odds)}`;
    this.reveal.innerHTML =
      rays +
      '<div class="dice-reveal__burst"></div>' +
      '<div class="dice-reveal__stack">' +
      `<div class="dice-reveal__top dice-out">${rarity.index >= 4 ? `${rarity.name.toUpperCase()}!` : result.free ? 'Free Roll!' : 'You got'}</div>` +
      `<div class="dice-reveal__card${rainbow}">` +
      `<img alt="" draggable="false" />` +
      (result.discovered ? '<div class="dice-reveal__badge dice-out">NEW!</div>' : '') +
      `<div class="dice-reveal__name dice-out">${character.name}</div>` +
      `<div class="dice-reveal__rarity dice-out">${rarity.name}</div>` +
      '</div>' +
      `<div class="dice-reveal__foot dice-out">${foot}</div>` +
      '</div>';
    this.portraits.bind(this.reveal.querySelector('img')!, character.id);
    if (rarity.index >= 4) this.confetti(rarity.color, rarity.color2, rarity.index >= 6 ? 70 : 40);
    return new Promise((resolve) => {
      const done = (): void => {
        this.skipReveal = null;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(done, hold);
      // Only allow the tap-to-skip after the card has landed.
      setTimeout(() => {
        this.skipReveal = done;
      }, 450);
    });
  }

  private showMini(character: CharacterDef, result: RolledMessage, multiplier: number): Promise<void> {
    const rarity = rarityById(character.rarity);
    this.mini = el('div', 'dice-mini-result dice-out');
    this.mini.style.setProperty('--r', cssColor(rarity.color));
    const img = el('img');
    img.alt = '';
    this.portraits.bind(img, character.id);
    const text = result.sold > 0 ? `${character.name} <span style="color:#ff9a9a">sold +${formatCash(result.sold)}</span>` : `${character.name} <span style="color:${cssColor(rarity.color)}">${rarity.name}</span> <span style="color:#6dff5a">${formatRate(baseIncome(character) * multiplier)}</span>`;
    this.mini.append(img, el('span', '', text));
    this.root.append(this.mini);
    return new Promise((resolve) => setTimeout(resolve, 420));
  }

  private confetti(color: number, color2: number, count: number): void {
    const palette = [cssColor(color), cssColor(color2), '#ffffff', '#ffd23a'];
    for (let i = 0; i < count; i += 1) {
      const piece = el('div', 'dice-confetti');
      const angle = Math.random() * Math.PI * 2;
      const distance = 200 + Math.random() * 380;
      piece.style.background = palette[i % palette.length]!;
      piece.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
      piece.style.setProperty('--dy', `${Math.sin(angle) * distance + 120}px`);
      piece.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
      piece.style.animationDelay = `${Math.random() * 0.15}s`;
      this.reveal.append(piece);
    }
  }
}
