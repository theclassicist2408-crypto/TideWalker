import type { ControlButton } from './controls';

/**
 * Logical buttons, numbered as in the W3C "standard" layout. Face buttons are named by position
 * (south = bottom), so one table works for Xbox, PlayStation and Switch controllers alike.
 */
const SOUTH = 0;
const EAST = 1;
const WEST = 2;
const NORTH = 3;
const LB = 4;
const RB = 5;
const LT = 6;
const RT = 7;
const SELECT = 8;
const START = 9;
const LS = 10;
const RS = 11;
const UP = 12;
const DOWN = 13;
const LEFT = 14;
const RIGHT = 15;
const HOME = 16;

/** Which pad buttons drive each action in play. Dash also sits on the left trigger. */
const PLAY: [ControlButton, number[]][] = [
  ['jump', [SOUTH]],
  ['attack', [WEST]],
  ['dash', [EAST, LT]],
  ['light', [NORTH]],
  ['heal', [RB]],
  ['ability', [LB]],
  ['item', [RT]],
];

export type PadFamily = 'xbox' | 'playstation' | 'nintendo' | 'generic';
export type PadGlyph = 'south' | 'east' | 'west' | 'north' | 'lb' | 'rb' | 'lt' | 'rt' | 'select' | 'start';

/** What each controller calls its buttons, so prompts match the controller in hand. */
export const PAD_LABELS: Record<PadFamily, Record<PadGlyph, string>> = {
  xbox: { south: 'A', east: 'B', west: 'X', north: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT', select: 'View', start: 'Menu' },
  playstation: { south: '✕', east: '○', west: '□', north: '△', lb: 'L1', rb: 'R1', lt: 'L2', rt: 'R2', select: 'Create', start: 'Options' },
  // Nintendo's A sits on the right and B at the bottom: positions stay, names follow the pad.
  nintendo: { south: 'B', east: 'A', west: 'Y', north: 'X', lb: 'L', rb: 'R', lt: 'ZL', rt: 'ZR', select: '−', start: '+' },
  generic: { south: 'A', east: 'B', west: 'X', north: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT', select: 'Select', start: 'Start' },
};

export const PAD_NAMES: Record<PadFamily, string> = {
  xbox: 'Xbox controller',
  playstation: 'PlayStation controller',
  nintendo: 'Switch controller',
  generic: 'Controller',
};

/** USB vendor ids of the big three; the rest are told apart by name. */
const VENDORS: Record<string, PadFamily> = { '054c': 'playstation', '045e': 'xbox', '057e': 'nintendo' };

/**
 * Works out the controller's family from `Gamepad.id`. Browsers format it differently:
 * Chrome "DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)",
 * Firefox "54c-ce6-DualSense Wireless Controller", Safari just the product name.
 */
export function padFamily(id: string): PadFamily {
  const s = id.toLowerCase();
  const chrome = /vendor:\s*([0-9a-f]{1,4})/.exec(s);
  const firefox = /^([0-9a-f]{1,4})-[0-9a-f]{1,4}-/.exec(s);
  const vendor = (chrome?.[1] ?? firefox?.[1] ?? '').padStart(4, '0');
  if (VENDORS[vendor]) return VENDORS[vendor];
  if (/dualsense|dualshock|playstation|ps[345]\b|sony/.test(s)) return 'playstation';
  if (/xbox|xinput|x-box/.test(s)) return 'xbox';
  if (/nintendo|switch|pro controller|joy-con/.test(s)) return 'nintendo';
  return 'generic';
}

/**
 * Raw button order for controllers the browser does not remap ("mapping" empty), given as the
 * logical button each raw index means. Sony pads over HID put the square button first.
 */
const RAW: Record<PadFamily, number[]> = {
  playstation: [WEST, SOUTH, EAST, NORTH, LB, RB, LT, RT, SELECT, START, LS, RS, HOME],
  nintendo: [SOUTH, EAST, WEST, NORTH, LB, RB, LT, RT, SELECT, START, LS, RS, HOME],
  xbox: [SOUTH, EAST, WEST, NORTH, LB, RB, LT, RT, SELECT, START, LS, RS, HOME, UP, DOWN, LEFT, RIGHT],
  generic: [SOUTH, EAST, WEST, NORTH, LB, RB, LT, RT, SELECT, START, LS, RS, HOME],
};

/** A raw device counts as a controller only if its name says so: other HID devices can look like gamepads. */
function looksLikePad(p: Gamepad): boolean {
  if (p.buttons.length < 8 || p.axes.length < 2) return false;
  return padFamily(p.id) !== 'generic' || /game ?pad|controller|joystick|joypad|8bitdo/i.test(p.id);
}

/** D-pad directions of a hat-switch axis, in eighths clockwise from up. */
const HAT: [number, number][] = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

interface Slot {
  down: Set<number>;
  prev: Set<number>;
  /** False until the pad has been read once: whatever it holds then is not a press. */
  seen: boolean;
  /** Axis that rests outside -1..1, which is how a hat switch (d-pad) reports "centred". */
  hat: number;
  alive: boolean;
}

export interface PadFrame {
  /** Stick or d-pad, each axis -1..1, already through a dead zone. */
  x: number;
  y: number;
  /** Logical buttons down this frame, and which went down since the last frame. */
  down: Set<number>;
  pressed: Set<number>;
  family: PadFamily;
}

interface Actuator {
  playEffect?: (type: string, params: Record<string, number>) => Promise<unknown>;
  pulse?: (value: number, duration: number) => Promise<unknown>;
}

/**
 * Reads gamepads once per frame on top of `navigator.getGamepads()`. With several connected, the
 * one pressed most recently is in charge. Pure bookkeeping: the result says what is held and
 * what was just pressed, in logical buttons.
 */
export class GamepadReader {
  private readonly slots = new Map<number, Slot>();
  private active = -1;
  private readonly frameOut: PadFrame = { x: 0, y: 0, down: new Set(), pressed: new Set(), family: 'generic' };
  connected = false;
  family: PadFamily = 'generic';

  read(): PadFrame | null {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const s of this.slots.values()) s.alive = false;
    let first: Gamepad | null = null;
    let current: Gamepad | null = null;
    let woke: Gamepad | null = null;
    for (const p of pads) {
      if (!p || !p.connected || (p.mapping !== 'standard' && !looksLikePad(p))) continue;
      let slot = this.slots.get(p.index);
      if (!slot) {
        slot = { down: new Set(), prev: new Set(), seen: false, hat: -1, alive: true };
        this.slots.set(p.index, slot);
      }
      slot.alive = true;
      this.collect(p, slot);
      first = first ?? p;
      if (p.index === this.active) current = p;
      else if (!woke && slot.seen) for (const i of slot.down) if (!slot.prev.has(i)) woke = p;
    }
    for (const [i, s] of this.slots) if (!s.alive) this.slots.delete(i);
    const pad = woke ?? current ?? first;
    this.connected = pad !== null;
    if (!pad) {
      this.active = -1;
      return null;
    }
    // The press that hands control to another pad still counts as a press.
    this.active = pad.index;
    this.family = padFamily(pad.id);
    const slot = this.slots.get(pad.index)!;
    const f = this.frameOut;
    f.family = this.family;
    f.down.clear();
    f.pressed.clear();
    for (const i of slot.down) {
      f.down.add(i);
      if (slot.seen && !slot.prev.has(i)) f.pressed.add(i);
    }
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    // A round dead zone, then each axis must be clearly meant: no drifting into crouches.
    const mag = Math.hypot(ax, ay);
    f.x = mag > 0.28 && Math.abs(ax) > 0.3 ? ax : 0;
    f.y = mag > 0.28 && Math.abs(ay) > 0.45 ? ay : 0;
    if (f.down.has(LEFT)) f.x = -1;
    if (f.down.has(RIGHT)) f.x = 1;
    if (f.down.has(UP)) f.y = -1;
    if (f.down.has(DOWN)) f.y = 1;
    this.settle();
    return f;
  }

  /** Moves this frame's buttons into `prev` for every pad, so next frame can find new presses. */
  private settle(): void {
    for (const s of this.slots.values()) {
      const t = s.prev;
      s.prev = s.down;
      s.down = t;
      s.seen = true;
    }
  }

  private collect(p: Gamepad, slot: Slot): void {
    const out = slot.down;
    out.clear();
    const raw = p.mapping === 'standard' ? null : RAW[padFamily(p.id)];
    for (let i = 0; i < p.buttons.length; i++) {
      const b = p.buttons[i];
      if (!(b.pressed || b.value > 0.5)) continue;
      const logical = raw ? raw[i] : i;
      if (logical !== undefined) out.add(logical);
    }
    if (!raw) return;
    // Unmapped pads often report the d-pad as one hat axis; find it by its resting value.
    if (slot.hat < 0) for (let a = 2; a < p.axes.length; a++) if (Math.abs(p.axes[a]) > 1.05) slot.hat = a;
    const v = slot.hat >= 0 ? p.axes[slot.hat] : 2;
    if (Math.abs(v) <= 1.0001) {
      const d = HAT[Math.round(((v + 1) * 7) / 2) & 7];
      if (d[0] < 0) out.add(LEFT);
      if (d[0] > 0) out.add(RIGHT);
      if (d[1] < 0) out.add(UP);
      if (d[1] > 0) out.add(DOWN);
    }
  }

  /** Rumbles the controller in use. Magnitudes 0..1; silently does nothing where unsupported. */
  rumble(strong: number, weak: number, ms: number): void {
    if (this.active < 0 || typeof navigator === 'undefined' || !navigator.getGamepads) return;
    let pad: Gamepad | null = null;
    for (const p of navigator.getGamepads()) if (p && p.index === this.active) pad = p;
    if (!pad) return;
    const g = pad as unknown as { vibrationActuator?: Actuator; hapticActuators?: Actuator[] };
    try {
      const v = g.vibrationActuator;
      if (v?.playEffect) {
        v.playEffect('dual-rumble', { startDelay: 0, duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => undefined);
        return;
      }
      g.hapticActuators?.[0]?.pulse?.(Math.max(strong, weak), ms)?.catch(() => undefined);
    } catch {
      // Rumble is optional feedback.
    }
  }
}

export const PAD = { SOUTH, EAST, WEST, NORTH, LB, RB, LT, RT, SELECT, START, LS, RS, UP, DOWN, LEFT, RIGHT, HOME, PLAY };
