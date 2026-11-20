import { afterEach, describe, expect, it, vi } from 'vitest';
import { Haptics } from '../src/game/effects/haptics';
import { GamepadReader, PAD, PAD_LABELS, padFamily } from '../src/game/input/gamepad';
import { padText } from '../src/game/ui/hud';

interface FakePad {
  connected: boolean;
  mapping: string;
  index: number;
  id: string;
  axes: number[];
  buttons: { pressed: boolean; value: number }[];
  vibrationActuator?: { playEffect: ReturnType<typeof vi.fn> };
}

function pad(buttons: number[], o: { axes?: number[]; mapping?: string; index?: number; id?: string; count?: number } = {}): FakePad {
  const count = o.count ?? 17;
  return {
    connected: true,
    mapping: o.mapping ?? 'standard',
    index: o.index ?? 0,
    id: o.id ?? 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)',
    axes: o.axes ?? [0, 0, 0, 0],
    buttons: Array.from({ length: count }, (_, i) => ({ pressed: buttons.includes(i), value: buttons.includes(i) ? 1 : 0 })),
  };
}

function connect(...pads: FakePad[]): void {
  vi.stubGlobal('navigator', { getGamepads: () => pads });
}

describe('gamepad', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports presses only on the frame a button goes down', () => {
    const r = new GamepadReader();
    connect(pad([]));
    r.read();
    connect(pad([PAD.SOUTH]));
    expect(r.read()?.pressed.has(PAD.SOUTH)).toBe(true);
    expect(r.read()?.pressed.has(PAD.SOUTH)).toBe(false);
    expect(r.read()?.down.has(PAD.SOUTH)).toBe(true);
  });

  it('ignores buttons already held when a pad appears', () => {
    const r = new GamepadReader();
    connect(pad([PAD.SOUTH]));
    expect(r.read()?.pressed.size).toBe(0);
  });

  it('ignores unmapped devices that do not call themselves controllers', () => {
    const r = new GamepadReader();
    connect(pad([0], { mapping: '', id: 'Apple Internal Keyboard / Trackpad' }));
    expect(r.read()).toBeNull();
    connect(pad([0], { mapping: '', id: 'USB Receiver', count: 4 }));
    expect(r.read()).toBeNull();
  });

  it('the stick has a dead zone and the d-pad wins', () => {
    const r = new GamepadReader();
    connect(pad([], { axes: [0.2, 0.3] }));
    const f = r.read()!;
    expect([f.x, f.y]).toEqual([0, 0]);
    connect(pad([PAD.LEFT], { axes: [0.9, 0] }));
    expect(r.read()!.x).toBe(-1);
  });

  it('recognises PlayStation, Xbox and Switch controllers in every browser format', () => {
    expect(padFamily('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)')).toBe('playstation');
    expect(padFamily('54c-9cc-Wireless Controller')).toBe('playstation');
    expect(padFamily('DUALSHOCK 4 Wireless Controller')).toBe('playstation');
    expect(padFamily('Xbox 360 Controller (XInput STANDARD GAMEPAD)')).toBe('xbox');
    expect(padFamily('45e-b13-Xbox Wireless Controller')).toBe('xbox');
    expect(padFamily('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)')).toBe('nintendo');
    expect(padFamily('Joy-Con (L/R)')).toBe('nintendo');
    expect(padFamily('8BitDo SN30 Pro (Vendor: 2dc8 Product: 6101)')).toBe('generic');
  });

  it('names buttons the way the controller in hand does', () => {
    expect(PAD_LABELS.playstation.south).toBe('✕');
    expect(PAD_LABELS.xbox.west).toBe('X');
    expect(PAD_LABELS.nintendo.east).toBe('A');
    expect(padText('Hold {west} · let go', 'playstation')).toBe('Hold □ · let go');
    expect(padText('Jump · {south}', 'nintendo')).toBe('Jump · B');
    expect(padText('Jump · {south}', null)).toBe('Jump · A');
  });

  it('reads an unmapped Sony pad: square first, d-pad on a hat axis', () => {
    const r = new GamepadReader();
    const id = '54c-9cc-Wireless Controller';
    const rest = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1.2857];
    connect(pad([], { mapping: '', id, axes: rest, count: 14 }));
    expect(r.read()?.family).toBe('playstation');
    // Raw button 1 is the cross (bottom), raw 0 the square (left).
    connect(pad([1], { mapping: '', id, axes: rest, count: 14 }));
    expect(r.read()?.pressed.has(PAD.SOUTH)).toBe(true);
    connect(pad([0], { mapping: '', id, axes: rest, count: 14 }));
    expect(r.read()?.pressed.has(PAD.WEST)).toBe(true);
    // Hat: -1 + 2/7 per eighth clockwise from up, so -1 up, 1/7 down, 5/7 left.
    const hat = (v: number): number[] => [0, 0, 0, 0, 0, 0, 0, 0, 0, v];
    connect(pad([], { mapping: '', id, axes: hat(-1), count: 14 }));
    expect(r.read()!.y).toBe(-1);
    connect(pad([], { mapping: '', id, axes: hat(1 / 7), count: 14 }));
    expect([r.read()!.x, r.read()!.y]).toEqual([0, 1]);
    connect(pad([], { mapping: '', id, axes: hat(5 / 7), count: 14 }));
    expect([r.read()!.x, r.read()!.y]).toEqual([-1, 0]);
    connect(pad([], { mapping: '', id, axes: rest, count: 14 }));
    const f = r.read()!;
    expect([f.x, f.y]).toEqual([0, 0]);
  });

  it('hands control to whichever controller was pressed last', () => {
    const r = new GamepadReader();
    const xbox = (b: number[]): FakePad => pad(b, { index: 0 });
    const ps = (b: number[]): FakePad => pad(b, { index: 1, id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)' });
    connect(xbox([]), ps([]));
    expect(r.read()?.family).toBe('xbox');
    connect(xbox([]), ps([PAD.SOUTH]));
    const f = r.read()!;
    expect(f.family).toBe('playstation');
    expect(f.pressed.has(PAD.SOUTH)).toBe(true);
    connect(xbox([]), ps([]));
    expect(r.read()?.family).toBe('playstation');
  });

  it('dash is on both the right face button and the left trigger', () => {
    const dash = PAD.PLAY.find(([name]) => name === 'dash')![1];
    expect(dash).toContain(PAD.EAST);
    expect(dash).toContain(PAD.LT);
  });

  it('rumbles the controller in use, and only when vibration is on', () => {
    const r = new GamepadReader();
    const p = pad([]);
    p.vibrationActuator = { playEffect: vi.fn(() => Promise.resolve('complete')) };
    connect(p);
    r.read();
    const h = new Haptics();
    h.rumble = (s, w, ms) => r.rumble(s, w, ms);
    h.play('bite');
    expect(p.vibrationActuator.playEffect).toHaveBeenCalledWith('dual-rumble', expect.objectContaining({ strongMagnitude: 0.9 }));
    h.enabled = false;
    h.play('bite');
    expect(p.vibrationActuator.playEffect).toHaveBeenCalledTimes(1);
  });
});

describe('phone vibration', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('waits for a real touch or click, which a controller press is not', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate, userActivation: { hasBeenActive: false } });
    const h = new Haptics();
    h.play('ui');
    expect(vibrate).not.toHaveBeenCalled();
    vi.stubGlobal('navigator', { vibrate, userActivation: { hasBeenActive: true } });
    h.play('ui');
    expect(vibrate).toHaveBeenCalledTimes(1);
  });
});
