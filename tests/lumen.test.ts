import { describe, expect, it } from 'vitest';
import { DIFF, P } from '../src/game/core/constants';
import { flatLevel, makeWorld, run, runEvents, settle } from './helpers';

describe('lumen', () => {
  it('drains while glowing and stops when released', () => {
    const w = makeWorld(flatLevel());
    settle(w);
    const start = w.player.lumen;
    run(w, 2, { glow: true });
    expect(start - w.player.lumen).toBeCloseTo(DIFF.standard.glowDrain * 2, 0);
    expect(w.player.glowOn).toBe(true);
    const after = w.player.lumen;
    run(w, 1);
    expect(w.player.glowOn).toBe(false);
    expect(w.player.lumen).toBeCloseTo(after, 3);
  });

  it('glow widens the light radius', () => {
    const w = makeWorld(flatLevel());
    settle(w);
    const dark = w.lightRadius;
    run(w, 0.6, { glow: true });
    expect(w.lightRadius).toBeGreaterThan(dark * 2);
  });

  it('never fails the run on land, and trickles back so the player is not stranded', () => {
    const w = makeWorld(flatLevel());
    settle(w);
    run(w, 30, { glow: true });
    expect(w.status).toBe('playing');
    expect(w.player.glowOn).toBe(false);
    run(w, 12);
    expect(w.status).toBe('playing');
    expect(w.player.lumen).toBeGreaterThan(DIFF.standard.lumenMax * DIFF.standard.trickleTo - 2);
    expect(runEvents(w, 0.3, { glow: true })).toContain('glowOn');
  });

  it('is sapped by open water and only sweeps the creature away after a visible fade', () => {
    const w = makeWorld(flatLevel((b) => b.basin(500, 200), 60));
    w.player.x = 850;
    w.player.y = 120;
    w.player.lumen = 4;
    const events = runEvents(w, 2.4, { my: 1 });
    expect(events).toContain('fading');
    expect(w.status).toBe('playing');
    const more = runEvents(w, DIFF.standard.fadeTime + 0.5, { my: 1 });
    expect(more).toContain('swept');
    expect(w.status).toBe('failed');
  });

  it('is restored by moon pools, glow plants and fireflies', () => {
    const w = makeWorld(flatLevel((b) => b.flat(300).pool(150, 50).flat(300).plant(150).flat(300).fireflies(150, 9, 1, 0)));
    settle(w);
    w.player.lumen = 10;
    w.player.x = 750;
    run(w, 1);
    expect(w.player.inPool).toBe(true);
    expect(w.player.lumen).toBeGreaterThan(38);
    w.player.lumen = 10;
    w.player.x = 1050;
    expect(runEvents(w, 0.2)).toContain('plant');
    expect(w.player.lumen).toBeGreaterThan(40);
    const before = w.player.lumen;
    w.player.x = w.fireflies[0].x;
    w.player.y = w.fireflies[0].y;
    expect(runEvents(w, 0.05)).toContain('pickup');
    expect(w.player.lumen).toBeGreaterThan(before);
  });

  it('pulse costs Lumen, has a cooldown, and is refused when nearly empty', () => {
    const w = makeWorld(flatLevel());
    settle(w);
    const start = w.player.lumen;
    expect(runEvents(w, 0.05, { pulse: true })).toContain('pulse');
    expect(start - w.player.lumen).toBeCloseTo(P.pulseCost, 0);
    expect(runEvents(w, 0.05, { pulse: true })).toContain('pulseFail');
    run(w, P.pulseCooldown + 0.1);
    w.player.lumen = 3;
    expect(runEvents(w, 0.05, { pulse: true })).toContain('pulseFail');
  });

  it('gives Gentle more light and Intense less', () => {
    expect(DIFF.gentle.lumenMax).toBeGreaterThan(DIFF.standard.lumenMax);
    expect(DIFF.intense.lumenMax).toBeLessThan(DIFF.standard.lumenMax);
    expect(DIFF.gentle.tideRate).toBeLessThan(1);
    expect(DIFF.intense.tideRate).toBeGreaterThan(1);
    expect(makeWorld(flatLevel(), 'gentle').player.lumen).toBe(DIFF.gentle.lumenMax);
  });

  it('never drains in Drift Mode', () => {
    const w = makeWorld(flatLevel(), 'standard', 'drift');
    settle(w);
    run(w, 20, { glow: true });
    expect(w.player.lumen).toBe(DIFF.standard.lumenMax);
    expect(w.player.glowOn).toBe(true);
  });
});
