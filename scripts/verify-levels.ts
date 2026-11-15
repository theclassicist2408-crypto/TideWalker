/**
 * Plays every chapter with the verification bot and prints a table.
 * Run with: npx vite-node scripts/verify-levels.ts [chapter]
 */
import { runBot } from '../src/game/core/bot';
import type { Difficulty } from '../src/game/core/types';
import { World } from '../src/game/core/world';
import { allChapters } from '../src/game/levels';

const only = process.argv[2] ? Number(process.argv[2]) : 0;
const rows: Record<string, string | number>[] = [];
for (const level of allChapters()) {
  if (only && level.index !== only) continue;
  for (const difficulty of ['gentle', 'standard', 'intense'] as Difficulty[]) {
    const run = runBot(() => new World(level, { difficulty, mode: 'story' }), false);
    rows.push({ level: level.id, mode: difficulty, done: String(run.completed), time: run.time.toFixed(1), fails: run.fails, at: run.stuckAt, width: level.goalX });
  }
  // A tide as fast as the bot itself: proves every stretch still works once it is flooded.
  const wet = runBot(() => new World(level, { difficulty: 'standard', mode: 'story', tideScale: 1.7 }), false);
  rows.push({ level: level.id, mode: 'flooded', done: String(wet.completed), time: wet.time.toFixed(1), fails: wet.fails, at: wet.stuckAt, width: level.goalX });
  const col = runBot(() => new World(level, { difficulty: 'standard', mode: 'story' }), true);
  rows.push({ level: level.id, mode: 'collector', done: String(col.completed), time: col.time.toFixed(1), fails: col.fails, at: col.stuckAt, width: `${col.shells}/${col.shellsTotal} ${col.missing.join(',')}` });
}
console.table(rows);
