import type { HintKind } from '../core/types';
import { h, icon } from './dom';
import { PAD_LABELS, type PadFamily, type PadGlyph } from '../input/gamepad';
import type { InputMode } from '../input/input';

/** Puts a controller's own button names into a prompt. */
export function padText(text: string, family: PadFamily | null): string {
  const labels = PAD_LABELS[family ?? 'xbox'];
  return text.replace(/\{(\w+)\}/g, (_, g: string) => labels[g as PadGlyph] ?? g);
}

/** Prompt text for each lesson: [touch, keyboard, controller]. Short on purpose. `{south}` and the like
 * become the button names of the controller in hand. */
const HINT_TEXT: Record<HintKind, [string, string, string]> = {
  move: ['Stick · move', 'A D', 'Left stick · move'],
  jump: ['Jump', 'Space', 'Jump · {south}'],
  double: ['Jump again in the air', 'Space, twice', '{south} again in the air'],
  wall: ['Push into the wall · Jump', 'Hold toward the wall · Space', 'Push into the wall · {south}'],
  dash: ['Dash', 'Shift', 'Dash · {east}'],
  airdash: ['Dash in the air', 'Shift in the air', '{east} in the air'],
  swim: ['Stick to swim · Jump to leap out', 'WASD · Space to leap out', 'Left stick to swim · {south} to leap out'],
  dive: ['Stick down · dive', 'S · dive', 'Stick down · dive'],
  glide: ['Hold Jump while falling', 'Hold Space while falling', 'Hold {south} while falling'],
  attack: ['Strike', 'X or left click', 'Strike · {west}'],
  downstrike: ['Stick down + Strike, in the air', 'S + X, in the air', 'Stick down + {west}, in the air'],
  charge: ['Hold Strike · let go', 'Hold X or left click · let go', 'Hold {west} · let go'],
  pulse: ['Tap Light · pulse', 'Tap E or right click', 'Tap {north} · pulse'],
  glow: ['Hold Light · glow', 'Hold E or right click', 'Hold {north} · glow'],
  danger: ['Light is seen. Go dark.', 'Light is seen. Go dark.', 'Light is seen. Go dark.'],
  heal: ['Hold Mend when it is safe', 'Hold Q when it is safe', 'Hold {rb} when it is safe'],
  bench: ['Lanterns bring you back here', 'Lanterns bring you back here', 'Lanterns bring you back here'],
  pause: ['Pause · top corner', 'Esc · pause', '{start} · pause'],
  boss: ['A guardian shows its strength', 'A guardian shows its strength', 'A guardian shows its strength'],
  rematch: ['Fallen guardians can be fought again from the map', 'Fallen guardians can be fought again from the map', 'Fallen guardians can be fought again from the map'],
  ability: ['Gift · tap its icon to switch', 'F · 1 to switch', 'Gift · {lb} · {select} to switch'],
  chest: ['Strike the chest open', 'X · strike it open', '{west} · strike it open'],
  upstrike: ['Stick up + Strike', 'W + X', 'Stick up + {west}'],
  combo: ['Strike three times, quickly', 'X X X', '{west} {west} {west}'],
  trial: ['Stand in the arch · push up', 'Stand in the arch · W', 'Stand in the arch · stick up'],
};

const BUTTONS: [string, string, string][] = [
  ['jump', 'Jump', 'M12 19V6M6.5 11 12 5.500 17.500 11'],
  ['attack', 'Strike', 'M5 19 18 6M14 5.500h4.500V10M5 14l5 5'],
  ['dash', 'Dash', 'M5 7l5 5-5 5M12 7l5 5-5 5'],
  ['light', 'Light', 'M12 3v3M12 18v3M3 12h3M18 12h3M12 8.500a3.500 3.500 0 1 0 0 7 3.500 3.500 0 0 0 0-7z'],
  ['heal', 'Mend', 'M12 20s-7-4.300-7-9.500A3.800 3.800 0 0 1 12 8a3.800 3.800 0 0 1 7 2.500C19 15.700 12 20 12 20z'],
  ['ability', 'Gift', 'M12 3l8 9-8 9-8-9z'],
];

