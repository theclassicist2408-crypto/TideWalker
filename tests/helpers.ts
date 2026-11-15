import { FIXED_DT } from '../src/game/core/constants';
import { newIntent, type Difficulty, type GameMode, type Intent, type LevelData } from '../src/game/core/types';
import { World } from '../src/game/core/world';
import { LevelBuilder } from '../src/game/levels/builder';

/** A long flat shore with the sea far below, for isolating one mechanic at a time. */
export function flatLevel(edit?: (b: LevelBuilder) => void, sea = 400): LevelData {
  const b = new LevelBuilder({ id: 'test', index: 0, name: 'Test', line: '', biome: 'pools', teaches: '' });
  b.tide([[0, sea]], 0, 7);
  b.flat(600);
  if (edit) edit(b);
  b.flat(600).goal();
  return b.build();
}

export function makeWorld(level: LevelData, difficulty: Difficulty = 'standard', mode: GameMode = 'story'): World {
  return new World(level, { difficulty, mode });
}

export function intent(patch: Partial<Intent> = {}): Intent {
  return { ...newIntent(), ...patch };
}

/** Steps the world for `seconds` with a constant intent (edge flags only on the first step). */
export function run(w: World, seconds: number, patch: Partial<Intent> = {}): void {
  const first = intent(patch);
  const rest = intent({ ...patch, jump: false, dash: false, pulse: false });
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i++) {
    w.step(i === 0 ? first : rest, FIXED_DT);
    w.clearEvents();
  }
}

/** Steps and returns every event type emitted. */
export function runEvents(w: World, seconds: number, patch: Partial<Intent> = {}): string[] {
  const out: string[] = [];
  const first = intent(patch);
  const rest = intent({ ...patch, jump: false, dash: false, pulse: false });
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i++) {
    w.step(i === 0 ? first : rest, FIXED_DT);
    for (let k = 0; k < w.eventCount; k++) out.push(w.events[k].type);
    w.clearEvents();
  }
  return out;
}

/** Lets the creature settle onto the ground. */
export function settle(w: World): void {
  run(w, 0.5);
}

export class MemoryStorage {
  readonly map = new Map<string, string>();
  failWrites = false;
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}
