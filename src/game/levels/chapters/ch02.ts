import type { LevelData } from '../../core/types';
import { LevelBuilder } from '../builder';
import { cliff, gullies, lagoon, ledges, moonBridge, moonStairs, rest, stones } from '../motifs';

/**
 * Chapter 2 — The First Rising. The tide turns. Teaches the sea itself:
 * wading, swimming, breaching, currents that carry and restore, and the water climbing behind you.
 */
export function ch02(): LevelData {
  const b = new LevelBuilder({
    id: 'ch02',
    index: 2,
    name: 'The First Rising',
    line: 'The sea remembered the shore, and came back for it.',
    biome: 'storm',
    teaches: 'Tide',
    weather: { rain: 0.5, wind: 0.6, lightning: true, fog: 0.35, moon: 0.45, fireflies: 0.15 },
  });

  b.flat(260).hills(260, 12, 2);
  gullies(b, 2, 56, 140, 150);
  // Down to the tide line: the first deliberate swim.
  b.slope(200, 44);
  b.flat(80).hint('dive', 70, 240);
  lagoon(b, 380, 120);
  b.current(300, -14, 240, 96, 190, 0, { safe: true });
  b.flat(170).plant(90);
  b.slope(220, -50);
  stones(b, 270, 3, 170);
  rest(b, 240);

  // Tidal flats: low ground the swell keeps reaching for.
  b.slope(240, 26);
  b.flat(120).hint('dash', 110, 260);
  gullies(b, 3, 60, 130, 120);
  b.optional((o) => o.plat(250, 44, 40).plat(180, 84, 44).shell(158, 102));
  cliff(b, 84);
  b.flat(180).fireflies(90, 30, 3);
  moonBridge(b, 220, 180);
  b.flat(150).plant(70);
  ledges(b, 2, -26, 120);
  rest(b, 240);

  // A channel where the rising tide pushes back.
  b.slope(260, 60);
  lagoon(b, 460, 130, 1);
  b.current(380, -16, 150, 100, -330, 0, { mode: 'beat', period: 5.5, duty: 0.55 });
  b.current(200, -16, 150, 100, 200, 0, { safe: true });
  b.flat(160).plant(80);
  cliff(b, 92);
  b.flat(140);
  stones(b, 300, 4, 170, true);
  b.flat(140);
  moonStairs(b, 3, 32, 190);
  b.flat(220);
  b.optional((o) => o.plat(160, 42, 52, 'moonglass').plat(84, 82, 52, 'moonglass').shell(58, 100, true).secret('high', 110, 130, 110, 60));
  rest(b, 240);

  // The water is at your heels now.
  gullies(b, 2, 58, 130, 140);
  cliff(b, 88);
  b.flat(160).fireflies(80, 30, 3);
  ledges(b, 3, -28, 120);
  moonBridge(b, 180, 170);
  b.flat(200);
  cliff(b, 80);
  b.flat(260).pool(130);
  b.goal();
  b.autoTide(84, 30, 7, 7);
  return b.build();
}
