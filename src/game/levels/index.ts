import { AREA_COUNT, LEVELS_PER_AREA } from '../core/constants';
import type { LevelData } from '../core/types';
import { AREA_1, LEVELS_1 } from './areas/a01';
import { AREA_2, LEVELS_2 } from './areas/a02';
import { AREA_3, LEVELS_3 } from './areas/a03';
import { AREA_4, LEVELS_4 } from './areas/a04';
import { AREA_5, LEVELS_5 } from './areas/a05';
import { AREA_6, LEVELS_6 } from './areas/a06';
import { AREA_7, LEVELS_7 } from './areas/a07';
import { AREA_8, LEVELS_8 } from './areas/a08';
import { AREA_9, LEVELS_9 } from './areas/a09';
import { AREA_10, LEVELS_10 } from './areas/a10';
import { buildLevel, type AreaInfo, type LevelSpec } from './areas/common';
import { tutorialLevel } from './tutorial';

const AREAS: { info: AreaInfo; levels: LevelSpec[] }[] = [
  { info: AREA_1, levels: LEVELS_1 },
  { info: AREA_2, levels: LEVELS_2 },
  { info: AREA_3, levels: LEVELS_3 },
  { info: AREA_4, levels: LEVELS_4 },
  { info: AREA_5, levels: LEVELS_5 },
  { info: AREA_6, levels: LEVELS_6 },
  { info: AREA_7, levels: LEVELS_7 },
  { info: AREA_8, levels: LEVELS_8 },
  { info: AREA_9, levels: LEVELS_9 },
  { info: AREA_10, levels: LEVELS_10 },
];

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
