import { describe, expect, it } from 'vitest';
import { Bot } from '../src/game/core/bot';
import { FIXED_DT } from '../src/game/core/constants';
import { World } from '../src/game/core/world';
import { bossDef } from '../src/game/entities/bosses';
import { getLevel, getTutorial } from '../src/game/levels';
import { fullLoadout } from '../src/game/levels/progress';
import { SaveStore } from '../src/game/save/save';
import { MemoryStorage } from './helpers';

/** Plays a level with the bot, applying events to the save exactly as the game does. */
function play(save: SaveStore, area: number, n: number, seconds = 400): World {
  const level = getLevel(area, n);
  const w = new World(level, { difficulty: 'standard', mode: 'story', loadout: save.loadout() });
  let bot = new Bot(w, false);
  for (let t = 0; t < seconds && w.status !== 'complete'; t += FIXED_DT) {
    if (w.hitstop > 0) {
      w.hitstop -= FIXED_DT;
      continue;
    }
    w.step(bot.update(FIXED_DT), FIXED_DT);
    for (let k = 0; k < w.eventCount; k++) {
      const e = w.events[k];
      if (e.type === 'grant') save.takeGrant(`${level.id}:${e.v}`, w.grants[e.v]);
      if (e.type === 'bossDown' || e.type === 'minibossDown') {
        const a = w.arenas[e.v];
        const id = a.boss ?? a.miniboss;
        if (id) save.defeat(id, bossDef(id).reward);
      }
    }
    w.clearEvents();
    if (w.status === 'failed' && w.player.statusT > 0.9) {
      w.respawn();
      bot = new Bot(w, false).resume();
    }
  }
  if (w.status === 'complete') save.completeLevel(level.id, area, n, w.time, [...w.secretsFound]);
  return w;
}

describe('progress through play', () => {
  it('the tutorial is completable with every ability, and its guardian falls', () => {
    const w = new World(getTutorial(), { difficulty: 'standard', mode: 'tutorial', loadout: fullLoadout() });
    const bot = new Bot(w, false);
    let down = false;
    for (let t = 0; t < 600 && w.status !== 'complete'; t += FIXED_DT) {
      w.step(bot.update(FIXED_DT), FIXED_DT);
      for (let k = 0; k < w.eventCount; k++) if (w.events[k].type === 'minibossDown') down = true;
      w.clearEvents();
      w.hitstop = 0;
    }
    expect(w.status).toBe('complete');
    expect(down).toBe(true);
  });

  it('Area 1 from an empty save: the dash shrine, the wall guardian, the Warden and its gift', () => {
    const save = new SaveStore(new MemoryStorage());
    save.completeTutorial();
    for (let n = 1; n <= 10; n++) {
      const w = play(save, 1, n);
      expect(w.status, `a01-${n}`).toBe('complete');
      if (n === 2) expect(save.data.abilities).toContain('dash');
      if (n === 5) {
        expect(save.data.abilities).toContain('wall');
        expect(save.data.defeated).toContain('brinehound');
      }
    }
    expect(save.data.defeated).toContain('warden');
    expect(save.data.rewards).toEqual(['tidebreaker']);
    expect(save.data.equipped).toBe('tidebreaker');
    expect(save.isOpen(2, 1)).toBe(true);
  });

  it('a boss rematch starts at the lantern by the door, the boss returns, and it can be won', () => {
    const level = getLevel(1, 10);
    const w = new World(level, {
      difficulty: 'standard',
      mode: 'rematch',
      loadout: { ...fullLoadout(), rewards: new Set(['tidebreaker']), equipped: 'tidebreaker' },
      defeated: new Set(['warden', 'clatterjaw']),
      startCheckpoint: level.checkpoints.length - 1,
    });
    const arena = w.arenas.find((a) => a.boss === 'warden')!;
    expect(arena.state).toBe('idle');
    expect(arena.x0 - w.player.x).toBeLessThan(500);
    const bot = new Bot(w, false);
    let down = false;
    for (let t = 0; t < 400 && w.status !== 'complete'; t += FIXED_DT) {
      w.hitstop = 0;
      w.step(bot.update(FIXED_DT), FIXED_DT);
      for (let k = 0; k < w.eventCount; k++) if (w.events[k].type === 'bossDown') down = true;
      w.clearEvents();
      if (w.status === 'failed' && w.player.statusT > 0.9) w.respawn();
    }
    expect(down).toBe(true);
  });
});