/**
 * In-play overlay: health, Lumen, Tide Essence, guardian bar, prompts, and the touch pad.
 * Values are only written to the DOM when they change.
 */
export class Hud {
  readonly root: HTMLElement;
  readonly pad: HTMLElement;
  private readonly masks: HTMLElement;
  private readonly lumen: HTMLElement;
  private readonly essence: HTMLElement;
  private readonly shells: HTMLElement;
  private readonly boss: HTMLElement;
  private readonly bossName: HTMLElement;
  private readonly bossFill: HTMLElement;
  private readonly timer: HTMLElement;
  private readonly gift: HTMLButtonElement;
  private readonly giftName: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly card: HTMLElement;
  private readonly note: HTMLElement;
  private readonly distance: HTMLElement;
  private readonly wallet: HTMLElement;
  private readonly plasmaText: HTMLElement;
  private readonly carryText: HTMLElement;
  private readonly diamondText: HTMLElement;
  private readonly relic: HTMLButtonElement;
  private readonly relicName: HTMLElement;
  private lastWallet = '';
  private readonly drills: HTMLElement;
  private lastDrills = '';
  private last = '';
  private lastBoss = '';
  private lastHint: string | null = null;
  private lastMode: InputMode | null = null;
  private lastTimer = -1;
  private lastGift = '';
  private lastDistance = -1;
  private cardTimer = 0;
  private noteTimer = 0;
  onPause: (() => void) | null = null;
  onCycle: (() => void) | null = null;
  onRelic: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.masks = h('div', { class: 'hud-masks', role: 'img' });
    this.lumen = h('i');
    this.essence = h('div', { class: 'hud-essence' });
    this.shells = h('div', { class: 'hud-shells' });
    this.bossName = h('span');
    this.bossFill = h('i');
    this.boss = h('div', { class: 'hud-boss' }, this.bossName, h('div', { class: 'boss-bar' }, this.bossFill));
    this.timer = h('div', { class: 'hud-timer' });
    this.distance = h('div', { class: 'hud-distance' });
    this.giftName = h('span');
    this.gift = h('button', { class: 'hud-gift', 'aria-label': 'Switch gift', onclick: () => this.onCycle?.() }, icon('pulse', 18), this.giftName);
    this.plasmaText = h('span');
    this.carryText = h('small');
    this.diamondText = h('span');
    this.wallet = h(
      'div',
      { class: 'hud-wallet', role: 'status', 'aria-live': 'off' },
      h('div', { class: 'coin plasma' }, h('i', { class: 'gem plasma-gem' }), this.plasmaText, this.carryText),
      h('div', { class: 'coin diamond' }, h('i', { class: 'gem diamond-gem' }), this.diamondText),
    );
    this.drills = h('div', { class: 'hud-drills', role: 'status' });
    this.relicName = h('span');
    this.relic = h('button', { class: 'hud-relic', 'aria-label': 'Use relic', onclick: () => this.onRelic?.() }, icon('chest', 18), this.relicName);
    const pause = h('button', { class: 'hud-btn hud-pause', 'aria-label': 'Pause', onclick: () => this.onPause?.() }, icon('pause', 22));
    this.hint = h('div', { class: 'hud-hint' });
    this.card = h('div', { class: 'hud-card' });
    this.note = h('div', { class: 'hud-note' });
    const buttons = h('div', { class: 'pad-buttons' });
    for (const [name, label, path] of BUTTONS) {
      buttons.append(
        h('button', {
          class: `pad-btn pad-${name}`,
          'data-btn': name,
          'aria-label': label,
          html: `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg><span>${label}</span>`,
        }),
      );
    }
    this.pad = h('div', { class: 'pad' }, h('div', { class: 'pad-stick' }, h('div', { class: 'pad-base' }, h('div', { class: 'pad-knob' }))), buttons);
    this.root = h(
      'div',
      { class: 'hud' },
      h('div', { class: 'hud-top' }, this.masks, h('div', { class: 'hud-lumen' }, this.lumen), h('div', { class: 'hud-row' }, this.essence, this.shells)),
      this.gift,
      this.relic,
      this.wallet,
      this.drills,
      this.boss,
      this.timer,
      this.distance,
      pause,
      this.hint,
      this.card,
      this.note,
      this.pad,
    );
    parent.append(this.root);
    this.setVisible(false);
  }

  setVisible(on: boolean): void {
    this.root.classList.toggle('on', on);
  }

  setHanded(handed: 'left' | 'right'): void {
    this.root.classList.toggle('left-handed', handed === 'left');
  }

  setMode(mode: 'story' | 'drift'): void {
    this.root.dataset.mode = mode;
    this.distance.textContent = '';
    this.lastDistance = -1;
    this.last = '';
  }

  setShells(total: number, taken: boolean[]): void {
    this.shells.replaceChildren(...Array.from({ length: total }, (_, i) => h('span', { class: `pip${taken[i] ? ' got' : ''}` }, icon('shell', 16))));
  }

  /** Health masks, Lumen bar and Essence pips. Shapes, not just colours: full, empty, filling. */
  update(hp: number, hpMax: number, lumen: number, essence: number, essenceMax: number, healing: boolean, danger: number): void {
    const key = `${hp}/${hpMax}/${Math.round(lumen * 40)}/${Math.floor(essence * 5)}/${essenceMax}/${healing ? 1 : 0}/${danger > 0.6 ? 1 : 0}`;
    if (key === this.last) return;
    this.last = key;
    if (this.masks.childElementCount !== hpMax) this.masks.replaceChildren(...Array.from({ length: hpMax }, () => h('span', { class: 'mask' })));
    Array.from(this.masks.children).forEach((el, i) => el.classList.toggle('full', i < hp));
    this.masks.setAttribute('aria-label', `Health ${hp} of ${hpMax}`);
    this.masks.classList.toggle('low', hp <= 1);
    this.masks.classList.toggle('healing', healing);
    this.lumen.style.transform = `scaleX(${Math.max(0, Math.min(1, lumen)).toFixed(3)})`;
    if (this.essence.childElementCount !== essenceMax) this.essence.replaceChildren(...Array.from({ length: essenceMax }, () => h('span', { class: 'drop' }, h('i'))));
    Array.from(this.essence.children).forEach((el, i) => {
      const fill = Math.max(0, Math.min(1, essence - i));
      (el.firstElementChild as HTMLElement).style.transform = `scaleY(${fill.toFixed(2)})`;
      el.classList.toggle('full', fill >= 1);
    });
    this.root.classList.toggle('danger', danger > 0.6);
  }

  /** Guardian name and health; pass null to hide. */
  setBoss(name: string | null, frac: number): void {
    const key = name === null ? '' : `${name}:${Math.round(frac * 200)}`;
    if (key === this.lastBoss) return;
    this.lastBoss = key;
    this.boss.classList.toggle('on', name !== null);
    if (name !== null) {
      this.bossName.textContent = name;
      this.bossFill.style.transform = `scaleX(${Math.max(0, frac).toFixed(3)})`;
    }
  }

  setTimer(seconds: number | null): void {
    const s = seconds === null ? -1 : Math.ceil(seconds);
    if (s === this.lastTimer) return;
    this.lastTimer = s;
    this.timer.textContent = s < 0 ? '' : `${Math.floor(s / 60)}:${s % 60 < 10 ? '0' : ''}${s % 60}`;
    this.timer.classList.toggle('low', s >= 0 && s <= 10);
  }

  /** The equipped boss gift and whether it is ready. */
  setGift(name: string | null, ready: boolean): void {
    const key = `${name}:${ready}`;
    if (key === this.lastGift) return;
    this.lastGift = key;
    this.gift.classList.toggle('on', name !== null);
    this.gift.classList.toggle('ready', ready);
    this.giftName.textContent = name ?? '';
    this.root.classList.toggle('has-gift', name !== null);
  }

  /** Plasma (with the part not yet banked at a lantern), diamonds, and the relic in hand. */
  setWallet(plasma: number, carried: number, diamonds: number, relic: string | null, count: number): void {
    const key = `${plasma}/${carried}/${diamonds}/${relic}/${count}`;
    if (key === this.lastWallet) return;
    this.lastWallet = key;
    this.plasmaText.textContent = String(plasma);
    this.carryText.textContent = carried > 0 ? `+${carried} unbanked` : '';
    this.diamondText.textContent = String(diamonds);
    this.relic.classList.toggle('on', relic !== null && count > 0);
    this.relicName.textContent = relic ? `${relic} ×${count}` : '';
  }

  /**
   * Training checklist: moves mastered out of all, and the moves the next gate is waiting for,
   * each with a pip per repetition (filled pips, not colour alone, show what is done).
   */
  setDrills(done: number, total: number, items: { name: string; n: number; need: number }[] | null): void {
    const key = items === null ? '' : `${done}/${total}/${items.map((i) => `${i.name}${i.n}`).join(',')}`;
    if (key === this.lastDrills) return;
    this.lastDrills = key;
    this.drills.classList.toggle('on', items !== null);
    if (!items) return;
    this.drills.replaceChildren(
      h('div', { class: 'drill-head', text: done >= total ? 'Training complete' : `Training · ${done}/${total} moves` }),
      ...items.map((i) =>
        h(
          'div',
          { class: `drill${i.n >= i.need ? ' done' : ''}` },
          h('span', { text: i.name }),
          h('span', { class: 'pips', 'aria-label': `${i.n} of ${i.need}` }, ...Array.from({ length: i.need }, (_, k) => h('i', { class: k < i.n ? 'on' : '' }))),
        ),
      ),
    );
  }

  setDistance(metres: number): void {
    const m = Math.floor(metres);
    if (m === this.lastDistance) return;
    this.lastDistance = m;
    this.distance.textContent = `${m} m`;
  }

  setHint(kind: HintKind | null, mode: InputMode = 'touch', family: PadFamily | null = null): void {
    const key = kind ? `${kind}:${mode}:${family}` : null;
    if (key === this.lastHint) return;
    this.lastHint = key;
    if (!kind) {
      this.hint.classList.remove('on');
      return;
    }
    const [touch, keys, pad] = HINT_TEXT[kind];
    this.hint.textContent = mode === 'pad' ? padText(pad, family) : mode === 'keys' ? keys : touch;
    this.hint.classList.add('on');
  }

  /** The touch pad steps aside while a keyboard or controller is in use. */
  setInputMode(mode: InputMode): void {
    if (mode === this.lastMode) return;
    this.lastMode = mode;
    this.root.classList.toggle('pad-hidden', mode !== 'touch');
  }

  showCard(eyebrow: string, title: string, line: string): void {
    this.card.replaceChildren(h('span', { class: 'card-num', text: eyebrow }), h('h2', { text: title }), h('p', { text: line }));
    this.card.classList.add('on');
    window.clearTimeout(this.cardTimer);
    this.cardTimer = window.setTimeout(() => this.card.classList.remove('on'), 3200);
  }

  showNote(text: string, iconName?: string): void {
    this.note.replaceChildren(...(iconName ? [icon(iconName, 18)] : []), h('span', { text }));
    this.note.classList.add('on');
    window.clearTimeout(this.noteTimer);
    this.noteTimer = window.setTimeout(() => this.note.classList.remove('on'), 3000);
  }

  hideCard(): void {
    this.card.classList.remove('on');
    this.note.classList.remove('on');
  }
}
