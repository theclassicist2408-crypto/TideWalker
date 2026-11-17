import { AREA_COUNT, LEVELS_PER_AREA } from '../core/constants';
import type { LevelData } from '../core/types';
import { AREA_1, LEVELS_1 } from './areas/a01';
import { buildLevel, type AreaInfo, type LevelSpec } from './areas/common';
import { tutorialLevel } from './tutorial';

const AREAS: { info: AreaInfo; levels: LevelSpec[] }[] = [{ info: AREA_1, levels: LEVELS_1 }];

const cache = new Map<string, LevelData>();

export const areaCount = (): number => AREAS.length;

export function areaInfo(area: number): AreaInfo {
  const a = AREAS[area - 1];
  if (!a) throw new Error(`No area ${area}`);
  return a.info;
}

export function allAreas(): AreaInfo[] {
  return AREAS.map((a) => a.info);
}

/** Level `n` (1–10) of area `area` (1–10). Built once and cached. */
export function getLevel(area: number, n: number): LevelData {
  const a = AREAS[area - 1];
  if (!a || n < 1 || n > a.levels.length) throw new Error(`No level ${area}-${n}`);
  const key = `${area}:${n}`;
  let level = cache.get(key);
  if (!level) {
    level = buildLevel(a.info, n, a.levels[n - 1]);
    cache.set(key, level);
  }
  return level;
}

export function getTutorial(): LevelData {
  let level = cache.get('tutorial');
  if (!level) {
    level = tutorialLevel();
    cache.set('tutorial', level);
  }
  return level;
}

export function allLevels(): LevelData[] {
  const out: LevelData[] = [];
  for (let a = 1; a <= AREAS.length; a++) for (let n = 1; n <= AREAS[a - 1].levels.length; n++) out.push(getLevel(a, n));
  return out;
}

export const TOTAL_LEVELS = AREA_COUNT * LEVELS_PER_AREA;
