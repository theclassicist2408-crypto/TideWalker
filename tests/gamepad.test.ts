import { afterEach, describe, expect, it, vi } from 'vitest';
import { GamepadReader, PAD } from '../src/game/input/gamepad';

function pad(buttons: number[], axes: number[] = [0, 0], mapping = 'standard', index = 0) {
  return { connected: true, mapping, index, axes, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: buttons.includes(i), value: buttons.includes(i) ? 1 : 0 })) };
}

describe('gamepad', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports presses only on the frame a button goes down', () => {
    const r = new GamepadReader();
    let state = pad([]);
    vi.stubGlobal('navigator', { getGamepads: () => [state] });
    r.read();
    state = pad([PAD.A]);
    expect(r.read()?.pressed.has(PAD.A)).toBe(true);
    expect(r.read()?.pressed.has(PAD.A)).toBe(false);
    expect(r.read()?.down.has(PAD.A)).toBe(true);
  });

  it('ignores buttons already held when a pad appears, and non-standard devices', () => {
    const r = new GamepadReader();
    vi.stubGlobal('navigator', { getGamepads: () => [pad([PAD.A])] });
    expect(r.read()?.pressed.size).toBe(0);
    const odd = new GamepadReader();
    vi.stubGlobal('navigator', { getGamepads: () => [pad([PAD.A], [0, 0], '')] });
    expect(odd.read()).toBeNull();
  });

  it('the stick has a dead zone and the d-pad wins', () => {
    const r = new GamepadReader();
    vi.stubGlobal('navigator', { getGamepads: () => [pad([], [0.2, 0.3])] });
    const f = r.read()!;
    expect([f.x, f.y]).toEqual([0, 0]);
    vi.stubGlobal('navigator', { getGamepads: () => [pad([PAD.LEFT], [0.9, 0])] });
    expect(r.read()!.x).toBe(-1);
  });
});
