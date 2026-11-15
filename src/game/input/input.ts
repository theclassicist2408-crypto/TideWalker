import { newIntent, type Intent } from '../core/types';
import { GestureRecognizer } from './gestures';

const KEY_LEFT = ['ArrowLeft', 'KeyA'];
const KEY_RIGHT = ['ArrowRight', 'KeyD'];
const KEY_UP = ['ArrowUp', 'KeyW'];
const KEY_DOWN = ['ArrowDown', 'KeyS'];
const KEY_JUMP = ['Space'];
const KEY_GLOW = ['ShiftLeft', 'ShiftRight', 'KeyG'];
const KEY_PULSE = ['KeyE', 'KeyX'];
const KEY_DASH = ['KeyQ', 'KeyC'];

/**
 * Binds touch/mouse (through the gesture recogniser) and keyboard to a single Intent.
 * Keyboard is direct control for desktop; touch latches a direction for one-thumb play.
 */
export class InputManager {
  readonly gestures = new GestureRecognizer();
  private readonly keys = new Set<string>();
  private keyJump = false;
  private keyPulse = false;
  private keyDash = false;
  private usingKeys = false;
  private enabled = false;
  private readonly intent = newIntent();
  /** Fires on the first user gesture; audio must be unlocked from one. */
  onFirstGesture: (() => void) | null = null;
  onPauseKey: (() => void) | null = null;
  private gestureSeen = false;

  constructor(private readonly surface: HTMLElement) {
    const opts: AddEventListenerOptions = { passive: false };
    surface.addEventListener('pointerdown', this.onDown, opts);
    surface.addEventListener('pointermove', this.onMove, opts);
    surface.addEventListener('pointerup', this.onUp, opts);
    surface.addEventListener('pointercancel', this.onUp, opts);
    surface.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.release());
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.release();
  }

  /** Clears latched movement (new level, respawn). */
  reset(): void {
    this.gestures.reset();
    this.keys.clear();
    this.keyJump = this.keyPulse = this.keyDash = false;
  }

  /** Drops held touches and keys but keeps the latched direction. */
  release(): void {
    this.gestures.cancel();
    this.keys.clear();
  }

  private first(): void {
    if (this.gestureSeen) return;
    this.gestureSeen = true;
    this.onFirstGesture?.();
  }

  private onDown = (e: PointerEvent): void => {
    this.first();
    if (!this.enabled) return;
    e.preventDefault();
    this.usingKeys = false;
    this.surface.setPointerCapture?.(e.pointerId);
    this.gestures.down(e.pointerId, e.clientX, e.clientY, e.timeStamp);
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.enabled) return;
    e.preventDefault();
    this.gestures.move(e.pointerId, e.clientX, e.clientY, e.timeStamp);
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.enabled) return;
    e.preventDefault();
    this.gestures.up(e.pointerId, e.clientX, e.clientY, e.timeStamp);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    this.first();
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (!e.repeat) this.onPauseKey?.();
      return;
    }
    if (!this.enabled) return;
    const known = [KEY_LEFT, KEY_RIGHT, KEY_UP, KEY_DOWN, KEY_JUMP, KEY_GLOW, KEY_PULSE, KEY_DASH].some((k) => k.includes(e.code));
    if (!known) return;
    e.preventDefault();
    this.usingKeys = true;
    if (e.repeat) return;
    this.keys.add(e.code);
    if (KEY_JUMP.includes(e.code) || KEY_UP.includes(e.code)) this.keyJump = true;
    if (KEY_PULSE.includes(e.code)) this.keyPulse = true;
    if (KEY_DASH.includes(e.code)) this.keyDash = true;
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  /** True while the player is driving with the keyboard (hints then show keys). */
  get keyboardActive(): boolean {
    return this.usingKeys;
  }

  private held(codes: string[]): boolean {
    for (const c of codes) if (this.keys.has(c)) return true;
    return false;
  }

  /** Current intent. Call once per simulation step; edge actions are consumed. */
  read(nowMs: number): Intent {
    const out = this.intent;
    if (this.usingKeys) {
      this.gestures.read(nowMs, out);
      out.mx = (this.held(KEY_RIGHT) ? 1 : 0) - (this.held(KEY_LEFT) ? 1 : 0);
      out.my = (this.held(KEY_DOWN) ? 1 : 0) - (this.held(KEY_UP) ? 1 : 0);
      out.down = this.held(KEY_DOWN);
      out.jump = this.keyJump;
      out.jumpHeld = this.held(KEY_JUMP) || this.held(KEY_UP);
      out.glow = this.held(KEY_GLOW);
      out.pulse = this.keyPulse || out.pulse;
      out.dash = this.keyDash;
      this.gestures.lx = 0;
      this.gestures.ly = 0;
    } else {
      this.gestures.read(nowMs, out);
    }
    this.keyJump = this.keyPulse = this.keyDash = false;
    return out;
  }
}
