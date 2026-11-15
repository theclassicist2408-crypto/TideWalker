import type { LevelData, WeatherDef } from '../core/types';
import { hashString } from '../core/util';

/** A Daily Tide condition: one unusual night that changes how a short shore plays. */
export interface DailyCondition {
  id: string;
  name: string;
  line: string;
  /** Icon key used by the Daily Tide screen. */
  icon: 'tide' | 'moon' | 'fog' | 'storm' | 'calm' | 'ebb' | 'dark';
  tideScale: number;
  drainScale: number;
  swellScale: number;
  /** Starts high and falls instead of rising. */
  reverseTide: boolean;
  weather: Partial<WeatherDef>;
}

export const DAILY_CONDITIONS: DailyCondition[] = [
  { id: 'spring', name: 'Spring Tide', line: 'The sea comes in fast tonight.', icon: 'tide', tideScale: 1.6, drainScale: 1, swellScale: 1.2, reverseTide: false, weather: { moon: 1, wind: 0.4 } },
  { id: 'newmoon', name: 'Dark Moon', line: 'No moon. Your light is the only light.', icon: 'dark', tideScale: 0.8, drainScale: 1.25, swellScale: 1, reverseTide: false, weather: { moon: 0, fireflies: 0.1, fog: 0.3 } },
  { id: 'fret', name: 'Sea Fret', line: 'Fog walks in off the water.', icon: 'fog', tideScale: 1, drainScale: 1, swellScale: 0.6, reverseTide: false, weather: { fog: 1, moon: 0.4, wind: 0.1 } },
  { id: 'squall', name: 'Squall', line: 'Rain, and a restless swell.', icon: 'storm', tideScale: 1.15, drainScale: 1, swellScale: 2.4, reverseTide: false, weather: { rain: 0.9, wind: 0.9, lightning: true, moon: 0.2 } },
  { id: 'fullmoon', name: 'Bright Moon', line: 'Everything shines. Everything sees.', icon: 'moon', tideScale: 1, drainScale: 0.7, swellScale: 1, reverseTide: false, weather: { moon: 1, fog: 0, fireflies: 0.5 } },
  { id: 'glass', name: 'Still Water', line: 'Not a ripple. Listen.', icon: 'calm', tideScale: 0.7, drainScale: 0.9, swellScale: 0, reverseTide: false, weather: { wind: 0, rain: 0, fog: 0.15, fireflies: 0.8, moon: 0.9 } },
  { id: 'ebb', name: 'Ebb Tide', line: 'Tonight the water is leaving.', icon: 'ebb', tideScale: 1.1, drainScale: 1, swellScale: 1, reverseTide: true, weather: { moon: 0.7, wind: 0.3 } },
];

/** Local calendar key, yyyy-mm-dd. */
export function dateKey(date: Date): string {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${date.getFullYear()}-${m < 10 ? '0' : ''}${m}-${d < 10 ? '0' : ''}${d}`;
}

export interface DailyPick {
  key: string;
  layout: number;
  condition: DailyCondition;
}

/** Deterministic pick for a date: everyone gets the same shore and the same night. */
export function dailyFor(date: Date, layoutCount: number): DailyPick {
  const key = dateKey(date);
  const h = hashString(`tidewalker:${key}`);
  return { key, layout: h % layoutCount, condition: DAILY_CONDITIONS[(h >>> 8) % DAILY_CONDITIONS.length] };
}

/** Returns a copy of `level` with the condition's weather and tide applied. */
export function applyCondition(level: LevelData, c: DailyCondition): LevelData {
  let keys = level.tide.keys.map(([t, y]) => [t, y] as [number, number]);
  if (c.reverseTide) {
    const ys = keys.map((k) => k[1]).reverse();
    keys = keys.map(([t], i) => [t, ys[i]] as [number, number]);
  }
  return {
    ...level,
    id: `${level.id}-${c.id}`,
    name: c.name,
    line: c.line,
    tide: { keys, amp: level.tide.amp * c.swellScale, period: level.tide.period },
    weather: { ...level.weather, ...c.weather },
  };
}
