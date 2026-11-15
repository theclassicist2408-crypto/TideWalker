import { describe, expect, it } from 'vitest';
import { Bot } from '../src/game/core/bot';
import { Camera } from '../src/game/core/camera';
import { ASSIST_AFTER_FAILS, FIXED_DT, MAX_STEPS_PER_FRAME } from '../src/game/core/constants';
import { FixedLoop } from '../src/game/core/loop';
import { World } from '../src/game/core/world';
import { getChapter } from '../src/game/levels';
import { SaveStore } from '../src/game/save/save';
import { flatLevel, intent, makeWorld, MemoryStorage, run, runEvents, settle } from './helpers';

describe('checkpoints and failure', () => {
  const level = flatLevel((b) => {
    b.tide([[0, 300], [60, 0]], 0, 7);
    b.checkpoint(0).flat(400).plant(100).fireflies(60, 12, 1, 0);
    b.basin(700, 240, 0.1);
  });

  it('lights lanterns in order, tops up Lumen and reports it', () => {
    const w = makeWorld(level);
    settle(w);
    w.player.lumen = 20;
    w.player.x = 580;
    const events = runEvents(w, 0.5, { mx: 1 });
    expect(events).toContain('checkpoint');
    expect(w.checkpointIndex).toBe(0);
    expect(w.checkpoints[0].lit).toBe(true);
    expect(w.player.lumen).toBeGreaterThan(60);
  });

  it('respawns at the last lantern with light, pickups and tide restored', () => {
    const w = makeWorld(level);
    settle(w);
    w.player.x = 590;
    run(w, 0.5, { mx: 1 });
    const tideAtLantern = w.checkpointTide;
    run(w, 25, { mx: 1 });
    w.fireflies[0].taken = true;
    w.plants[0].cd = 10;
    w.fail('swept');
    expect(w.status).toBe('failed');
    expect(w.totalFails).toBe(1);
    run(w, 1.2);
    w.respawn();
    expect(w.status).toBe('playing');
    expect(w.player.x).toBe(w.checkpoints[0].x);
    expect(w.player.lumen).toBe(w.diff.lumenMax);
    expect(w.fireflies[0].taken).toBe(false);
    expect(w.plants[0].cd).toBe(0);
    expect(w.tide.time).toBeLessThanOrEqual(tideAtLantern + 0.001);
    expect(w.time).toBeGreaterThan(20);
  });

  it('caps the tide clock a lantern keeps, so slow players are not drowned on respawn', () => {
    const w = makeWorld(level);
    settle(w);
    run(w, 50);
    w.player.x = 590;
    run(w, 0.5, { mx: 1 });
    expect(w.checkpointTide).toBeLessThanOrEqual(w.checkpoints[0].tideCap);
    expect(w.tide.time).toBeGreaterThan(w.checkpoints[0].tideCap);
  });

  it('quietly helps after three failures in one place, and stops helping at the next lantern', () => {
    const two = flatLevel((b) => b.checkpoint(0).flat(500).checkpoint(0));
    const w = makeWorld(two);
    settle(w);
    w.player.x = 590;
    run(w, 0.4, { mx: 1 });
    const normalTide = w.tideRate;
    let seen: string[] = [];
    for (let i = 0; i < ASSIST_AFTER_FAILS; i++) {
      expect(w.assist).toBe(false);
      w.fail('caught');
      w.respawn();
      seen = [];
      for (let k = 0; k < w.eventCount; k++) seen.push(w.events[k].type);
      w.clearEvents();
    }
    expect(w.assist).toBe(true);
    expect(seen).toContain('assist');
    expect(w.tideRate).toBeLessThan(normalTide);
    expect(w.fishSpeedScale).toBeLessThan(1);
    run(w, 5, { mx: 1 });
    expect(w.checkpointIndex).toBe(1);
    expect(w.assist).toBe(false);
    expect(w.failsHere).toBe(0);
  });

  it('gives Gentle players extra lanterns', () => {
    const l = flatLevel((b) => b.checkpoint(0, true).flat(300).checkpoint(0));
    expect(makeWorld(l, 'gentle').checkpoints.length).toBe(2);
    expect(makeWorld(l, 'standard').checkpoints.length).toBe(1);
  });

  it('can resume a chapter from a saved lantern', () => {
    const chapter = getChapter(2);
    const w = new World(chapter, { difficulty: 'standard', mode: 'story', startCheckpoint: 1 });
    expect(w.checkpointIndex).toBe(1);
    expect(w.player.x).toBe(w.checkpoints[1].x);
    expect(w.checkpoints[0].lit).toBe(true);
    expect(w.tide.time).toBeGreaterThan(0);
    const bad = new World(chapter, { difficulty: 'standard', mode: 'story', startCheckpoint: 99 });
    expect(bad.player.x).toBe(chapter.spawn.x);
  });
});

