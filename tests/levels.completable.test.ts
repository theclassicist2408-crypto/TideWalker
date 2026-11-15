import { describe, expect, it } from 'vitest';
import { runBot } from '../src/game/core/bot';
import type { Difficulty } from '../src/game/core/types';
import { World } from '../src/game/core/world';
import { allChapters } from '../src/game/levels';
import { DAILY_LAYOUTS, getDailyLayout } from '../src/game/levels/daily';
import { makeDriftLevel } from '../src/game/levels/drift';
import { applyCondition, DAILY_CONDITIONS } from '../src/game/systems/daily';

/**
 * The verification bot plays every shore from first step to goal using only player inputs.
 * A failure here means a level is broken, unfair or has an unreachable shell.
 */
describe('every chapter is completable', () => {
  for (const level of allChapters()) {
    for (const difficulty of ['gentle', 'standard', 'intense'] as Difficulty[]) {
      it(`${level.id} ${level.name} — ${difficulty}`, () => {
        const r = runBot(() => new World(level, { difficulty, mode: 'story' }), false, 600);
        expect(r.completed, `stuck at x=${r.stuckAt} after ${r.fails} fails`).toBe(true);
        // A plain player should not be ground down: the assist must not be the only way through.
        expect(r.fails).toBeLessThanOrEqual(8);
      });
    }

    it(`${level.id} — still completable with the tide far ahead`, () => {
      const r = runBot(() => new World(level, { difficulty: 'standard', mode: 'story', tideScale: 1.7 }), false, 600);
      expect(r.completed, `stuck at x=${r.stuckAt}`).toBe(true);
    });

    it(`${level.id} — every Memory Shell is reachable`, () => {
      const r = runBot(() => new World(level, { difficulty: 'standard', mode: 'story' }), true, 600);
      expect(r.completed, `stuck at x=${r.stuckAt}`).toBe(true);
      expect(r.missing).toEqual([]);
      expect(r.shells).toBe(2);
    });
  }
});

describe('every Daily Tide is completable', () => {
  for (let i = 0; i < DAILY_LAYOUTS; i++) {
    for (const c of DAILY_CONDITIONS) {
      it(`${getDailyLayout(i).id} under ${c.name}`, () => {
        const level = applyCondition(getDailyLayout(i), c);
        const r = runBot(() => new World(level, { difficulty: 'standard', mode: 'daily', tideScale: c.tideScale, drainScale: c.drainScale }), false, 400);
        expect(r.completed, `stuck at x=${r.stuckAt} after ${r.fails} fails`).toBe(true);
      });
    }
  }
});

describe('Drift Mode cannot fail', () => {
  it('walks a whole generated shore without a single failure', () => {
    const level = makeDriftLevel(11);
    const w = new World(level, { difficulty: 'standard', mode: 'drift' });
    const r = runBot(() => w, false, 500);
    expect(r.fails).toBe(0);
    expect(w.status).toBe('playing');
    expect(w.player.x).toBeGreaterThan(level.goalX - 200);
  });
});
