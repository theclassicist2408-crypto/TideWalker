import { describe, expect, it } from 'vitest';
import { Tide } from '../src/game/systems/tide';
import { flatLevel, makeWorld, run } from './helpers';

describe('tide', () => {
  it('follows its keyframes and reports trend and progress', () => {
    const t = new Tide({ keys: [[0, 100], [10, 100], [30, 0]], amp: 0, period: 7 });
    expect(t.level).toBe(100);
    expect(t.trend).toBe(0);
    expect(t.progress).toBe(0);
    t.setTime(20);
    expect(t.level).toBeCloseTo(50, 0);
    expect(t.trend).toBe(1);
    expect(t.progress).toBeCloseTo(0.5, 1);
    t.setTime(60);
    expect(t.level).toBe(0);
    expect(t.progress).toBe(1);
    expect(t.trend).toBe(0);
  });

  it('adds a swell without changing the trend', () => {
    const t = new Tide({ keys: [[0, 50]], amp: 6, period: 8 });
    const seen: number[] = [];
    for (let i = 0; i < 80; i++) {
      t.update(0.1);
      seen.push(t.level);
      expect(t.trend).toBe(0);
    }
    expect(Math.max(...seen)).toBeGreaterThan(55);
    expect(Math.min(...seen)).toBeLessThan(45);
  });

  it('breathes in and out when given a breath, flipping the trend', () => {
    const t = new Tide({ keys: [[0, 0]], amp: 0, period: 7, breathAmp: 20, breathPeriod: 40 });
    const trends = new Set<number>();
    for (let i = 0; i < 400; i++) {
      t.update(0.1);
      trends.add(t.trend);
    }
    expect(trends.has(1)).toBe(true);
    expect(trends.has(-1)).toBe(true);
  });

  it('rejects an empty definition', () => {
    expect(() => new Tide({ keys: [], amp: 0, period: 1 })).toThrow();
  });

  it('runs slower on Gentle and faster on Intense', () => {
    const level = flatLevel((b) => b.tide([[0, 400], [100, 0]], 0, 7));
    const g = makeWorld(level, 'gentle');
    const s = makeWorld(level, 'standard');
    const i = makeWorld(level, 'intense');
    for (const w of [g, s, i]) run(w, 20);
    expect(g.waterY).toBeGreaterThan(s.waterY);
    expect(i.waterY).toBeLessThan(s.waterY);
  });

  it('drives currents: rising-only currents switch on with the tide', () => {
    const level = flatLevel((b) => b.tide([[0, 400], [5, 400], [40, 100]], 0, 7).current(300, 0, 100, 100, 100, 0, { mode: 'rising' }).current(300, 0, 100, 100, 100, 0, { mode: 'flip' }));
    const w = makeWorld(level);
    run(w, 2);
    expect(w.currents[0].power).toBe(0);
    run(w, 10);
    expect(w.currents[0].power).toBeCloseTo(1, 1);
    expect(w.currents[1].power).toBeCloseTo(1, 1);
  });
});
