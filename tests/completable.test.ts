import { describe, expect, it } from 'vitest';
import { runBot } from '../src/game/core/bot';
import type { Difficulty } from '../src/game/core/types';
import { World } from '../src/game/core/world';
import { allLevels, getTutorial } from '../src/game/levels';
import { fullLoadout, minimumLoadout } from '../src/game/levels/progress';

const DIFFS: Difficulty[] = ['gentle', 'standard', 'intense'];

describe('the verification bot finishes everything with the weakest loadout', () => {
  it.each(DIFFS)('tutorial on %s', (d) => {
    const t = getTutorial();
    const r = runBot(() => new World(t, { difficulty: d, mode: 'tutorial', loadout: fullLoadout() }), false);
    expect(r.completed).toBe(true);
  });

  for (let a = 1; a <= 10; a++) {
    it.each(DIFFS)(`area ${a} on %s`, (d) => {
      const failed: string[] = [];
      for (const l of allLevels().filter((x) => x.area === a)) {
        const r = runBot(() => new World(l, { difficulty: d, mode: 'story', loadout: minimumLoadout(l.area, l.index) }), false);
        if (!r.completed) failed.push(`${l.id} (stuck at ${r.stuckAt}, ${r.fails} deaths)`);
      }
      expect(failed).toEqual([]);
    });

    it(`area ${a}: both Memory Shells can be collected`, () => {
      const missing: string[] = [];
      for (const l of allLevels().filter((x) => x.area === a && x.shells.length > 0)) {
        const r = runBot(() => new World(l, { difficulty: 'standard', mode: 'story', loadout: minimumLoadout(l.area, l.index) }), true);
        if (!r.completed || r.missing.length) missing.push(`${l.id}: ${r.missing.join(',') || 'not finished'}`);
      }
      expect(missing).toEqual([]);
    });
  }
});
