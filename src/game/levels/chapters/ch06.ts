import type { LevelData } from '../../core/types';
import { LevelBuilder } from '../builder';
import { cliff, gullies, lagoon, ledges, moonBridge, rest, stones, urchins } from '../motifs';

/**
 * Chapter 6 — Hollow Undertow. Sea caves that breathe with the tide. Teaches reading the water:
 * currents reverse as the tide turns, so the same tunnel is a ride or a wall depending on when you enter.
 */
export function ch06(): LevelData {
  const b = new LevelBuilder({
    id: 'ch06',
    index: 6,
    name: 'Hollow Undertow',
    line: 'The caves breathe in. Wait. They breathe out.',
    biome: 'kelp',
    teaches: 'Turning currents',
    weather: { rain: 0, wind: 0.1, lightning: false, fog: 0.5, moon: 0.3, fireflies: 0.5 },
  });

  b.flat(240).hills(220, 10, 2).fireflies(110, 30, 4);
  b.slope(180, 36);
  // First cave: a flooded throat with a current that turns.
  b.caveStart(84);
  b.flat(120);
  lagoon(b, 440, 130, 2);
  b.current(360, -10, 280, 110, 250, 0, { mode: 'flip' });
  b.roof(80);
  b.flat(140).plant(70);
  urchins(b, 3, 120);
  b.roof(92);
  b.flat(100);
  b.caveEnd(84);
  rest(b, 240);

  gullies(b, 2, 56, 130, 170);
  b.slope(220, 50);
  b.caveStart(90);
  b.flat(100);
  lagoon(b, 520, 150, 3);
  b.fish('drifter', 420, -92, 130, -92);
  b.current(430, -14, 160, 124, 240, 0, { mode: 'flip' });
  b.current(200, -14, 150, 124, 170, 0, { safe: true });
  b.optional((o) => o.shell(260, -128, true).secret('sump', 310, -96, 100, 60));
  b.roof(86);
  b.flat(150).plant(70);
  stones(b, 260, 3, 170);
  b.roof(96);
  urchins(b, 2, 130);
  b.caveEnd(90);
  rest(b, 240);

  cliff(b, 86);
  b.flat(140).fireflies(70, 30, 3);
  moonBridge(b, 200, 180);
  b.fish('drifter', 160, -120, 40, -120);
  b.slope(240, 70);
  b.caveStart(88);
  b.flat(110);
  lagoon(b, 480, 140, 4);
  b.fish('angler', 300, -96);
  b.current(390, -12, 300, 116, 260, 0, { mode: 'flip' });
  b.roof(84);
  urchins(b, 3, 120);
  b.roof(100);
  b.flat(180);
  b.optional((o) => o.plat(130, 40, 40).shell(110, 58));
  lagoon(b, 400, 130, 2);
  b.fish('drifter', 300, -84, 100, -84);
  b.current(150, -12, 130, 110, 180, 0, { safe: true });
  b.roof(88);
  b.flat(120).plant(60);
  b.caveEnd(88);
  rest(b, 240);

  ledges(b, 2, -28, 120);
  stones(b, 280, 4, 180, true);
  cliff(b, 84);
  b.flat(260).pool(130);
  b.goal();
  b.autoTide(46, 30, 3, 8, { breathAmp: 22, breathPeriod: 34 });
  return b.build();
}
