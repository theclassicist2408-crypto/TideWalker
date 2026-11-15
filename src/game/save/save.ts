import { SAVE_KEY, TOTAL_CHAPTERS } from '../core/constants';
import type { Difficulty, HintKind } from '../core/types';

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  haptics: boolean;
  reducedMotion: boolean;
  screenShake: boolean;
  /** Show on-screen indicators for sounds that warn of danger. */
  visualCues: boolean;
  textScale: number;
  handed: 'right' | 'left';
  difficulty: Difficulty;
  batterySaver: boolean;
}

export interface ChapterRecord {
  completed: boolean;
  bestTime: number | null;
  routes: string[];
}

export interface CheckpointRecord {
  chapter: number;
  index: number;
}

export interface SaveData {
  version: 1;
  /** Highest chapter unlocked (1-based). */
  currentChapter: number;
  chapters: Record<string, ChapterRecord>;
  /** Ids of every Memory Shell collected. */
  shells: string[];
  settings: Settings;
  daily: { lastCompleted: string | null; streak: number; bestTimes: Record<string, number> };
  driftBest: number;
  checkpoint: CheckpointRecord | null;
  tutorial: Partial<Record<HintKind, boolean>>;
  endingSeen: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8,
  music: 0.7,
  sfx: 0.8,
  haptics: true,
  reducedMotion: false,
  screenShake: true,
  visualCues: true,
  textScale: 1,
  handed: 'right',
  difficulty: 'standard',
  batterySaver: false,
};

export function defaultSave(): SaveData {
  return {
    version: 1,
    currentChapter: 1,
    chapters: {},
    shells: [],
    settings: { ...DEFAULT_SETTINGS },
    daily: { lastCompleted: null, streak: 0, bestTimes: {} },
    driftBest: 0,
    checkpoint: null,
    tutorial: {},
    endingSeen: false,
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number, lo: number, hi: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const strings = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === 'string' && s.length < 64))] : []);

/** Rebuilds a valid save from anything: wrong types, missing keys and junk are replaced by defaults. */
export function sanitize(raw: unknown): SaveData {
  const d = defaultSave();
  if (!isObj(raw)) return d;
  d.currentChapter = Math.round(num(raw.currentChapter, 1, 1, TOTAL_CHAPTERS));
  d.shells = strings(raw.shells);
  d.driftBest = num(raw.driftBest, 0, 0, 1e9);
  d.endingSeen = bool(raw.endingSeen, false);

  if (isObj(raw.chapters)) {
    for (const key of Object.keys(raw.chapters)) {
      const c = raw.chapters[key];
      const n = Number(key);
      if (!isObj(c) || !Number.isInteger(n) || n < 1 || n > TOTAL_CHAPTERS) continue;
      const best = typeof c.bestTime === 'number' && Number.isFinite(c.bestTime) && c.bestTime > 0 ? c.bestTime : null;
      d.chapters[key] = { completed: bool(c.completed, false), bestTime: best, routes: strings(c.routes) };
    }
  }
  if (isObj(raw.settings)) {
    const s = raw.settings;
    const def = DEFAULT_SETTINGS;
    d.settings = {
      master: num(s.master, def.master, 0, 1),
      music: num(s.music, def.music, 0, 1),
      sfx: num(s.sfx, def.sfx, 0, 1),
      haptics: bool(s.haptics, def.haptics),
      reducedMotion: bool(s.reducedMotion, def.reducedMotion),
      screenShake: bool(s.screenShake, def.screenShake),
      visualCues: bool(s.visualCues, def.visualCues),
      textScale: num(s.textScale, def.textScale, 0.85, 1.5),
      handed: s.handed === 'left' ? 'left' : 'right',
      difficulty: s.difficulty === 'gentle' || s.difficulty === 'intense' ? s.difficulty : 'standard',
      batterySaver: bool(s.batterySaver, def.batterySaver),
    };
  }
  if (isObj(raw.daily)) {
    const last = raw.daily.lastCompleted;
    d.daily.lastCompleted = typeof last === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(last) ? last : null;
    d.daily.streak = Math.round(num(raw.daily.streak, 0, 0, 100000));
    if (isObj(raw.daily.bestTimes)) {
      for (const key of Object.keys(raw.daily.bestTimes).slice(-60)) {
        const t = raw.daily.bestTimes[key];
        if (/^\d{4}-\d{2}-\d{2}$/.test(key) && typeof t === 'number' && Number.isFinite(t) && t > 0) d.daily.bestTimes[key] = t;
      }
    }
  }
  if (isObj(raw.checkpoint)) {
    const chapter = Math.round(num(raw.checkpoint.chapter, 0, 0, TOTAL_CHAPTERS));
    const index = Math.round(num(raw.checkpoint.index, -1, -1, 200));
    if (chapter >= 1 && index >= 0) d.checkpoint = { chapter, index };
  }
  if (isObj(raw.tutorial)) {
    for (const k of ['move', 'jump', 'glow', 'pulse', 'dive', 'hide', 'dash', 'stop'] as HintKind[]) {
      if (raw.tutorial[k] === true) d.tutorial[k] = true;
    }
  }
  return d;
}

