import { injectDiceStyles } from './diceStyles.js';

const open = new Set<GameWindow>();
let shade: HTMLDivElement | null = null;

/** True while any game window is open (the world stops taking input). */
export const anyWindowOpen = (): boolean => open.size > 0;

/** Close every open window. */
export const closeAllWindows = (): void => {
  for (const window of [...open]) window.setOpen(false);
};

export interface WindowOptions {
  readonly title: string;
  /** HTML for the header icon (an <img> or an inline SVG). */
  readonly icon: string;
  /** Header gradient colours. */
  readonly head: readonly [string, string];
  /** Width in design units. */
  readonly width?: number;
}

/**
 * THE WINDOW FRAME of the reference: a dark body under a checkered coloured
 * header with an icon and title, and the red checkered X. Subclasses fill
 * `body` (and `foot`). One window is open at a time.
 */
export class GameWindow {
  readonly root: HTMLDivElement;
  readonly body: HTMLDivElement;
  readonly foot: HTMLDivElement;
  readonly title: HTMLDivElement;
  onClose: (() => void) | null = null;

  constructor(container: HTMLElement, options: WindowOptions) {
    injectDiceStyles();
    if (!shade) {
      shade = document.createElement('div');
      shade.className = 'dice-shade';
      shade.hidden = true;
      shade.addEventListener('pointerdown', () => closeAllWindows());
      container.append(shade);
    }
    this.root = document.createElement('div');
    this.root.className = 'dice dice-window';
    this.root.hidden = true;
    this.root.style.setProperty('--head-a', options.head[0]);
    this.root.style.setProperty('--head-b', options.head[1]);
    if (options.width) this.root.style.width = `min(calc(${options.width} * var(--u)), calc(100vw - 16px))`;

    const head = document.createElement('div');
    head.className = 'dice-window__head';
    const icon = document.createElement('div');
    icon.className = 'dice-window__icon';
    icon.innerHTML = options.icon;
    this.title = document.createElement('div');
    this.title.className = 'dice-window__title dice-out';
    this.title.textContent = options.title;
    const close = document.createElement('button');
    close.className = 'dice-window__close dice-out';
    close.type = 'button';
    close.textContent = 'X';
    close.addEventListener('click', () => this.setOpen(false));
    head.append(icon, this.title, close);

    this.body = document.createElement('div');
    this.body.className = 'dice-window__body';
    this.foot = document.createElement('div');
    this.foot.className = 'dice-window__foot';
    this.root.append(head, this.body, this.foot);
    this.root.addEventListener('pointerdown', (event) => event.stopPropagation());
    container.append(this.root);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  setOpen(value: boolean): void {
    if (value === this.isOpen) return;
    if (value) {
      closeAllWindows();
      open.add(this);
      this.root.hidden = false;
      this.onOpen();
    } else {
      open.delete(this);
      this.root.hidden = true;
      this.onClose?.();
    }
    if (shade) shade.hidden = open.size === 0;
  }

  toggle(): void {
    this.setOpen(!this.isOpen);
  }

  /** Called when the window opens: refresh. */
  protected onOpen(): void {}

  dispose(): void {
    open.delete(this);
    this.root.remove();
  }
}

/** A small element helper. */
export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', html = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html) node.innerHTML = html;
  return node;
};

/** A chunky button. */
export const button = (label: string, variant = '', onClick?: () => void): HTMLButtonElement => {
  const node = el('button', `dice-btn dice-out ${variant ? `dice-btn--${variant}` : ''}`.trim());
  node.type = 'button';
  node.innerHTML = label;
  if (onClick) node.addEventListener('click', onClick);
  return node;
};
