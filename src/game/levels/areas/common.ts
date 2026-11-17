import type { BiomeId, LevelData, LevelRules, RelicId, WeatherDef } from '../../core/types';
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
  const a = area.index;
  // Side quests: an arch near the start leads to a hard fight with a grand prize. Never on
  // chases, timed or flooded levels, where leaving the route would be unfair.
  const quiet = !spec.rules?.chase && !spec.rules?.timeLimit && !spec.rules?.flooded;
  const slot = TRIAL_LEVELS.indexOf(n);
  if (quiet && slot >= 0) {
    b.trial(`${TRIAL_NAMES[slot]} of ${area.name.replace(/^The /, '')}`, trialWaves(a, slot), { plasma: 120 + a * 60, diamonds: 2 + Math.floor(a / 3), relic: RELIC_ORDER[(a + slot) % RELIC_ORDER.length] }, 90);
    b.hint('trial', 150, 120);
  }
  spec.build(b, s);
  // A chest on every level: a little plasma, a diamond every few levels, now and then a relic.
  b.flat(60).chest(30, { plasma: 20 + a * 12, diamonds: n % 4 === 0 ? 1 : 0, relic: n % 3 === 0 ? RELIC_ORDER[(a + n) % RELIC_ORDER.length] : undefined });
  if (a === 1 && n === 1) b.hint('chest', 110, 120);
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

const TRIAL_LEVELS = [2, 5, 8];
const TRIAL_NAMES = ['The Proving', 'The Gauntlet', 'The Crucible'];
const RELIC_ORDER: RelicId[] = ['draught', 'thunder', 'frost', 'nova'];

/** Foes each area's trials draw on: its own roster, every one elite. */
const TRIAL_FOES: string[][] = [
  ['skitter', 'spitter', 'gloomwing'],
  ['skitter', 'gloomwing', 'shellback'],
  ['burrower', 'lurker', 'spitter'],
  ['shellback', 'spitter', 'gloomwing'],
  ['stormjelly', 'gloomwing', 'skitter'],
  ['thornbloom', 'shellback', 'broodmother'],
  ['emberhusk', 'spitter', 'skitter'],
  ['thornbloom', 'burrower', 'voidling'],
  ['voidling', 'lurker', 'stormjelly'],
  ['sentinel', 'emberhusk', 'thornbloom'],
];

/** Two or three waves of elites; later slots and areas bring more of them. */
function trialWaves(area: number, slot: number): string[][] {
  const f = TRIAL_FOES[area - 1];
  const waves = [[`${f[0]}!`, `${f[1]}!`], [`${f[2]}!`, `${f[0]}!`]];
  if (slot >= 1 || area >= 4) waves.push([`${f[1]}!`, `${f[2]}!`, `${f[0]}!`]);
  return waves;
}

/** Shell ids are per area: `aNN-1` and `aNN-2`. */
export const shellId = (area: number, n: 1 | 2): string => `a${area < 10 ? '0' : ''}${area}-${n}`;

/** Shorthand for writing a level spec. */
export function L(name: string, line: string, twist: string, build: LevelFn, rules?: LevelRules, finale?: boolean): LevelSpec {
  return { name, line, twist, build, rules, finale };
}
