import type { LevelData } from '../../core/types';
import { LevelBuilder } from '../builder';
import { bloomDoor, cliff, geyserLift, gullies, haunt, ledges, moonStairs, rest, stones } from '../motifs';

/**
 * Chapter 4 — Moonwell Terraces. A stair of pools climbing the cliff while the sea climbs after it.
 * Teaches the shore's own machinery: vents that throw you, ledges that fall, doors that open to light.
 */
export function ch04(): LevelData {
  const b = new LevelBuilder({
    id: 'ch04',
    index: 4,
    name: 'Moonwell Terraces',
    line: 'Every pool is a step. The sea is climbing too.',
    biome: 'pools',
    teaches: 'Vents and blooms',
    weather: { rain: 0, wind: 0.3, lightning: false, fog: 0.3, moon: 0.9, fireflies: 0.6 },
  });

  b.flat(260).hills(240, 12, 2);
  gullies(b, 2, 56, 130, 150);
  // First vent: the only way up the first terrace.
  geyserLift(b, 120);
  b.flat(180).fireflies(90, 30, 3).plant(40);
  stones(b, 280, 3, 150, true);
  b.flat(120);
  bloomDoor(b);
  rest(b, 240);

  cliff(b, 90);
  b.flat(140);
  haunt(b, 380, 110, 'drifter', 2);
  b.flat(140).plant(70);
  geyserLift(b, 130, 3.8);
  b.flat(200);
  b.optional((o) => o.plat(150, 44, 40, 'crumble').plat(80, 86, 44).shell(58, 104));
  ledges(b, 2, -28, 120);
  moonStairs(b, 3, 32, 190);
  rest(b, 240);

  stones(b, 320, 4, 180, true);
  b.flat(140).plant(70);
  cliff(b, 92);
  bloomDoor(b);
  b.flat(120);
  geyserLift(b, 140, 4);
  b.flat(180).fireflies(90, 30, 4);
  gullies(b, 2, 58, 130, 160);
  moonStairs(b, 4, 30, 200);
  b.flat(220);
  b.optional((o) => o.plat(160, 42, 52, 'moonglass').plat(84, 82, 52, 'moonglass').shell(58, 100, true).secret('crown', 110, 130, 110, 60));
  rest(b, 240);

  ledges(b, 3, -30, 120);
  stones(b, 260, 3, 180, true);
  b.flat(120);
  geyserLift(b, 130, 3.6);
  cliff(b, 88);
  b.flat(260).pool(130);
  b.goal();
  b.autoTide(70, 28, 5, 7);
  return b.build();
}
