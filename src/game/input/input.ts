import { newIntent, type Intent } from '../core/types';
import { Controls, type ControlButton } from './controls';

const KEYS: Record<string, ControlButton> = {
  Space: 'jump',
  KeyZ: 'jump',
  KeyX: 'attack',
  KeyJ: 'attack',
  KeyC: 'dash',
  KeyK: 'dash',
  ShiftLeft: 'dash',
  KeyV: 'light',
  KeyL: 'light',
  KeyE: 'light',
  KeyH: 'heal',
  KeyR: 'heal',
  KeyF: 'ability',
  KeyG: 'item',
};
const DIRS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
};

/**
 * Binds the on-screen pad and the keyboard to one Intent. The pad is plain DOM: a floating
 * stick on one side and action buttons on the other, each tracking its own pointer so
 * several can be held at once.
 */
export class InputManager {
  readonly controls = new Controls();
  private readonly keys = new Set<string>();
  private readonly intent = newIntent();
  private enabled = false;
  private usingKeys = false;
  private stickPointer = -1;
  private stickX = 0;
  private stickY = 0;
  private knob: HTMLElement | null = null;
  private base: HTMLElement | null = null;
  onFirstGesture: (() => void) | null = null;
  onPauseKey: (() => void) | null = null;
  /** Called when the player asks to switch boss gifts (Q, or tapping the gift icon). */
  onCycle: (() => void) | null = null;
  /** Called when the player asks to switch relics (T). */
  onCycleRelic: (() => void) | null = null;
  private gestureSeen = false;

  constructor(pad: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.release());
    this.bindPad(pad);
  }

  get keyboardActive(): boolean {
    return this.usingKeys;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.release();
  }

  reset(): void {
    this.controls.reset();
    this.keys.clear();
    this.centreStick();
  }

  release(): void {
    this.controls.reset();
    this.keys.clear();
    this.centreStick();
  }

  private first(): void {
    if (this.gestureSeen) return;
    this.gestureSeen = true;
    this.onFirstGesture?.();
  }

  private centreStick(): void {
    this.stickPointer = -1;
    if (this.knob) this.knob.style.transform = '';
    this.base?.classList.remove('on');
  }

  private bindPad(pad: HTMLElement): void {
    const zone = pad.querySelector<HTMLElement>('.pad-stick');
    this.base = pad.querySelector<HTMLElement>('.pad-base');
    this.knob = pad.querySelector<HTMLElement>('.pad-knob');
    const opts: AddEventListenerOptions = { passive: false };
    if (zone) {
      zone.addEventListener(
        'pointerdown',
        (e) => {
          this.first();
          if (!this.enabled || this.stickPointer !== -1) return;
          e.preventDefault();
          this.usingKeys = false;
          this.stickPointer = e.pointerId;
          zone.setPointerCapture?.(e.pointerId);
          this.stickX = e.clientX;
          this.stickY = e.clientY;
          // The stick appears under the thumb, wherever it lands.
          if (this.base) {
            const r = zone.getBoundingClientRect();
            this.base.style.left = `${e.clientX - r.left}px`;
            this.base.style.top = `${e.clientY - r.top}px`;
            this.base.classList.add('on');
          }
        },
        opts,
      );
      const move = (e: PointerEvent): void => {
        if (e.pointerId !== this.stickPointer) return;
        e.preventDefault();
        const reach = 44;
        const dx = Math.max(-reach, Math.min(reach, e.clientX - this.stickX));
        const dy = Math.max(-reach, Math.min(reach, e.clientY - this.stickY));
        this.controls.stick(dx / reach, dy / reach);
        if (this.knob) this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      };
      const end = (e: PointerEvent): void => {
        if (e.pointerId !== this.stickPointer) return;
        this.controls.stick(0, 0);
        this.centreStick();
      };
      zone.addEventListener('pointermove', move, opts);
      zone.addEventListener('pointerup', end, opts);
      zone.addEventListener('pointercancel', end, opts);
    }
    pad.querySelectorAll<HTMLElement>('[data-btn]').forEach((el) => {
      const name = el.dataset.btn as ControlButton;
      const down = (e: PointerEvent): void => {
        this.first();
        if (!this.enabled) return;
        e.preventDefault();
        this.usingKeys = false;
        el.setPointerCapture?.(e.pointerId);
        el.classList.add('down');
        this.controls.press(name, e.timeStamp);
      };
      const up = (e: PointerEvent): void => {
        el.classList.remove('down');
        this.controls.release(name, e.timeStamp);
      };
      el.addEventListener('pointerdown', down, opts);
      el.addEventListener('pointerup', up, opts);
      el.addEventListener('pointercancel', up, opts);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.first();
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (!e.repeat) this.onPauseKey?.();
      return;
    }
    if (!this.enabled) return;
    if (e.code === 'KeyQ') {
      if (!e.repeat) this.onCycle?.();
      return;
    }
    if (e.code === 'KeyT') {
      if (!e.repeat) this.onCycleRelic?.();
      return;
    }
    const button = KEYS[e.code];
    if (!button && !DIRS[e.code]) return;
    e.preventDefault();
    this.usingKeys = true;
    if (e.repeat) return;
    this.keys.add(e.code);
    if (button) this.controls.press(button, e.timeStamp);
    this.applyKeys();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (!this.keys.delete(e.code)) return;
    const button = KEYS[e.code];
    // Two keys can share an action; release only when none is still down.
    if (button && ![...this.keys].some((k) => KEYS[k] === button)) this.controls.release(button, e.timeStamp);
    this.applyKeys();
  };

  private applyKeys(): void {
    let x = 0;
    let y = 0;
    for (const k of this.keys) {
      const d = DIRS[k];
      if (d) {
        x += d[0];
        y += d[1];
      }
    }
    this.controls.stick(Math.sign(x), Math.sign(y));
  }

  /** The relic badge was tapped: use the relic once. */
  tapItem(): void {
    if (!this.enabled) return;
    const t = performance.now();
    this.controls.press('item', t);
    this.controls.release('item', t);
  }

  /** Current intent. Call once per simulation step; edge actions are consumed. */
  read(nowMs: number): Intent {
    this.controls.read(nowMs, this.intent);
    return this.intent;
  }
}
