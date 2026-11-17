/**
 * Plays levels with the verification bot and prints a table.
 * Run with: npx vite-node scripts/verify-levels.ts [area] [level]     (area 0 = tutorial)
 */
import { runBot } from '../src/game/core/bot';
import type { Difficulty, LevelData, Loadout } from '../src/game/core/types';
import { World } from '../src/game/core/world';
import { allLevels, getTutorial } from '../src/game/levels';
import { fullLoadout, minimumLoadout } from '../src/game/levels/progress';

const onlyArea = process.argv[2] !== undefined ? Number(process.argv[2]) : -1;
const onlyLevel = process.argv[3] !== undefined ? Number(process.argv[3]) : -1;
const rows: Record<string, string | number>[] = [];
const run = (level: LevelData, difficulty: Difficulty, loadout: Loadout, collect: boolean): void => {
  const r = runBot(() => new World(level, { difficulty, mode: level.area === 0 ? 'tutorial' : 'story', loadout }), collect);
  rows.push({ level: level.id, name: level.name, mode: collect ? 'collect' : difficulty, done: String(r.completed), time: r.time.toFixed(0), deaths: r.fails, hits: r.hits, at: `${r.stuckAt}/${level.goalX}`, shells: `${r.shells}/${r.shellsTotal}` });
};
if (onlyArea <= 0) for (const d of ['gentle', 'standard', 'intense'] as Difficulty[]) run(getTutorial(), d, fullLoadout(), d === 'standard');
for (const level of allLevels()) {
  if (onlyArea >= 0 && level.area !== onlyArea) continue;
  if (onlyLevel >= 0 && level.index !== onlyLevel) continue;
  const load = minimumLoadout(level.area, level.index);
  for (const d of ['gentle', 'standard', 'intense'] as Difficulty[]) run(level, d, load, false);
  if (level.shells.length) run(level, 'standard', load, true);
}
console.table(rows);
