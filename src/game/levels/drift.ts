import type { BiomeId, LevelData } from '../core/types';
import { makeRng } from '../core/util';
import { LevelBuilder } from './builder';

const DRIFT_BIOMES: BiomeId[] = ['pools', 'sanctuary', 'kelp', 'ruins'];
export const DRIFT_LENGTH = 26000;

/**
 * Drift Mode: a procedurally generated, peaceful shoreline. No fish, nothing that stings,
 * no gap that cannot be swum. Each seed gives a different stretch; the game chains them forever.
 */
export function makeDriftLevel(seed: number): LevelData {
  const rng = makeRng(seed);
  const biome = DRIFT_BIOMES[seed % DRIFT_BIOMES.length];
  const b = new LevelBuilder({
    id: `drift-${seed}`,
    index: 0,
    name: 'Drift',
    line: 'Nowhere to be.',
    biome,
    teaches: 'Peace',
    weather: { rain: 0, wind: 0.15, lightning: false, fog: 0.2, moon: 0.6 + rng() * 0.4, fireflies: 0.9 },
  });
  b.tide([[0, 58]], 7, 15);
  b.flat(260);
  while (b.x < DRIFT_LENGTH) {
    // Keep the shore within a band around the waterline so the sea is always near.
    const high = b.y < -70;
    const low = b.y > 16;
    const r = rng();
    if (r < 0.2) {
      b.hills(220 + rng() * 240, 8 + rng() * 14, 1 + Math.floor(rng() * 3));
      b.fireflies(120, 30 + rng() * 20, 3);
    } else if (r < 0.36) {
      const dy = high ? 30 + rng() * 40 : low ? -(30 + rng() * 30) : (rng() - 0.5) * 70;
      b.slope(200 + rng() * 220, dy);
    } else if (r < 0.52) {
      // A shallow pool to wade or swim.
      b.slope(90, Math.max(0, 20 - b.y) * 0.5);
      const w = 220 + rng() * 260;
      b.basin(w, 74 + rng() * 40 + Math.max(0, -b.y), 0.3);
      if (rng() < 0.6) b.kelp(w * 0.55, 50, 60);
      b.fireflies(w * 0.5, 26, 4, 40);
    } else if (r < 0.62) {
      const n = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i++) {
        b.step(high ? 22 : low ? -22 : rng() < 0.5 ? -22 : 22);
        b.flat(110 + rng() * 80);
      }
    } else if (r < 0.74) {
      // Moonglass arc: optional high road strung with fireflies.
      b.flat(320);
      b.plat(250, 38, 60, 'moonglass', false).plat(170, 66, 60, 'moonglass', false).plat(90, 38, 60, 'moonglass', false);
      b.fireflies(140, 96, 5, 46);
    } else if (r < 0.86) {
      b.flat(240 + rng() * 120);
      b.pool(140, 44 + rng() * 14);
      if (rng() < 0.7) b.plant(40);
    } else {
      b.flat(160 + rng() * 200);
      b.plant(80);
      b.fireflies(60, 30 + rng() * 30, 3);
    }
    if (rng() < 0.25) b.kin(60, 26 + rng() * 20);
  }
  b.flat(400).goal();
  return b.build();
}

/** The still scene behind the title screen. */
export function titleLevel(): LevelData {
  const b = new LevelBuilder({
    id: 'title',
    index: 0,
    name: 'Tidewalker',
    line: '',
    biome: 'pools',
    teaches: '',
    weather: { rain: 0, wind: 0.2, lightning: false, fog: 0.25, moon: 1, fireflies: 0.9 },
  });
  b.tide([[0, 30]], 4, 9);
  b.flat(200).hills(260, 10, 2).flat(120);
  b.pool(60, 50).plant(150).fireflies(40, 40, 5, 50);
  b.slope(160, 26).basin(380, 80, 0.3).kelp(200, 60, 60).flat(300).goal();
  const level = b.build();
  level.spawn = { x: 520, y: -9 };
  return level;
}
