/** Dev helper: npx vite-node scripts/debug-bot.ts <chapter> <difficulty> — logs every failure the bot hits. */
import { Bot } from '../src/game/core/bot';
import { FIXED_DT } from '../src/game/core/constants';
import type { Difficulty } from '../src/game/core/types';
import { World } from '../src/game/core/world';
import { getChapter } from '../src/game/levels';

const level = getChapter(Number(process.argv[2] || 1));
const w = new World(level, { difficulty: (process.argv[3] || 'standard') as Difficulty, mode: 'story', tideScale: Number(process.env.TIDE || 1) });
const bot = new Bot(w, process.argv[4] === 'collect');
let t = 0;
let lastLog = -10;
while (t < Number(process.env.LIMIT || 300) && w.status !== 'complete') {
  w.step(bot.update(FIXED_DT), FIXED_DT);
  for (let i = 0; i < w.eventCount; i++) {
    const e = w.events[i];
    if (['caught', 'swept', 'bite', 'sting', 'checkpoint'].includes(e.type)) {
      console.log(t.toFixed(1), e.type, Math.round(e.x), Math.round(e.y), 'lumen', Math.round(w.player.lumen), 'water', Math.round(w.waterY), 'wp', bot.index, JSON.stringify(level.waypoints[bot.index]));
    }
  }
  w.clearEvents();
  if (w.status === 'failed' && w.player.statusT > 1) w.respawn();
  if (t - lastLog > 10) {
    lastLog = t;
    const p = w.player;
    console.log(t.toFixed(0), 'x', Math.round(p.x), 'y', Math.round(p.y), 'swim', p.swim, 'lumen', Math.round(p.lumen), 'water', Math.round(w.waterY), 'ground', Math.round(w.ground.at(p.x)), 'wp', bot.index, JSON.stringify(level.waypoints[bot.index]), 'onG', p.onGround, 'fish', w.fish.filter((f) => Math.abs(f.x - p.x) < 300).map((f) => `${f.kind}:${f.mode}:${Math.round(f.x - p.x)},${Math.round(f.y - p.y)}`).join(' '));
  }
  t += FIXED_DT;
}
console.log('done', w.status, t.toFixed(1));
