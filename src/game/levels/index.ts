import type { LevelData } from '../core/types';
import { ch01 } from './chapters/ch01';

const BUILDERS: (() => LevelData)[] = [ch01];
const cache = new Map<number, LevelData>();

export const CHAPTER_COUNT = BUILDERS.length;

/** Returns chapter `index` (1-based). Levels are built once and cached. */
export function getChapter(index: number): LevelData {
  if (index < 1 || index > BUILDERS.length) throw new Error(`No chapter ${index}`);
  let level = cache.get(index);
  if (!level) {
    level = BUILDERS[index - 1]();
    cache.set(index, level);
  }
  return level;
}

export function allChapters(): LevelData[] {
  const out: LevelData[] = [];
  for (let i = 1; i <= BUILDERS.length; i++) out.push(getChapter(i));
  return out;
}
