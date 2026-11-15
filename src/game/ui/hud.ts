import type { HintKind } from '../core/types';
import { h, icon } from './dom';

const HINT_TEXT: Record<HintKind, [string, string]> = {
  move: ['swipe', '← →'],
  jump: ['swipe up', 'space'],
  glow: ['hold', 'shift'],
  pulse: ['double tap', 'E'],
  dive: ['swipe down', '↓'],
  hide: ['be still, be dark', 'release'],
  dash: ['swipe again', 'Q'],
  stop: ['tap', 'release'],
};

/**
 * In-play overlay: Lumen orb, tide gauge, shell pips, pause and pulse buttons, gesture hints,
 * chapter card. Values are only written to the DOM when they change.
 */
export class Hud {
  readonly root: HTMLElement;
  private readonly orbRing: SVGCircleElement;
  private readonly orb: HTMLElement;
  private readonly tideMark: HTMLElement;
  private readonly tideBox: HTMLElement;
  private readonly shells: HTMLElement;
  private readonly pulseBtn: HTMLButtonElement;
  private readonly pulseRing: SVGCircleElement;
  private readonly pauseBtn: HTMLButtonElement;
  private readonly hint: HTMLElement;
  private readonly hintLabel: HTMLElement;
  private readonly card: HTMLElement;
  private readonly note: HTMLElement;
  private readonly eye: HTMLElement;
  private readonly distance: HTMLElement;
  private lastLumen = -1;
  private lastTide = -1;
  private lastPulse = -1;
  private lastHint: HintKind | null = null;
  private lastState = '';
  private lastDistance = -1;
  private cardTimer = 0;
  private noteTimer = 0;
  onPause: (() => void) | null = null;
  onPulse: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    const ring = (cls: string, r: number): string =>
      `<svg viewBox="0 0 48 48" class="${cls}"><circle cx="24" cy="24" r="${r}" class="track"/><circle cx="24" cy="24" r="${r}" class="value" pathLength="100" stroke-dasharray="100" stroke-dashoffset="0" transform="rotate(-90 24 24)"/></svg>`;

    this.orb = h('div', { class: 'hud-orb', html: `${ring('orb-ring', 19)}<span class="orb-core"></span>` });
    this.orbRing = this.orb.querySelector('.value') as SVGCircleElement;
    this.tideMark = h('span', { class: 'tide-mark' });
    this.tideBox = h('div', { class: 'hud-tide' }, h('span', { class: 'tide-line' }), this.tideMark, icon('tide', 14));
    this.shells = h('div', { class: 'hud-shells' });
    this.eye = h('div', { class: 'hud-eye' }, icon('eye', 20));
    this.distance = h('div', { class: 'hud-distance' });
    this.pauseBtn = h('button', { class: 'hud-btn hud-pause', 'aria-label': 'Pause', onclick: () => this.onPause?.() }, icon('pause', 22));
    this.pulseBtn = h('button', { class: 'hud-btn hud-pulse', 'aria-label': 'Lumen Pulse', html: ring('pulse-ring', 21) });
    this.pulseBtn.append(icon('pulse', 26));
    this.pulseRing = this.pulseBtn.querySelector('.value') as SVGCircleElement;
    // Pointer down, not click: the pulse must fire the instant the thumb lands.
    this.pulseBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onPulse?.();
    });
    this.hintLabel = h('span', { class: 'hint-label' });
    this.hint = h('div', { class: 'hud-hint' }, h('span', { class: 'hint-glyph' }, h('i'), h('b')), this.hintLabel);
    this.card = h('div', { class: 'hud-card' });
    this.note = h('div', { class: 'hud-note' });
    this.root = h('div', { class: 'hud' }, h('div', { class: 'hud-top' }, this.orb, this.tideBox, this.shells, this.eye), this.distance, this.pauseBtn, this.pulseBtn, this.hint, this.card, this.note);
    parent.append(this.root);
    this.setVisible(false);
  }

  setVisible(on: boolean): void {
    this.root.classList.toggle('on', on);
  }

  setHanded(handed: 'left' | 'right'): void {
    this.root.classList.toggle('left-handed', handed === 'left');
  }

  /** Configures which parts apply to the current mode. */
  setMode(mode: 'story' | 'daily' | 'drift'): void {
    this.root.dataset.mode = mode;
    this.distance.textContent = '';
    this.lastDistance = -1;
  }

  setShells(total: number, taken: boolean[]): void {
    this.shells.replaceChildren(...Array.from({ length: total }, (_, i) => h('span', { class: `pip${taken[i] ? ' got' : ''}` }, icon('shell', 16))));
  }

  /** @param lumen 0..1, @param tide 0..1, @param pulse 0..1 readiness, @param danger 0..1 */
  update(lumen: number, tide: number, pulse: number, danger: number, fading: boolean, glowing: boolean): void {
    const l = Math.round(lumen * 100);
    if (l !== this.lastLumen) {
      this.lastLumen = l;
      this.orbRing.setAttribute('stroke-dashoffset', String(100 - l));
    }
    const state = `${l < 25 ? 'low' : ''}${fading ? ' fading' : ''}${glowing ? ' glow' : ''}${danger > 0.5 ? ' danger' : ''}`;
    if (state !== this.lastState) {
      this.lastState = state;
      this.orb.className = `hud-orb ${state}`;
      this.eye.classList.toggle('on', danger > 0.5);
    }
    const t = Math.round(tide * 50);
    if (t !== this.lastTide) {
      this.lastTide = t;
      this.tideMark.style.transform = `translateY(${-(t / 50) * 30}px)`;
      this.tideBox.classList.toggle('high', tide > 0.75);
    }
    const p = Math.round(pulse * 25);
    if (p !== this.lastPulse) {
      this.lastPulse = p;
      this.pulseRing.setAttribute('stroke-dashoffset', String(100 - p * 4));
      this.pulseBtn.classList.toggle('ready', p >= 25);
    }
  }

  setDistance(metres: number): void {
    const m = Math.floor(metres);
    if (m === this.lastDistance) return;
    this.lastDistance = m;
    this.distance.textContent = `${m} m`;
  }

  /** Shows an animated gesture hint, or hides it with null. */
  setHint(kind: HintKind | null, keyboard: boolean): void {
    if (kind === this.lastHint) return;
    this.lastHint = kind;
    if (!kind) {
      this.hint.classList.remove('on');
      return;
    }
    this.hint.dataset.kind = kind;
    this.hintLabel.textContent = HINT_TEXT[kind][keyboard ? 1 : 0];
    this.hint.classList.add('on');
  }

  /** Chapter title card: fades in, lingers, fades away without blocking play. */
  showCard(numeral: string, title: string, line: string): void {
    this.card.replaceChildren(h('span', { class: 'card-num', text: numeral }), h('h2', { text: title }), h('p', { text: line }));
    this.card.classList.add('on');
    window.clearTimeout(this.cardTimer);
    this.cardTimer = window.setTimeout(() => this.card.classList.remove('on'), 4200);
  }

  /** A brief line of text near the bottom (shell found, lantern lit, gentler path). */
  showNote(text: string, iconName?: string): void {
    this.note.replaceChildren(...(iconName ? [icon(iconName, 18)] : []), h('span', { text }));
    this.note.classList.add('on');
    window.clearTimeout(this.noteTimer);
    this.noteTimer = window.setTimeout(() => this.note.classList.remove('on'), 2600);
  }

  hideCard(): void {
    this.card.classList.remove('on');
    this.note.classList.remove('on');
  }
}