/** Days between two yyyy-mm-dd keys (b - a). */
function dayGap(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/**
 * Local progress. Every mutation writes through immediately; storage failures (private mode,
 * full disk) are swallowed so the game keeps running from memory.
 */
export class SaveStore {
  data: SaveData = defaultSave();
  /** True if the last load found unreadable data and fell back to a fresh save. */
  recovered = false;

  constructor(
    private readonly storage: StorageLike | null,
    private readonly key = SAVE_KEY,
  ) {
    this.load();
  }

  load(): SaveData {
    this.recovered = false;
    let text: string | null = null;
    try {
      text = this.storage ? this.storage.getItem(this.key) : null;
    } catch {
      text = null;
    }
    if (text === null) {
      this.data = defaultSave();
      return this.data;
    }
    try {
      this.data = sanitize(JSON.parse(text));
    } catch {
      this.recovered = true;
      this.data = defaultSave();
    }
    return this.data;
  }

  save(): void {
    try {
      this.storage?.setItem(this.key, JSON.stringify(this.data));
    } catch {
      // Keep playing from memory.
    }
  }

  /** Erases progress but keeps the player's settings. */
  resetProgress(): void {
    const settings = this.data.settings;
    this.data = defaultSave();
    this.data.settings = settings;
    this.save();
  }

  updateSettings(patch: Partial<Settings>): void {
    this.data.settings = { ...this.data.settings, ...patch };
    this.save();
  }

  chapter(index: number): ChapterRecord {
    return this.data.chapters[String(index)] ?? { completed: false, bestTime: null, routes: [] };
  }

  isUnlocked(index: number): boolean {
    return index <= this.data.currentChapter;
  }

  addShell(id: string): boolean {
    if (this.data.shells.includes(id)) return false;
    this.data.shells.push(id);
    this.save();
    return true;
  }

  setCheckpoint(chapter: number, index: number): void {
    this.data.checkpoint = { chapter, index };
    this.save();
  }

  clearCheckpoint(): void {
    if (this.data.checkpoint) {
      this.data.checkpoint = null;
      this.save();
    }
  }

  /** Records a finished chapter. Returns whether the time is a new best. */
  completeChapter(index: number, time: number, routes: string[]): boolean {
    const prev = this.chapter(index);
    const best = prev.bestTime === null || time < prev.bestTime;
    this.data.chapters[String(index)] = {
      completed: true,
      bestTime: best ? time : prev.bestTime,
      routes: [...new Set([...prev.routes, ...routes])],
    };
    if (index >= this.data.currentChapter) this.data.currentChapter = Math.min(TOTAL_CHAPTERS, index + 1);
    if (index === TOTAL_CHAPTERS) this.data.endingSeen = true;
    this.data.checkpoint = null;
    this.save();
    return best;
  }

  /** Records today's Daily Tide. Returns whether the time is a new best for the day. */
  completeDaily(dateKey: string, time: number): boolean {
    const d = this.data.daily;
    const prev = d.bestTimes[dateKey];
    const best = prev === undefined || time < prev;
    if (best) d.bestTimes[dateKey] = time;
    if (d.lastCompleted !== dateKey) {
      d.streak = d.lastCompleted !== null && dayGap(d.lastCompleted, dateKey) === 1 ? d.streak + 1 : 1;
      d.lastCompleted = dateKey;
    }
    const keys = Object.keys(d.bestTimes).sort();
    while (keys.length > 30) delete d.bestTimes[keys.shift() as string];
    this.save();
    return best;
  }

  recordDrift(distance: number): boolean {
    if (distance <= this.data.driftBest) return false;
    this.data.driftBest = Math.round(distance);
    this.save();
    return true;
  }

  markTutorial(kind: HintKind): void {
    if (this.data.tutorial[kind]) return;
    this.data.tutorial[kind] = true;
    this.save();
  }
}

/** localStorage if it works, otherwise null (the store then lives in memory). */
export function browserStorage(): StorageLike | null {
  try {
    const s = window.localStorage;
    const probe = '__tidewalker_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}
