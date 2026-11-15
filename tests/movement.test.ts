import { describe, expect, it } from 'vitest';
import { FIXED_DT, P } from '../src/game/core/constants';
import { flatLevel, intent, makeWorld, run, runEvents, settle } from './helpers';

describe('movement', () => {
  it('settles on the ground and stays put with no input', () => {
    const w = makeWorld(flatLevel());
    settle(w);
    expect(w.player.onGround).toBe(true);
    expect(w.player.y).toBeCloseTo(-P.halfH, 1);
    const x = w.player.x;
    run(w, 1);
    expect(w.player.x).toBeCloseTo(x, 3);
  });

  it('accelerates smoothly to run speed and brakes with friction', () => {
    const w = makeWorld(flatLevel());
    settle(w);
    run(w, 0.05, { mx: 1 });
    expect(w.player.vx).toBeGreaterThan(20);
    expect(w.player.vx).toBeLessThan(P.runSpeed);
    run(w, 0.5, { mx: 1 });
    expect(w.player.vx).toBeCloseTo(P.runSpeed, 1);
    run(w, 0.05);
    expect(w.player.vx).toBeGreaterThan(0);
    run(w, 0.3);
    expect(w.player.vx).toBe(0);
  });

  it('jumps to about 90 px when held and much lower when released early', () => {
    const peak = (held: boolean): number => {
      const w = makeWorld(flatLevel());
      settle(w);
      const ground = w.player.y;
      let top = ground;
      w.step(intent({ jump: true, jumpHeld: true }), FIXED_DT);
      for (let i = 0; i < 80; i++) {
        w.step(intent({ jumpHeld: held || i < 3 }), FIXED_DT);
        top = Math.min(top, w.player.y);
      }
      return ground - top;
    };
    const full = peak(true);
    const hop = peak(false);
    expect(full).toBeGreaterThan(84);
    expect(full).toBeLessThan(96);
    expect(hop).toBeLessThan(full * 0.6);
    expect(hop).toBeGreaterThan(8);
  });

  it('allows a jump shortly after running off a ledge (coyote time)', () => {
    const w = makeWorld(flatLevel((b) => b.step(120)));
    settle(w);
    w.player.x = 592;
    run(w, 0.02);
    let left = 0;
    while (w.player.onGround && left++ < 200) w.step(intent({ mx: 1 }), FIXED_DT);
    expect(w.player.onGround).toBe(false);
    run(w, 0.05, { mx: 1 });
    const events = runEvents(w, 0.05, { mx: 1, jump: true, jumpHeld: true });
    expect(events).toContain('jump');
    expect(w.player.vy).toBeLessThan(0);
  });

  it('refuses a jump long after leaving the ground', () => {
    const w = makeWorld(flatLevel((b) => b.step(300)));
    settle(w);
    w.player.x = 596;
    run(w, 0.4, { mx: 1 });
    expect(w.player.onGround).toBe(false);
    expect(runEvents(w, 0.05, { jump: true, jumpHeld: true })).not.toContain('jump');
  });

  it('buffers a jump pressed just before landing', () => {
    const w = makeWorld(flatLevel());
    settle(w);
    run(w, 0.02, { jump: true, jumpHeld: true });
    let pressed = false;
    let jumps = 0;
    for (let i = 0; i < 120; i++) {
      // Press again a few frames before touching down.
      const nearGround = w.player.vy > 0 && -P.halfH - w.player.y < 14;
      const press = nearGround && !pressed;
      if (press) pressed = true;
      w.step(intent({ jump: press, jumpHeld: true }), FIXED_DT);
      for (let k = 0; k < w.eventCount; k++) if (w.events[k].type === 'jump') jumps++;
      w.clearEvents();
    }
    expect(pressed).toBe(true);
    expect(jumps).toBe(1);
  });

  it('is stopped by a wall but steps up it with a jump', () => {
    const w = makeWorld(flatLevel((b) => b.step(-40)));
    settle(w);
    w.player.x = 540;
    run(w, 1, { mx: 1 });
    expect(w.player.x).toBeLessThan(600);
    expect(w.player.vx).toBe(0);
    run(w, 0.02, { mx: 1, jump: true, jumpHeld: true });
    run(w, 0.8, { mx: 1, jumpHeld: true });
    expect(w.player.x).toBeGreaterThan(600);
    expect(w.player.y).toBeCloseTo(-40 - P.halfH, 0);
  });

  it('dashes faster than a run and then cools down', () => {
    const w = makeWorld(flatLevel());
    settle(w);
    run(w, 0.4, { mx: 1 });
    const events = runEvents(w, 0.05, { mx: 1, dash: true });
    expect(events).toContain('dash');
    expect(w.player.vx).toBeGreaterThan(P.runSpeed * 1.4);
    expect(runEvents(w, 0.05, { mx: 1, dash: true })).not.toContain('dash');
    run(w, 1, { mx: 1 });
    expect(w.player.vx).toBeCloseTo(P.runSpeed, 0);
  });

  it('slows down when Lumen is nearly spent', () => {
    const w = makeWorld(flatLevel());
    settle(w);
    w.player.lumen = 0;
    run(w, 0.6, { mx: 1 });
    expect(w.player.vx).toBeLessThan(P.runSpeed * 0.86);
    expect(w.player.vx).toBeGreaterThan(P.runSpeed * 0.6);
  });

  it('swims, floats to the surface, and breaches on a swipe up', () => {
    const w = makeWorld(flatLevel((b) => b.basin(500, 200), 60));
    w.player.x = 850;
    w.player.y = 150;
    run(w, 0.2);
    expect(w.player.swim).toBe(true);
    run(w, 6);
    expect(w.player.y).toBeLessThan(w.waterY + 6);
    expect(w.player.swim).toBe(true);
    run(w, 0.5, { my: 1 });
    const deep = w.player.y;
    expect(deep).toBeGreaterThan(w.waterY + 20);
    const events = runEvents(w, 1.2, { my: -1, jump: true });
    expect(events).toContain('splashOut');
    let top = Infinity;
    for (let i = 0; i < 40; i++) {
      w.step(intent(), FIXED_DT);
      top = Math.min(top, w.player.y);
    }
    expect(top).toBeLessThan(w.waterY - 20);
  });

  it('stays finite and in bounds through a long scripted run', () => {
    const w = makeWorld(flatLevel((b) => b.pit(60, 120).step(-30).basin(300, 90), 40));
    for (let i = 0; i < 2000; i++) {
      w.step(intent({ mx: 1, jump: i % 37 === 0, jumpHeld: true, glow: i % 90 < 30, dash: i % 150 === 0 }), FIXED_DT);
      w.clearEvents();
      if (w.status === 'failed') w.respawn();
    }
    expect(Number.isFinite(w.player.x)).toBe(true);
    expect(Number.isFinite(w.player.y)).toBe(true);
    expect(w.player.y).toBeLessThan(600);
  });
});
