import { describe, expect, it } from 'vitest';
import { P } from '../src/game/core/constants';
import { validateLevel } from '../src/game/levels/builder';
import { Heightfield, OPEN_SKY } from '../src/game/systems/terrain';
import { flatLevel, makeWorld, run, runEvents, settle } from './helpers';

describe('heightfield', () => {
  it('interpolates, clamps and treats duplicate x as a wall', () => {
    const h = new Heightfield([0, 100, 100, 200], [0, 0, -50, -50]);
    expect(h.at(-10)).toBe(0);
    expect(h.at(50)).toBe(0);
    expect(h.at(99.9)).toBeCloseTo(0, 5);
    expect(h.at(100)).toBe(-50);
    expect(h.at(150)).toBe(-50);
    expect(h.at(999)).toBe(-50);
  });

  it('interpolates slopes and answers out-of-order queries', () => {
    const h = new Heightfield([0, 100, 300], [0, 100, 0]);
    expect(h.at(250)).toBeCloseTo(25, 5);
    expect(h.at(50)).toBeCloseTo(50, 5);
    expect(h.at(200)).toBeCloseTo(50, 5);
    expect(h.minIn(40, 260)).toBeCloseTo(20, 5);
  });

  it('returns its empty value when it has no points', () => {
    expect(new Heightfield([], [], OPEN_SKY).at(5)).toBe(OPEN_SKY);
    expect(() => new Heightfield([0], [])).toThrow();
  });
});

describe('collision', () => {
  it('lands on a one-way platform from above and passes through from below', () => {
    const w = makeWorld(flatLevel((b) => b.plat(100, 50, 80)));
    settle(w);
    const pl = w.platforms[0];
    w.player.x = pl.x + 40;
    run(w, 0.02, { jump: true, jumpHeld: true });
    run(w, 1, { jumpHeld: true });
    expect(w.player.onPlatform).toBe(pl);
    expect(w.player.y).toBeCloseTo(pl.y - P.halfH, 0);
    run(w, 0.5, { down: true });
    expect(w.player.onPlatform).toBeNull();
    expect(w.player.y).toBeCloseTo(-P.halfH, 0);
  });

  it('moonglass holds weight only in light', () => {
    const level = flatLevel((b) => b.pit(200, 150, {}, (bb) => bb.plat(200, 0, 200, 'moonglass')));
    const dark = makeWorld(level);
    settle(dark);
    dark.player.x = 580;
    run(dark, 1.6, { mx: 1 });
    expect(dark.player.y).toBeGreaterThan(60);

    const lit = makeWorld(level);
    settle(lit);
    lit.player.x = 580;
    run(lit, 1.6, { mx: 1, glow: true });
    expect(lit.player.x).toBeGreaterThan(800);
    expect(lit.player.y).toBeCloseTo(-P.halfH, 0);
  });

  it('a Lumen Pulse makes moonglass solid for a while', () => {
    const w = makeWorld(flatLevel((b) => b.plat(100, 40, 80, 'moonglass')));
    settle(w);
    w.player.x = 520;
    expect(w.platforms[0].solid).toBe(false);
    run(w, 0.2, { pulse: true });
    expect(w.platforms[0].solid).toBe(true);
    run(w, 5);
    expect(w.platforms[0].solid).toBe(false);
  });

  it('crumbling ledges fall after being stood on and later reform', () => {
    const w = makeWorld(flatLevel((b) => b.plat(100, 40, 80, 'crumble')));
    settle(w);
    const pl = w.platforms[0];
    w.player.x = pl.x + 40;
    w.player.y = pl.y - 30;
    const events = runEvents(w, 1.4);
    expect(events).toContain('crumble');
    expect(pl.solid).toBe(false);
    run(w, 4);
    expect(pl.solid).toBe(true);
  });

  it('a bloom gate blocks until lit, then stays open', () => {
    const w = makeWorld(flatLevel((b) => b.bloomGate(0, 104)));
    settle(w);
    w.player.x = 540;
    run(w, 1.2, { mx: 1 });
    expect(w.player.x).toBeLessThan(600);
    expect(w.gates[0].open).toBe(false);
    const events = runEvents(w, 1.5, { glow: true });
    expect(events).toContain('gateOpen');
    run(w, 1, { mx: 1 });
    expect(w.player.x).toBeGreaterThan(620);
  });

  it('a tide gate opens when the water reaches it', () => {
    const w = makeWorld(flatLevel((b) => b.tide([[0, 200], [10, -40]], 0, 7).tideGate(0, 110, { openAbove: -12 })));
    run(w, 1);
    expect(w.gates[0].open).toBe(false);
    run(w, 12);
    expect(w.gates[0].open).toBe(true);
  });

  it('a cave roof stops a jump', () => {
    const w = makeWorld(flatLevel((b) => b.caveStart(40).flat(300).caveEnd(40)));
    settle(w);
    w.player.x = 750;
    run(w, 0.02, { jump: true, jumpHeld: true });
    let top = 0;
    for (let i = 0; i < 30; i++) {
      run(w, 1 / 60, { jumpHeld: true });
      top = Math.min(top, w.player.y);
    }
    expect(top).toBeGreaterThanOrEqual(-40 + P.halfH - 0.01);
  });

  it('urchins sting without ending the run', () => {
    const w = makeWorld(flatLevel((b) => b.urchin(0)));
    settle(w);
    w.player.x = 560;
    const events = runEvents(w, 1, { mx: 1 });
    expect(events).toContain('sting');
    expect(w.status).toBe('playing');
    expect(w.player.lumen).toBeLessThan(100);
    w.player.lumen = 1;
    w.player.invuln = 0;
    w.player.x = 592;
    run(w, 1, { mx: 1 });
    expect(w.status).toBe('playing');
  });

  it('a geyser throws the creature high', () => {
    const w = makeWorld(flatLevel((b) => b.geyser(0, 700, 2, 0, false)));
    settle(w);
    w.player.x = 600;
    let top = 0;
    for (let i = 0; i < 200; i++) {
      run(w, 1 / 60);
      top = Math.min(top, w.player.y);
    }
    expect(top).toBeLessThan(-120);
  });

  it('level validation rejects broken data', () => {
    const good = flatLevel();
    expect(() => validateLevel(good)).not.toThrow();
    expect(() => validateLevel({ ...good, goalX: 0 })).toThrow(/goal/);
    expect(() => validateLevel({ ...good, groundX: [0, 50, 10], groundY: [0, 0, 0] })).toThrow(/monotonic/);
    expect(() => validateLevel({ ...good, shells: [{ id: 'a', x: 10, y: 0, hidden: false }, { id: 'a', x: 20, y: 0, hidden: false }] })).toThrow(/duplicate/);
    expect(() => validateLevel({ ...good, tide: { keys: [], amp: 0, period: 1 } })).toThrow(/tide/);
  });
});
