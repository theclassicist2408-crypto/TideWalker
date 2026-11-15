import type { LevelData } from '../../core/types';
import { LevelBuilder } from '../builder';
import { cliff, gullies, lagoon, ledges, moonBridge, moonStairs, rest } from '../motifs';

/**
 * Chapter 1 — Wreckwash. Storm-wrecked shore, tide still low.
 * Teaches by terrain alone: travel, leap, then light (a chasm only moonglass can cross).
 */
export function ch01(): LevelData {
  const b = new LevelBuilder({
    id: 'ch01',
    index: 1,
    name: 'Wreckwash',
    line: 'The storm set you down among broken things.',
    biome: 'storm',
    teaches: 'Light',
    weather: { rain: 0.75, wind: 0.75, lightning: true, fog: 0.4, moon: 0.35, fireflies: 0.12 },
  });
  b.tide([[0, 66]], 5, 6.5);

  // Wake, and walk.
  b.flat(280).hint('move', 270, 240);
  b.hills(300, 12, 2);
  b.fireflies(150, 30, 3);
  b.flat(150).hint('jump', 140, 190);
  ledges(b, 2, -26, 130);
  b.fireflies(60, 34, 3);
  gullies(b, 2, 54, 160, 150);
  b.optional((o) => o.plat(120, 46, 40).plat(48, 88, 46).shell(26, 106));
  b.flat(140);
  ledges(b, 1, 24, 110);

  // The first dark gap: only light makes a way.
  b.flat(90).hint('glow', 80, 330);
  moonBridge(b, 210, 160);
  b.flat(170).plant(90);
  rest(b, 250);

  // Down to the water's edge, and a first cold swim.
  b.slope(240, 28);
  b.flat(70);
  lagoon(b, 300, 98);
  b.flat(190).plant(120).fireflies(50, 30, 3);
  cliff(b, 88);
  b.flat(170);
  gullies(b, 2, 58, 130, 150);
  b.slope(280, 58);
  b.hills(260, 10, 2);

  // Light as a staircase.
  b.flat(100).hint('glow', 90, 300);
  moonStairs(b, 3, 30, 170);
  b.flat(230);
  b.optional((o) => o.plat(165, 40, 52, 'moonglass').plat(92, 80, 52, 'moonglass').shell(66, 98, true));
  rest(b, 250);

  // The long run down to the tide line, lightning on the water.
  b.slope(520, 150);
  b.flat(260).fireflies(140, 26, 4);
  moonBridge(b, 150, 120);
  b.flat(160).plant(80);
  b.hills(300, 14, 3);
  gullies(b, 3, 56, 120, 130);
  ledges(b, 2, -24, 120);
  b.flat(260).pool(130);
  b.goal();
  return b.build();
}
