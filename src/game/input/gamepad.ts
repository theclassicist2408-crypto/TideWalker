import type { ControlButton } from './controls';

/** Standard-mapping button indices (W3C Gamepad "standard" layout). */
const A = 0;
const B = 1;
const X = 2;
const Y = 3;
const LB = 4;
const RB = 5;
const RT = 7;
const SELECT = 8;
const START = 9;
const UP = 12;
const DOWN = 13;
const LEFT = 14;
const RIGHT = 15;

/** Which pad button drives which action in play. */
const PLAY: [number, ControlButton][] = [
  [A, 'jump'],
  [X, 'attack'],
  [B, 'dash'],
  [Y, 'light'],
  [RB, 'heal'],
  [LB, 'ability'],
  [RT, 'item'],
];

export interface PadFrame {
  /** Stick or d-pad, each axis -1..1, already through a dead zone. */
  x: number;
  y: number;
  /** Buttons down this frame, and which went down since the last frame. */
  down: Set<number>;
  pressed: Set<number>;
}

/**
 * Reads the first connected gamepad once per frame. Pure bookkeeping on top of
 * `navigator.getGamepads()`: the result says what is held and what was just pressed.
 */
export class GamepadReader {
  private prev = new Set<number>();
  /** Index of the pad last read; a new one starts with its held buttons counted as old. */
  private padIndex = -1;
  private readonly frameOut: PadFrame = { x: 0, y: 0, down: new Set(), pressed: new Set() };
  connected = false;

  read(): PadFrame | null {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    // Only controllers with the standard layout: other HID devices can masquerade as gamepads.
    let pad: Gamepad | null = null;
    for (const p of pads) if (p && p.connected && p.mapping === 'standard') pad = pad ?? p;
    this.connected = pad !== null;
    if (!pad) {
      this.prev.clear();
      this.padIndex = -1;
      return null;
    }
    const fresh = pad.index !== this.padIndex;
    this.padIndex = pad.index;
    const f = this.frameOut;
    f.down.clear();
    f.pressed.clear();
    for (let i = 0; i < pad.buttons.length; i++) {
      const b = pad.buttons[i];
      if (b.pressed || b.value > 0.5) f.down.add(i);
    }
    // Whatever is already held when a pad appears is not a press.
    if (!fresh) for (const i of f.down) if (!this.prev.has(i)) f.pressed.add(i);
    this.prev.clear();
    for (const i of f.down) this.prev.add(i);
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    f.x = Math.abs(ax) > 0.3 ? ax : 0;
    f.y = Math.abs(ay) > 0.45 ? ay : 0;
    if (f.down.has(LEFT)) f.x = -1;
    if (f.down.has(RIGHT)) f.x = 1;
    if (f.down.has(UP)) f.y = -1;
    if (f.down.has(DOWN)) f.y = 1;
    return f;
  }
}

export const PAD = { A, B, X, Y, LB, RB, RT, SELECT, START, UP, DOWN, LEFT, RIGHT, PLAY };
