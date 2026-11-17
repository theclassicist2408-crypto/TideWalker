import { describe, expect, it } from 'vitest';
import { newIntent } from '../src/game/core/types';
import { Controls, LIGHT_HOLD_MS } from '../src/game/input/controls';

describe('controls', () => {
  it('a press is one edge: the action fires once, the hold stays', () => {
    const c = new Controls();
    const i = newIntent();
    c.press('jump', 0);
    c.read(0, i);
    expect(i.jump).toBe(true);
    expect(i.jumpHeld).toBe(true);
    c.read(16, i);
    expect(i.jump).toBe(false);
    expect(i.jumpHeld).toBe(true);
    c.release('jump', 50);
    c.read(66, i);
    expect(i.jumpHeld).toBe(false);
  });

  it('a quick press and release between frames still registers', () => {
    const c = new Controls();
    const i = newIntent();
    c.press('attack', 0);
    c.release('attack', 5);
    c.read(16, i);
    expect(i.attack).toBe(true);
    expect(i.attackHeld).toBe(false);
  });

  it('light: a tap pulses, a hold glows and does not pulse', () => {
    const c = new Controls();
    const i = newIntent();
    c.press('light', 0);
    c.release('light', LIGHT_HOLD_MS - 50);
    c.read(200, i);
    expect(i.pulse).toBe(true);
    expect(i.glow).toBe(false);
    c.press('light', 1000);
    c.read(1000 + LIGHT_HOLD_MS + 10, i);
    expect(i.glow).toBe(true);
    c.release('light', 1600);
    c.read(1616, i);
    expect(i.pulse).toBe(false);
    expect(i.glow).toBe(false);
  });

  it('the stick has a dead zone and snaps firm pushes to full', () => {
    const c = new Controls();
    c.stick(0.2, 0.3);
    expect([c.mx, c.my]).toEqual([0, 0]);
    c.stick(-0.5, 0.8);
    expect([c.mx, c.my]).toEqual([-1, 1]);
  });

  it('reset drops everything held', () => {
    const c = new Controls();
    const i = newIntent();
    c.press('heal', 0);
    c.press('dash', 0);
    c.stick(1, 0);
    c.reset();
    c.read(16, i);
    expect(i.heal || i.dash || i.mx !== 0).toBe(false);
  });
});
