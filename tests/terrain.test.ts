import { describe, expect, it } from 'vitest';
import { FIXED_DT, P } from '../src/game/core/constants';
import { spawnEnemy, ENEMY } from '../src/game/entities/enemies';
import { allLevels, getTutorial } from '../src/game/levels';
import type { LevelBuilder } from '../src/game/levels/builder';
import { Heightfield } from '../src/game/systems/terrain';
import { flatLevel, intent, makeWorld, run, settle } from './helpers';

describe('terrain', () => {
  it('tells a sheer face from a slope', () => {
    // Flat, a 40 px wall at x=100, then a 1:1 slope from 200 to 260.
    const h = new Heightfield([0, 100, 100, 200, 260, 400], [0, 0, -40, -40, -100, -100]);
    expect(h.sheerIn(90, 110)).toBe(true);
    expect(h.sheerIn(110, 190)).toBe(false);
    expect(h.sheerIn(210, 250)).toBe(false);
    expect(h.sheerIn(95, 99)).toBe(false);
  });

  it('every slope in every level can be walked: no pool bank is a wall in disguise', () => {
    for (const l of [getTutorial(), ...allLevels()]) {
      for (let i = 0; i + 1 < l.groundX.length; i++) {
        const dx = l.groundX[i + 1] - l.groundX[i];
        if (dx <= 0) continue;
        const s = Math.abs(l.groundY[i + 1] - l.groundY[i]) / dx;
        expect(s, `${l.id} at x=${Math.round(l.groundX[i])}`).toBeLessThanOrEqual(P.maxBank * 1.05);
      }
    }
  });

  it('the creature walks up and down the steepest bank without stopping', () => {
    const w = makeWorld(flatLevel((b) => b.slope(190, -200).flat(200).slope(190, 200)));
    settle(w);
    w.player.x = 560;
    // 640 px of slopes and flat at run speed is about 3 s; any snag on the way would cost more.
    run(w, 3.2, { mx: 1 });
    expect(w.player.x - 560).toBeGreaterThan(P.runSpeed * 3.2 * 0.95);
  });
});

describe('steep slopes are not walls', () => {
  /** Leaps from beside a rise toward it and reports whether the creature ever clung to it. */
  const leapAt = (rise: (b: LevelBuilder) => void, x: number): { clung: boolean; x: number } => {
    const w = makeWorld(flatLevel(rise));
    settle(w);
    // In the air at the foot of the rise, drifting into it.
    w.player.x = x;
    w.player.y = -45;
    w.player.vy = 0;
    w.player.onGround = false;
    let clung = false;
    for (let i = 0; i < 50; i++) {
      w.step(intent({ mx: 1 }), FIXED_DT);
      clung = clung || w.player.sliding;
    }
    return { clung, x: w.player.x };
  };

  it('pressed into a steep slope in the air, the creature rides onto it instead of hanging there', () => {
    const r = leapAt((b) => b.slope(40, -80), 598);
    expect(r.clung).toBe(false);
    expect(r.x).toBeGreaterThan(612);
  });

  it('a real wall can still be clung to', () => {
    expect(leapAt((b) => b.step(-120), 585).clung).toBe(true);
  });
});

describe('foes and the level', () => {
  it('a patrolling crab turns at a wall instead of climbing through it', () => {
    const w = makeWorld(flatLevel((b) => b.flat(100).step(-60)));
    const e = spawnEnemy(w, 'skitter', 660, -14, 520, 820, false, -1, 0);
    e.active = true;
    let top = e.y;
    let right = e.x;
    for (let i = 0; i < 900; i++) {
      w.step(intent(), FIXED_DT);
      top = Math.min(top, e.y);
      right = Math.max(right, e.x);
    }
    expect(right).toBeLessThan(700);
    expect(top).toBeGreaterThan(-20);
  });

  it('a crab does not walk off a cliff on patrol', () => {
    const w = makeWorld(flatLevel((b) => b.flat(100).step(120)));
    const e = spawnEnemy(w, 'skitter', 660, -14, 520, 820, false, -1, 0);
    e.active = true;
    let low = e.y;
    for (let i = 0; i < 360; i++) {
      w.step(intent(), FIXED_DT);
      low = Math.max(low, e.y);
    }
    expect(low).toBeLessThan(0);
  });

  it('a flyer stays under a cave roof', () => {
    const w = makeWorld(flatLevel((b) => b.flat(40).caveStart(80).flat(500).caveEnd(80)));
    const e = spawnEnemy(w, 'gloomwing', 900, -40, 700, 1100, false, -1, 0);
    e.active = true;
    w.player.x = 860;
    let worst = Infinity;
    for (let i = 0; i < 300; i++) {
      e.vy = Math.min(e.vy, -200);
      w.step(intent(), FIXED_DT);
      worst = Math.min(worst, e.y - ENEMY.gloomwing.r - w.ceil.at(e.x));
    }
    expect(worst).toBeGreaterThanOrEqual(-0.5);
  });

  it('a stone block stops a walking foe', () => {
    const w = makeWorld(flatLevel((b) => b.flat(100).block(0, 60, 40, 60)));
    const e = spawnEnemy(w, 'skitter', 640, -14, 520, 820, false, -1, 0);
    e.active = true;
    let right = e.x;
    for (let i = 0; i < 360; i++) {
      w.step(intent(), FIXED_DT);
      right = Math.max(right, e.x);
    }
    const block = w.blocks[0];
    expect(right).toBeLessThan(block.x);
  });
});