describe('progression', () => {
  it('reaching the goal completes the chapter exactly once', () => {
    const w = makeWorld(flatLevel());
    settle(w);
    w.player.x = w.level.goalX - 20;
    const events = runEvents(w, 1, { mx: 1 });
    expect(events.filter((e) => e === 'goal').length).toBe(1);
    expect(w.status).toBe('complete');
  });

  it('plays a chapter end to end and records it: shells, time, next chapter unlocked', () => {
    const store = new SaveStore(new MemoryStorage());
    const level = getChapter(1);
    const w = new World(level, { difficulty: store.data.settings.difficulty, mode: 'story', ownedShells: new Set(store.data.shells) });
    const bot = new Bot(w, true);
    let guard = 0;
    while (w.status !== 'complete' && guard++ < 60 * 400) {
      w.step(bot.update(FIXED_DT), FIXED_DT);
      for (let i = 0; i < w.eventCount; i++) {
        const e = w.events[i];
        if (e.type === 'shell') store.addShell(w.shells[e.v].id);
        if (e.type === 'checkpoint') store.setCheckpoint(1, e.v);
      }
      w.clearEvents();
      if (w.status === 'failed') w.respawn();
    }
    expect(w.status).toBe('complete');
    expect(store.data.checkpoint).not.toBeNull();
    store.completeChapter(1, w.time, [...w.secretsFound]);
    expect(store.data.shells.sort()).toEqual(['ch01-1', 'ch01-2']);
    expect(store.isUnlocked(2)).toBe(true);
    expect(store.data.checkpoint).toBeNull();
    expect(store.chapter(1).bestTime).toBeCloseTo(w.time, 5);

    // A second visit knows which shells are already owned.
    const again = new World(level, { difficulty: 'standard', mode: 'story', ownedShells: new Set(store.data.shells) });
    expect(again.shells.every((s) => s.owned)).toBe(true);
  });

  it('hidden shells must be lit before they can be gathered', () => {
    const w = makeWorld(flatLevel((b) => b.shell(0, 9, true)));
    settle(w);
    w.player.x = 560;
    expect(runEvents(w, 1, { mx: 1 })).not.toContain('shell');
    w.player.x = 560;
    expect(runEvents(w, 1, { mx: 1, glow: true })).toContain('shell');
  });

  it('kin wake to the glow and are counted', () => {
    const w = makeWorld(flatLevel((b) => b.kin(0, 30).kin(-200, 30, true)));
    settle(w);
    w.player.x = 560;
    expect(runEvents(w, 0.5, { glow: true })).toContain('kin');
    expect(w.kinAwake).toBe(1);
    w.player.x = 760;
    run(w, 0.5, { glow: true });
    expect(w.kinAwake).toBe(2);
    run(w, 8);
    expect(w.kin[1].gone).toBe(true);
    expect(w.kin[0].gone).toBe(false);
    expect(Math.abs(w.kin[0].cx - w.player.x)).toBeLessThan(120);
  });

  it('secret routes are discovered once', () => {
    const w = makeWorld(flatLevel((b) => b.secret('nook', 40, 60, 80, 80)));
    settle(w);
    w.player.x = 540;
    const events = runEvents(w, 1.5, { mx: 1 });
    expect(events.filter((e) => e === 'secret').length).toBe(1);
    expect([...w.secretsFound]).toEqual(['test-nook']);
  });

  it('Drift and title worlds cannot fail or finish', () => {
    for (const mode of ['drift', 'title'] as const) {
      const w = makeWorld(flatLevel(), 'standard', mode);
      w.fail('caught');
      expect(w.status).toBe('playing');
      w.player.x = w.level.goalX + 50;
      run(w, 0.2);
      expect(w.status).toBe('playing');
    }
  });

  it('settings chosen by the player persist and shape the next world', () => {
    const mem = new MemoryStorage();
    new SaveStore(mem).updateSettings({ difficulty: 'intense', screenShake: false });
    const store = new SaveStore(mem);
    const w = new World(flatLevel(), { difficulty: store.data.settings.difficulty, mode: 'story' });
    expect(w.diff.lumenMax).toBe(80);
    expect(store.data.settings.screenShake).toBe(false);
  });
});

