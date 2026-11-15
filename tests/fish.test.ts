import { describe, expect, it } from 'vitest';
import { DIFF } from '../src/game/core/constants';
import type { LevelData } from '../src/game/core/types';
import { flatLevel, makeWorld, run, runEvents } from './helpers';

/** A wide flooded basin with one fish patrolling it. Water surface at y=20, floor at y=260. */
function sea(kind: 'drifter' | 'angler' | 'hush', kelp = false): LevelData {
  return flatLevel((b) => {
    b.basin(1200, 260, 0.1);
    b.fish(kind, 760, -150, 440, -150);
    if (kelp) b.kelp(650, 100, 200);
  }, 20);
}

describe('shadow-fish', () => {
  it('a drifter patrols and ignores a dark, distant creature', () => {
    const w = makeWorld(sea('drifter'));
    w.player.x = 1500;
    w.player.y = 60;
    const events = runEvents(w, 6, { mx: 0 });
    expect(events).not.toContain('fishAlert');
    expect(w.fish[0].mode).toBe('patrol');
  });

  it('light draws a drifter in; going dark makes it lose interest', () => {
    const w = makeWorld(sea('drifter'));
    w.player.x = 1180;
    w.player.y = 140;
    const events = runEvents(w, 1.2, { glow: true, my: 0.2 });
    expect(events).toContain('fishAlert');
    expect(w.fish[0].mode).toBe('investigate');
    // Slip away in the dark.
    w.player.x = 1600;
    run(w, 6, {});
    expect(['linger', 'return', 'patrol']).toContain(w.fish[0].mode);
  });

  it('a strike is telegraphed before it lands', () => {
    const w = makeWorld(sea('drifter'));
    const f = w.fish[0];
    w.player.x = f.x + 50;
    w.player.y = f.y;
    const events = runEvents(w, 2, { glow: true, my: 0.3 });
    const windup = events.indexOf('fishWindup');
    const lunge = events.indexOf('fishLunge');
    expect(windup).toBeGreaterThanOrEqual(0);
    expect(lunge).toBeGreaterThan(windup);
  });

  it('a bite steals Lumen rather than ending the run; only an empty creature is caught', () => {
    const w = makeWorld(sea('drifter'));
    const f = w.fish[0];
    w.player.x = f.x + 6;
    w.player.y = f.y;
    const events = runEvents(w, 0.2, { my: 0.5 });
    expect(events).toContain('bite');
    expect(w.status).toBe('playing');
    expect(w.player.lumen).toBeCloseTo(DIFF.standard.lumenMax - DIFF.standard.bite, -1);
    expect(w.player.invuln).toBeGreaterThan(0);

    const w2 = makeWorld(sea('drifter'));
    w2.player.lumen = 2;
    w2.player.x = w2.fish[0].x + 6;
    w2.player.y = w2.fish[0].y;
    expect(runEvents(w2, 0.2, { my: 0.5 })).toContain('caught');
    expect(w2.status).toBe('failed');
  });

  it('kelp hides a still, dark creature even from a fish that swims past', () => {
    const w = makeWorld(sea('drifter', true));
    const k = w.level.kelp[0];
    w.player.x = k.x + k.w / 2;
    w.player.y = k.y - 60;
    run(w, 0.3, { my: 0.6 });
    expect(w.player.inKelp).toBe(true);
    const f = w.fish[0];
    f.x = w.player.x - 40;
    f.y = w.player.y;
    const events = runEvents(w, 1.5, { my: 0.2 });
    expect(w.player.hidden).toBe(true);
    expect(events).not.toContain('bite');
    expect(events).not.toContain('fishAlert');
  });

  it('a Lumen Pulse shoves a fish away and dazes it', () => {
    const w = makeWorld(sea('drifter'));
    const f = w.fish[0];
    w.player.x = f.x + 60;
    w.player.y = f.y;
    run(w, 0.05, { pulse: true, my: 0.4 });
    expect(f.mode).toBe('stunned');
    run(w, 0.4, { my: 0.4 });
    expect(Math.abs(f.x - w.player.x)).toBeGreaterThan(90);
  });

  it('an angler waits behind its lure and strikes only if touched or stared at', () => {
    const w = makeWorld(sea('angler'));
    const f = w.fish[0];
    w.player.x = f.x + 100;
    w.player.y = f.y;
    run(w, 3, { my: 0.3 });
    expect(f.mode).toBe('patrol');
    w.player.x = f.x + 100;
    w.player.y = f.y;
    const events = runEvents(w, DIFF.standard.anglerPatience + 0.4, { glow: true, my: 0.3 });
    expect(events).toContain('fishWindup');
  });

  it('the Hush sweeps regardless of light and hurries toward it', () => {
    const w = makeWorld(sea('hush'));
    const f = w.fish[0];
    w.player.x = 1700;
    w.player.y = 40;
    const x0 = f.x;
    run(w, 3);
    expect(Math.abs(f.x - x0)).toBeGreaterThan(60);
    w.player.x = f.x + 200;
    w.player.y = f.y;
    expect(runEvents(w, 0.5, { glow: true, my: 0.3 })).toContain('fishAlert');
  });

  it('fish stay dormant until the tide floods their water', () => {
    const level = flatLevel((b) => {
      b.basin(800, 200, 0.1);
      b.fish('drifter', 500, -150, 300, -150);
    }, 400);
    const w = makeWorld(level);
    run(w, 2);
    expect(w.fish[0].mode).toBe('dormant');
  });

  it('warns with ripples before a fish is near', () => {
    const w = makeWorld(sea('drifter'));
    w.player.x = w.fish[0].x + 300;
    w.player.y = 60;
    expect(runEvents(w, 3, {})).toContain('fishRipple');
  });
});
