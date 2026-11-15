import type { LevelData } from '../core/types';
import { LevelBuilder } from './builder';
import { cliff, gullies, lagoon, ledges, moonBridge, moonStairs, rest, stones } from './motifs';

/** Daily Tide shores: three short handcrafted crossings. The night's condition is applied on top. */

function skerry(): LevelData {
  const b = new LevelBuilder({ id: 'daily-skerry', index: 0, name: 'The Skerry', line: '', biome: 'pools', teaches: 'Daily', weather: { fireflies: 0.4, moon: 0.8 } });
  b.flat(220);
  gullies(b, 2, 56, 130, 150);
  stones(b, 300, 4, 150);
  b.flat(150).plant(70);
  lagoon(b, 340, 110, 2);
  b.fish('drifter', 250, -70, 90, -70);
  rest(b, 220);
  moonBridge(b, 200, 150);
  ledges(b, 2, -26, 110);
  moonStairs(b, 3, 30, 170);
  b.flat(200).pool(100).goal();
  b.autoTide(60, 24, 5, 7);
  return b.build();
}

function causeway(): LevelData {
  const b = new LevelBuilder({ id: 'daily-causeway', index: 0, name: 'The Causeway', line: '', biome: 'ruins', teaches: 'Daily', weather: { fog: 0.4, moon: 0.6, fireflies: 0.2 } });
  b.flat(240);
  stones(b, 260, 3, 160, true);
  b.flat(160).plant(80);
  cliff(b, 84);
  b.flat(120).stone(60, 120);
  moonBridge(b, 220, 170);
  rest(b, 220);
  b.slope(260, 80);
  lagoon(b, 320, 100, 1);
  b.fish('angler', 160, -74);
  b.flat(140).plant(70);
  gullies(b, 3, 58, 120, 150);
  ledges(b, 2, -28, 120);
  b.flat(200).pool(100).goal();
  b.autoTide(60, 24, 5, 7);
  return b.build();
}

function reedbed(): LevelData {
  const b = new LevelBuilder({ id: 'daily-reedbed', index: 0, name: 'The Reedbed', line: '', biome: 'kelp', teaches: 'Daily', weather: { fog: 0.3, moon: 0.7, fireflies: 0.6 } });
  b.flat(220).hills(240, 12, 2);
  lagoon(b, 420, 120, 3);
  b.fish('drifter', 330, -80, 110, -80);
  b.flat(160).plant(80);
  gullies(b, 2, 56, 130, 150);
  rest(b, 220);
  moonStairs(b, 3, 30, 170);
  b.flat(160);
  b.slope(300, 90);
  lagoon(b, 360, 110, 2);
  b.fish('drifter', 260, -76, 100, -76);
  b.flat(150).plant(60);
  stones(b, 240, 3, 150);
  b.flat(200).pool(100).goal();
  b.autoTide(60, 24, 5, 7);
  return b.build();
}

const BUILDERS = [skerry, causeway, reedbed];
const cache = new Map<number, LevelData>();
export const DAILY_LAYOUTS = BUILDERS.length;

export function getDailyLayout(index: number): LevelData {
  const i = ((index % BUILDERS.length) + BUILDERS.length) % BUILDERS.length;
  let level = cache.get(i);
  if (!level) {
    level = BUILDERS[i]();
    cache.set(i, level);
  }
  return level;
}
