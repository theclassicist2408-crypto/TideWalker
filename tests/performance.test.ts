import { describe, expect, it } from 'vitest';
import { Bot } from '../src/game/core/bot';
import { FIXED_DT } from '../src/game/core/constants';
import { World } from '../src/game/core/world';
import { getLevel } from '../src/game/levels';
import { minimumLoadout } from '../src/game/levels/progress';

describe('performance and accessibility', () => {
  it('a simulation step stays far inside the frame budget, even in the final boss fight', () => {
    const level = getLevel(10, 10);
    const w = new World(level, { difficulty: 'intense', mode: 'story', loadout: minimumLoadout(10, 10), startCheckpoint: level.checkpoints.length - 1 });
    const bot = new Bot(w, false);
    const steps = 60 * 60;
    const t0 = performance.now();
    for (let i = 0; i < steps; i++) {
      w.hitstop = 0;
      w.step(bot.update(FIXED_DT), FIXED_DT);
      w.clearEvents();
      if (w.status === 'failed' && w.player.statusT > 0.9) w.respawn();
    }
    const perStep = (performance.now() - t0) / steps;
    expect(perStep).toBeLessThan(1);
  });

  it('pools hold: projectiles and zones never grow without bound', () => {
    const level = getLevel(6, 10);
    const w = new World(level, { difficulty: 'standard', mode: 'story', loadout: minimumLoadout(6, 10), startCheckpoint: level.checkpoints.length - 1 });
    const bot = new Bot(w, false);
    for (let i = 0; i < 60 * 90; i++) {
      w.hitstop = 0;
      w.step(bot.update(FIXED_DT), FIXED_DT);
      w.clearEvents();
      if (w.status === 'failed' && w.player.statusT > 0.9) w.respawn();
    }
    expect(w.projectiles.length).toBeLessThanOrEqual(256);
    expect(w.zones.length).toBeLessThanOrEqual(128);
  });

  it('no difficulty removes a guardian or a fight', () => {
    for (const d of ['gentle', 'standard', 'intense'] as const) {
      const w = new World(getLevel(3, 10), { difficulty: d, mode: 'story', loadout: minimumLoadout(3, 10) });
      expect(w.arenas.some((a) => a.boss)).toBe(true);
      expect(w.enemies.length).toBe(getLevel(3, 10).enemies.length);
    }
  });
});
