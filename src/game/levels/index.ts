import type { LevelData } from '../core/types';
import { ch01 } from './chapters/ch01';
import { ch02 } from './chapters/ch02';
import { ch03 } from './chapters/ch03';
import { ch04 } from './chapters/ch04';
import { ch05 } from './chapters/ch05';
import { ch06 } from './chapters/ch06';
import { ch07 } from './chapters/ch07';
import { ch08 } from './chapters/ch08';
import { ch09 } from './chapters/ch09';
import { ch10 } from './chapters/ch10';

const BUILDERS: (() => LevelData)[] = [ch01, ch02, ch03, ch04, ch05, ch06, ch07, ch08, ch09, ch10];
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
