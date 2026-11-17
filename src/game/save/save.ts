import { ALL_ABILITIES, ALL_REWARDS, AREA_COUNT, BASE_ESSENCE, BASE_HP, BASE_LUMEN, LEVELS_PER_AREA, SAVE_KEY } from '../core/constants';
import type { AbilityId, Difficulty, HintKind, Loadout, RewardId, UpgradeId } from '../core/types';

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  haptics: boolean;
  reducedMotion: boolean;
  screenShake: boolean;
  visualCues: boolean;
  textScale: number;
  handed: 'right' | 'left';
  difficulty: Difficulty;
  batterySaver: boolean;
}

export interface LevelRecord {
  done: boolean;
  bestTime: number | null;
}

export interface SaveData {
  version: 2;
  tutorialDone: boolean;
  /** How many story levels are open (1 = only 1-1; 100 = all). */
  unlocked: number;
  levels: Record<string, LevelRecord>;
  abilities: AbilityId[];
  rewards: RewardId[];
  equipped: RewardId | null;
  upgrades: Record<UpgradeId, number>;
  /** Shrine ids (`level:index`) already taken. */
  grants: string[];
  /** Bosses and minibosses beaten. */
  defeated: string[];
  shells: string[];
  secrets: string[];
  settings: Settings;
  driftBest: number;
  checkpoint: { level: string; index: number } | null;
  hints: Partial<Record<HintKind, boolean>>;
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

export const TOTAL = AREA_COUNT * LEVELS_PER_AREA;

export function defaultSave(): SaveData {
  return {
    version: 2,
    tutorialDone: false,
    unlocked: 1,
    levels: {},
    abilities: [],
    rewards: [],
    equipped: null,
    upgrades: { health: 0, lumen: 0, essence: 0, pulse: 0 },
    grants: [],
    defeated: [],
    shells: [],
    secrets: [],
    settings: { ...DEFAULT_SETTINGS },
    driftBest: 0,
    checkpoint: null,
    hints: {},
    endingSeen: false,
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number, lo: number, hi: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const strings = (v: unknown, max = 400): string[] => (Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === 'string' && s.length < 64))].slice(0, max) : []);