describe('loop and camera', () => {
  it('runs a fixed number of steps for the time elapsed, at any frame rate', () => {
    const count = (fps: number): number => {
      const loop = new FixedLoop();
      let steps = 0;
      for (let i = 0; i < fps; i++) steps += loop.advance(1 / fps);
      return steps;
    };
    expect(count(60)).toBeGreaterThanOrEqual(59);
    expect(count(60)).toBeLessThanOrEqual(60);
    expect(count(30)).toBeGreaterThanOrEqual(59);
    expect(count(120)).toBeGreaterThanOrEqual(59);
    expect(count(144)).toBeLessThanOrEqual(60);
  });

  it('never spirals after a long stall, and exposes an interpolation factor', () => {
    const loop = new FixedLoop();
    expect(loop.advance(5)).toBe(MAX_STEPS_PER_FRAME);
    expect(loop.advance(0)).toBe(0);
    loop.advance(FIXED_DT * 1.5);
    expect(loop.alpha).toBeGreaterThan(0.4);
    expect(loop.alpha).toBeLessThan(0.6);
    loop.reset();
    expect(loop.alpha).toBe(0);
  });

  it('camera follows smoothly with look-ahead and stays inside the level', () => {
    const cam = new Camera();
    cam.setView(400, 800);
    cam.snap(1000, 0, 0, 5000);
    expect(cam.x).toBe(1000);
    let maxStep = 0;
    let prev = cam.x;
    for (let i = 0; i < 120; i++) {
      cam.update(1000 + i * 2.5, 0, 150, 1, FIXED_DT, 0, 5000);
      maxStep = Math.max(maxStep, Math.abs(cam.x - prev));
      prev = cam.x;
    }
    expect(maxStep).toBeLessThan(5);
    expect(cam.x).toBeGreaterThan(1000 + 119 * 2.5);
    cam.snap(10, 0, 0, 5000);
    expect(cam.left).toBe(0);
    cam.snap(4990, 0, 0, 5000);
    expect(cam.left + cam.viewW).toBe(5000);
  });

  it('ignores small hops vertically and shakes only when allowed', () => {
    const cam = new Camera();
    cam.setView(400, 800);
    cam.snap(500, 0, 0, 5000);
    const y0 = cam.y;
    for (let i = 0; i < 20; i++) cam.update(500, -20, 0, 1, FIXED_DT, 0, 5000);
    expect(Math.abs(cam.y - y0)).toBeLessThan(8);
    cam.shake(1);
    cam.update(500, 0, 0, 1, FIXED_DT, 0, 5000);
    expect(Math.abs(cam.shakeX) + Math.abs(cam.shakeY)).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) cam.update(500, 0, 0, 1, FIXED_DT, 0, 5000);
    expect(Math.abs(cam.shakeX)).toBe(0);
    cam.shakeScale = 0;
    cam.shake(1);
    cam.update(500, 0, 0, 1, FIXED_DT, 0, 5000);
    expect(Math.abs(cam.shakeX)).toBe(0);
    expect(Math.abs(cam.shakeY)).toBe(0);
  });

  it('the event queue never overflows or allocates', () => {
    const w = makeWorld(flatLevel());
    const first = w.events[0];
    for (let i = 0; i < 500; i++) w.emit('jump', i, 0, 0);
    expect(w.eventCount).toBe(w.events.length);
    w.clearEvents();
    w.step(intent(), FIXED_DT);
    expect(w.events[0]).toBe(first);
  });
});
