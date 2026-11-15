import type { LevelData } from '../../core/types';
import { LevelBuilder } from '../builder';
import { bloomDoor, cliff, geyserLift, gullies, haunt, ledges, moonBridge, moonStairs, rest, stones, tideCourt } from '../motifs';

/**
 * Chapter 7 — The Sunken Stair. A drowned city built in steps. Teaches patience with the tide:
 * driftwood gates lift only when the water reaches them, and old stone falls on the hasty.
 */
export function ch07(): LevelData {
  const b = new LevelBuilder({
    id: 'ch07',
    index: 7,
    name: 'The Sunken Stair',
    line: 'Someone built these steps for small lights like you.',
    biome: 'ruins',
    teaches: 'Tide gates',
    weather: { rain: 0, wind: 0.25, lightning: false, fog: 0.45, moon: 0.7, fireflies: 0.3 },
  });

  b.flat(240).hills(200, 8, 2);
  ledges(b, 2, -24, 130);
  b.flat(120).stone(60, 130);
  gullies(b, 2, 56, 130, 160);
  // First tide gate: the sea itself is the key.
  tideCourt(b);
  rest(b, 240);

  b.flat(100).stone(50, 120);
  moonBridge(b, 210, 180);
  b.flat(120).stone(60, 130).stone(20, 140);
  stones(b, 280, 3, 180, true);
  b.flat(140);
  bloomDoor(b);
  b.optional((o) => o.plat(160, 44, 40).plat(96, 86, 44).shell(74, 104));
  ledges(b, 3, -30, 120);
  haunt(b, 400, 120, 'angler', 1);
  b.flat(140).plant(70);
  rest(b, 240);

  geyserLift(b, 120, 4);
  b.flat(120).stone(70, 130);
  moonStairs(b, 4, 30, 200);
  b.flat(240);
  b.optional((o) => o.plat(160, 42, 52, 'moonglass').plat(84, 82, 52, 'moonglass').shell(58, 100, true).secret('lintel', 110, 130, 110, 60));
  tideCourt(b);
  b.flat(120).stone(40, 130).stone(90, 120);
  stones(b, 300, 4, 190, true);
  rest(b, 240);

  ledges(b, 3, -30, 120);
  b.flat(100).stone(50, 130);
  moonBridge(b, 190, 180);
  cliff(b, 92);
  bloomDoor(b);
  geyserLift(b, 130, 3.8);
  b.flat(260).pool(130);
  b.goal();
  b.autoTide(60, 26, 4, 7);
  return b.build();
}