/** Rebuilds a valid save from anything: wrong types, missing keys and junk become defaults. */
export function sanitize(raw: unknown): SaveData {
  const d = defaultSave();
  if (!isObj(raw)) return d;
  d.tutorialDone = bool(raw.tutorialDone, false);
  d.unlocked = Math.round(num(raw.unlocked, 1, 1, TOTAL));
  d.abilities = strings(raw.abilities).filter((a): a is AbilityId => (ALL_ABILITIES as string[]).includes(a));
  d.rewards = strings(raw.rewards).filter((a): a is RewardId => (ALL_REWARDS as string[]).includes(a));
  d.equipped = typeof raw.equipped === 'string' && d.rewards.includes(raw.equipped as RewardId) ? (raw.equipped as RewardId) : (d.rewards[d.rewards.length - 1] ?? null);
  d.grants = strings(raw.grants);
  d.defeated = strings(raw.defeated);
  d.shells = strings(raw.shells);
  d.secrets = strings(raw.secrets);
  d.driftBest = num(raw.driftBest, 0, 0, 1e9);
  d.endingSeen = bool(raw.endingSeen, false);
  if (isObj(raw.upgrades)) {
    d.upgrades = { health: Math.round(num(raw.upgrades.health, 0, 0, 6)), lumen: Math.round(num(raw.upgrades.lumen, 0, 0, 6)), essence: Math.round(num(raw.upgrades.essence, 0, 0, 6)), pulse: Math.round(num(raw.upgrades.pulse, 0, 0, 3)) };
  }
  if (isObj(raw.levels)) {
    for (const key of Object.keys(raw.levels).slice(0, 200)) {
      const c = raw.levels[key];
      if (!isObj(c) || !/^a\d{2}-\d{2}$/.test(key)) continue;
      const best = typeof c.bestTime === 'number' && Number.isFinite(c.bestTime) && c.bestTime > 0 ? c.bestTime : null;
      d.levels[key] = { done: bool(c.done, false), bestTime: best };
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
  if (isObj(raw.checkpoint) && typeof raw.checkpoint.level === 'string' && /^a\d{2}-\d{2}$/.test(raw.checkpoint.level)) {
    const index = Math.round(num(raw.checkpoint.index, -1, -1, 50));
    if (index >= 0) d.checkpoint = { level: raw.checkpoint.level, index };
  }
  if (isObj(raw.hints)) for (const k of Object.keys(raw.hints).slice(0, 40)) if (raw.hints[k] === true) d.hints[k as HintKind] = true;
  return d;
}

/** Story position (0-based) of a level: area 1 level 1 is 0. */
export const levelOrder = (area: number, level: number): number => (area - 1) * LEVELS_PER_AREA + (level - 1);

/** Local progress. Every change writes through; storage failures fall back to memory. */
export class SaveStore {
  data: SaveData = defaultSave();
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

  /** What the Tideborn carries into a level. */
  loadout(): Loadout {
    const d = this.data;
    return {
      abilities: new Set(d.abilities),
      rewards: new Set(d.rewards),
      equipped: d.equipped,
      hpMax: BASE_HP + d.upgrades.health,
      lumenMax: BASE_LUMEN + d.upgrades.lumen * 25,
      essenceMax: BASE_ESSENCE + d.upgrades.essence,
      pulseLevel: d.upgrades.pulse,
    };
  }

  level(id: string): LevelRecord {
    return this.data.levels[id] ?? { done: false, bestTime: null };
  }

  isOpen(area: number, level: number): boolean {
    return this.data.tutorialDone && levelOrder(area, level) < this.data.unlocked;
  }

  completeTutorial(): void {
    this.data.tutorialDone = true;
    this.data.checkpoint = null;
    this.save();
  }

  /** Records a finished level and opens the next. Returns whether the time is a new best. */
  completeLevel(id: string, area: number, level: number, time: number, secrets: string[]): boolean {
    const prev = this.level(id);
    const best = prev.bestTime === null || time < prev.bestTime;
    this.data.levels[id] = { done: true, bestTime: best ? time : prev.bestTime };
    this.data.unlocked = Math.min(TOTAL, Math.max(this.data.unlocked, levelOrder(area, level) + 2));
    for (const s of secrets) if (!this.data.secrets.includes(s)) this.data.secrets.push(s);
    this.data.checkpoint = null;
    if (area === AREA_COUNT && level === LEVELS_PER_AREA) this.data.endingSeen = true;
    this.save();
    return best;
  }

  /** A shrine was used. Returns false if it was already recorded. */
  takeGrant(id: string, what: { ability?: AbilityId; upgrade?: UpgradeId }): boolean {
    if (this.data.grants.includes(id)) return false;
    this.data.grants.push(id);
    if (what.ability && !this.data.abilities.includes(what.ability)) this.data.abilities.push(what.ability);
    if (what.upgrade) this.data.upgrades[what.upgrade]++;
    this.save();
    return true;
  }

  /** A guardian fell. Bosses hand over their gift, which is equipped at once. */
  defeat(id: string, reward?: RewardId): boolean {
    const fresh = !this.data.defeated.includes(id);
    if (fresh) this.data.defeated.push(id);
    if (reward && !this.data.rewards.includes(reward)) {
      this.data.rewards.push(reward);
      this.data.equipped = reward;
    }
    this.save();
    return fresh;
  }

  /** Equips the next boss gift owned. */
  cycleReward(): RewardId | null {
    const r = this.data.rewards;
    if (r.length === 0) return null;
    const i = this.data.equipped ? r.indexOf(this.data.equipped) : -1;
    this.data.equipped = r[(i + 1) % r.length];
    this.save();
    return this.data.equipped;
  }

  addShell(id: string): boolean {
    if (this.data.shells.includes(id)) return false;
    this.data.shells.push(id);
    this.save();
    return true;
  }

  setCheckpoint(level: string, index: number): void {
    this.data.checkpoint = { level, index };
    this.save();
  }

  clearCheckpoint(): void {
    if (this.data.checkpoint) {
      this.data.checkpoint = null;
      this.save();
    }
  }

  recordDrift(distance: number): boolean {
    if (distance <= this.data.driftBest) return false;
    this.data.driftBest = Math.round(distance);
    this.save();
    return true;
  }

  markHint(kind: HintKind): void {
    if (this.data.hints[kind]) return;
    this.data.hints[kind] = true;
    this.save();
  }
}

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
