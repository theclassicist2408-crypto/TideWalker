import { newIntent, type Intent } from '../core/types';
import { Controls, type ControlButton } from './controls';
import { GamepadReader, PAD, PAD_NAMES, type PadFamily } from './gamepad';

/** Which device the player last used: prompts and the touch pad follow it. */
export type InputMode = 'touch' | 'keys' | 'pad';
export type MenuAction = 'prev' | 'next' | 'left' | 'right' | 'choose' | 'back';

/** Holding a direction on a menu repeats after this delay, then at this interval (ms). */
const NAV_DELAY = 380;
const NAV_REPEAT = 120;

/**
 * Keyboard: everything sits around WASD so the left hand never travels. The mouse adds strike
 * (left button) and light (right button) for the right hand.
 */
const KEYS: Record<string, ControlButton> = {
  Space: 'jump',
  KeyX: 'attack',
  KeyJ: 'attack',
  ShiftLeft: 'dash',
  ShiftRight: 'dash',
  KeyE: 'light',
  KeyQ: 'heal',
  KeyF: 'ability',
  KeyR: 'item',
};
/** Switch gift / switch relic. */
const CYCLE_GIFT = 'Digit1';
const CYCLE_RELIC = 'Digit2';
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
  private inputMode: InputMode = 'touch';
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
  private readonly pad = new GamepadReader();
  /** True while the gamepad's stick is steering, so the keyboard does not override it. */
  private padSteering = false;
  private padHeld = new Set<ControlButton>();
  /** Menu direction held on the pad (-1, 0, 1 per axis) and when it next repeats. */
  private navX = 0;
  private navY = 0;
  private navAt = 0;
  /** Family of the connected controller, or null: compared each frame to announce changes. */
  private padSeen: PadFamily | null = null;
  /** Called when a controller or arrow key asks to move through a menu, choose or go back. */
  onMenu: ((action: MenuAction) => void) | null = null;
  /** Called when a controller is connected (its name) or the last one is lost (null). */
  onPadChange: ((name: string | null, family: PadFamily | null) => void) | null = null;

  constructor(pad: HTMLElement, field: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.release());
    this.bindPad(pad);
    this.bindMouse(field);
  }

  /** Mouse on the play field: left button strikes (hold to charge), right button is light. */
  private bindMouse(field: HTMLElement): void {
    const button = (b: number): ControlButton | null => (b === 0 ? 'attack' : b === 2 ? 'light' : null);
    field.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.first();
      const name = button(e.button);
      if (!this.enabled || !name) return;
      e.preventDefault();
      this.inputMode = 'keys';
      this.controls.press(name, e.timeStamp);
    });
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'mouse') return;
      const name = button(e.button);
      if (name) this.controls.release(name, e.timeStamp);
    });
    // Right-click is a game button here, not a menu.
    field.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** The device the player last used. */
  get mode(): InputMode {
    return this.inputMode;
  }

  /** The family of the controller in use, for button prompts; null when none is connected. */
  get padFamily(): PadFamily | null {
    return this.pad.connected ? this.pad.family : null;
  }

  /** Rumbles the controller, only while it is the device being played with. */
  rumble(strong: number, weak: number, ms: number): void {
    if (this.inputMode === 'pad') this.pad.rumble(strong, weak, ms);
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
    this.padHeld.clear();
    this.padSteering = false;
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
          this.inputMode = 'touch';
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
        this.inputMode = 'touch';
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
    if (!this.enabled) {
      // Menus: arrows move between buttons (Enter and Space press them, as browsers do).
      const nav: MenuAction | null = e.code === 'ArrowUp' ? 'prev' : e.code === 'ArrowDown' ? 'next' : e.code === 'ArrowLeft' ? 'left' : e.code === 'ArrowRight' ? 'right' : null;
      const inField = e.target instanceof HTMLInputElement;
      if (nav && !inField) {
        e.preventDefault();
        this.onMenu?.(nav);
      }
      return;
    }
    if (e.code === CYCLE_GIFT) {
      if (!e.repeat) this.onCycle?.();
      return;
    }
    if (e.code === CYCLE_RELIC) {
      if (!e.repeat) this.onCycleRelic?.();
      return;
    }
    const button = KEYS[e.code];
    if (!button && !DIRS[e.code]) return;
    e.preventDefault();
    this.inputMode = 'keys';
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

  /**
   * Polls the controllers once per frame. In play the pad feeds the same Controls as touch and
   * keys; on menus it moves focus (holding repeats), chooses and goes back. Start pauses,
   * Select switches gifts.
   */
  pollGamepad(now: number, playing: boolean): void {
    const f = this.pad.read();
    const family = f ? f.family : null;
    if (family !== this.padSeen) {
      this.padSeen = family;
      if (!family) {
        this.releasePad(now);
        if (this.inputMode === 'pad') this.inputMode = 'keys';
      }
      this.onPadChange?.(family ? PAD_NAMES[family] : null, family);
    }
    if (!f) return;
    if (f.pressed.size > 0 || f.x !== 0 || f.y !== 0) {
      this.first();
      this.inputMode = 'pad';
    }
    if (f.pressed.has(PAD.START)) this.onPauseKey?.();
    if (!playing || !this.enabled) {
      this.releasePad(now);
      this.menuNav(f.x, f.y, now);
      // Switch controllers confirm with the right button (A) and go back with the bottom one (B).
      const nintendo = f.family === 'nintendo';
      if (f.pressed.has(nintendo ? PAD.EAST : PAD.SOUTH)) this.onMenu?.('choose');
      if (f.pressed.has(nintendo ? PAD.SOUTH : PAD.EAST)) this.onMenu?.('back');
      return;
    }
    this.navX = this.navY = 0;
    if (f.pressed.has(PAD.SELECT)) this.onCycle?.();
    for (const [name, buttons] of PAD.PLAY) {
      let down = false;
      for (const i of buttons) down = down || f.down.has(i);
      if (down && !this.padHeld.has(name)) {
        this.padHeld.add(name);
        this.controls.press(name, now);
      } else if (!down && this.padHeld.has(name)) {
        this.padHeld.delete(name);
        this.controls.release(name, now);
      }
    }
    if (f.x !== 0 || f.y !== 0) {
      this.padSteering = true;
      this.controls.stick(f.x, f.y);
    } else if (this.padSteering) {
      this.padSteering = false;
      this.applyKeys();
    }
  }

  /** Stick or d-pad on a menu: one step on the push, then repeats while held. */
  private menuNav(x: number, y: number, now: number): void {
    const dx = Math.abs(x) > 0.6 ? Math.sign(x) : 0;
    const dy = Math.abs(y) > 0.6 ? Math.sign(y) : 0;
    const changed = dx !== this.navX || dy !== this.navY;
    this.navX = dx;
    this.navY = dy;
    if (dx === 0 && dy === 0) return;
    if (!changed && now < this.navAt) return;
    this.navAt = now + (changed ? NAV_DELAY : NAV_REPEAT);
    if (dy !== 0) this.onMenu?.(dy < 0 ? 'prev' : 'next');
    else this.onMenu?.(dx < 0 ? 'left' : 'right');
  }

  private releasePad(now: number): void {
    for (const name of this.padHeld) this.controls.release(name, now);
    this.padHeld.clear();
    this.padSteering = false;
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
