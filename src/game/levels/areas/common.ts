import type { BiomeId, LevelData, LevelRules, WeatherDef } from '../../core/types';
import { LevelBuilder } from '../builder';
import { bench } from '../motifs';
import { Stage } from '../progress';

export interface AreaInfo {
  index: number;
  name: string;
  biome: BiomeId;
  line: string;
  /** The rule that makes this area unlike the others. */
  twist: string;
  boss: string;
  weather: Partial<WeatherDef>;
  /** A closing stretch appended to each level (skipped where `finale: false`). */
  finale?: (b: LevelBuilder, s: Stage, n: number) => void;
}

export type LevelFn = (b: LevelBuilder, s: Stage) => void;

export interface LevelSpec {
  name: string;
  line: string;
  twist: string;
  rules?: LevelRules;
  /** False for levels whose own ending must be the last thing (bosses, chases). */
  finale?: boolean;
  build: LevelFn;
}

/** Builds one level of an area from its spec. */
export function buildLevel(area: AreaInfo, n: number, spec: LevelSpec): LevelData {
  const id = `a${area.index < 10 ? '0' : ''}${area.index}-${n < 10 ? '0' : ''}${n}`;
  const b = new LevelBuilder({ id, area: area.index, index: n, name: spec.name, line: spec.line, biome: area.biome, twist: spec.twist, rules: spec.rules, weather: area.weather });
  const s = new Stage(area.index, n);
  b.flat(240);
  spec.build(b, s);
  // Every level closes with a last stretch in the area's own voice, so none is over in seconds.
  // A lantern ahead of it means a fall there does not cost the whole level.
  if (spec.finale !== false && area.finale) {
    if (b.x - b.lastLantern() > 600) bench(b, 160);
    area.finale(b, s, n);
  }
  b.flat(240).pool(120, 46);
  b.goal();
  return b.build();
}

/** Shell ids are per area: `aNN-1` and `aNN-2`. */
export const shellId = (area: number, n: 1 | 2): string => `a${area < 10 ? '0' : ''}${area}-${n}`;

/** Shorthand for writing a level spec. */
export function L(name: string, line: string, twist: string, build: LevelFn, rules?: LevelRules, finale?: boolean): LevelSpec {
  return { name, line, twist, build, rules, finale };
}
