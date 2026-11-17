import { ALL_ABILITIES, FIXED_DT } from '../src/game/core/constants';
import { newIntent, type AbilityId, type Difficulty, type GameMode, type Intent, type LevelData, type Loadout, type RewardId } from '../src/game/core/types';
import { emptyLoadout, World } from '../src/game/core/world';
import { LevelBuilder } from '../src/game/levels/builder';

/** A long flat stage with the sea far below, for isolating one mechanic at a time. */
export function flatLevel(edit?: (b: LevelBuilder) => void, sea = 600): LevelData {
  const b = new LevelBuilder({ id: 'test', area: 1, index: 1, name: 'Test', line: '', biome: 'pools', twist: 'test' });
  b.tide([[0, sea]], 0, 7);
  b.flat(600);
  if (edit) edit(b);
  b.flat(600).goal();
  return b.build();
}

export function loadout(abilities: AbilityId[] = ALL_ABILITIES, reward?: RewardId): Loadout {
  return { ...emptyLoadout(), abilities: new Set(abilities), rewards: new Set(reward ? [reward] : []), equipped: reward ?? null };
}

export function makeWorld(level: LevelData, opts: { difficulty?: Difficulty; mode?: GameMode; load?: Loadout } = {}): World {
  return new World(level, { difficulty: opts.difficulty ?? 'standard', mode: opts.mode ?? 'story', loadout: opts.load ?? loadout() });
}

export function intent(patch: Partial<Intent> = {}): Intent {
  return { ...newIntent(), ...patch };
}

const EDGES = { jump: false, attack: false, dash: false, pulse: false, ability: false };

/** Steps the world for `seconds` with a constant intent (edge flags only on the first step). Returns events seen. */
export function run(w: World, seconds: number, patch: Partial<Intent> = {}): string[] {
  const out: string[] = [];
  const first = intent(patch);
  const rest = intent({ ...patch, ...EDGES });
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i++) {
    w.hitstop = 0;
    w.step(i === 0 ? first : rest, FIXED_DT);
    for (let k = 0; k < w.eventCount; k++) out.push(w.events[k].type);
    w.clearEvents();
  }
  return out;
}

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
