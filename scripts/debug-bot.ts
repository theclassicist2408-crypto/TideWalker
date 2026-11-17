/** Dev helper: npx vite-node scripts/debug-bot.ts <area> <level> [difficulty] — traces the bot through one level. */
import { Bot } from '../src/game/core/bot';
import { FIXED_DT } from '../src/game/core/constants';
import type { Difficulty } from '../src/game/core/types';
import { World } from '../src/game/core/world';
import { getLevel, getTutorial } from '../src/game/levels';
import { fullLoadout, minimumLoadout } from '../src/game/levels/progress';

const area = Number(process.argv[2] || 1);
const n = Number(process.argv[3] || 1);
const level = area === 0 ? getTutorial() : getLevel(area, n);
const w = new World(level, { difficulty: (process.argv[4] || 'standard') as Difficulty, mode: area === 0 ? 'tutorial' : 'story', loadout: area === 0 ? fullLoadout() : minimumLoadout(area, n) });
const bot = new Bot(w, process.env.COLLECT === '1');
const every = Number(process.env.EVERY || 5);
let t = 0;
let lastLog = -100;
const noisy = ['death', 'hurt', 'checkpoint', 'bossIntro', 'bossPhase', 'bossDown', 'minibossDown', 'arenaStart', 'arenaClear', 'grant'];
while (t < Number(process.env.LIMIT || 200) && w.status !== 'complete') {
  if (w.hitstop > 0) w.hitstop -= FIXED_DT;
  else {
    w.step(bot.update(FIXED_DT), FIXED_DT);
    for (let i = 0; i < w.eventCount; i++) {
      const e = w.events[i];
      if (noisy.includes(e.type)) console.log(t.toFixed(1), e.type, Math.round(e.x), Math.round(e.y), 'hp', w.player.hp, w.boss ? `boss ${Math.round(w.boss.hp)} ${w.boss.spec?.a ?? ''}` : '');
    }
    w.clearEvents();
    if (w.status === 'failed' && w.player.statusT > 0.9) w.respawn();
  }
  if (t - lastLog > every) {
    lastLog = t;
    const p = w.player;
    const i = bot.intent;
    console.log(t.toFixed(0), 'x', Math.round(p.x), 'y', Math.round(p.y), 'g', Math.round(w.ground.at(p.x)), p.onGround ? 'ground' : p.swim ? 'swim' : 'air', 'hp', p.hp, 'water', Math.round(w.waterY), 'wp', bot.index, JSON.stringify(level.waypoints[bot.index]), `in mx${i.mx} j${+i.jump} a${+i.attack}`, w.enemies.filter((e) => e.alive && e.active && Math.abs(e.x - p.x) < 300).map((e) => `${e.kind}:${e.mode}:${Math.round(e.x - p.x)},${Math.round(e.y - p.y)}`).join(' '));
  }
  t += FIXED_DT;
}
console.log('end', w.status, t.toFixed(1), 'deaths', w.totalFails, 'hits', w.hitsTaken);
