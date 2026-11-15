import type { LevelData } from '../../core/types';
import { LevelBuilder } from '../builder';
import { cliff, gullies, haunt, lagoon, ledges, moonBridge, rest, stones } from '../motifs';

/**
 * Chapter 5 — The Green Cathedral. A drowned kelp forest. Teaches distrust of easy light:
 * anglers hang false lamps in the dark. At its heart, the creature learns it is not the only light.
 */
export function ch05(): LevelData {
  const b = new LevelBuilder({
    id: 'ch05',
    index: 5,
    name: 'The Green Cathedral',
    line: 'Not every light is a friend. One of them is.',
    biome: 'kelp',
    teaches: 'False light',
    weather: { rain: 0, wind: 0.15, lightning: false, fog: 0.4, moon: 0.6, fireflies: 0.7 },
  });

  b.flat(240).hills(240, 10, 2).fireflies(120, 30, 4);
  b.slope(200, 40);
  lagoon(b, 440, 150, 4);
  b.current(350, -24, 260, 110, 170, 0, { safe: true });
  b.flat(160).plant(80);
  // The first false lamp: it looks like rest.
  b.slope(160, 30);
  haunt(b, 400, 140, 'angler', 2);
  b.flat(160).plant(60).fireflies(110, 30, 3);
  rest(b, 240);

  gullies(b, 2, 56, 130, 170);
  b.slope(220, 50);
  lagoon(b, 560, 170, 5);
  b.fish('angler', 420, -120);
  b.fish('drifter', 300, -90, 110, -90);
  b.optional((o) => o.shell(420, -150, true).secret('deep', 470, -110, 100, 60));
  b.flat(160).plant(80);
  cliff(b, 86);
  stones(b, 300, 4, 190);
  b.fish('drifter', 250, -130, 60, -130);
  rest(b, 260);

  // The heart of the forest: another small light, woken by yours.
  b.slope(240, 60);
  b.flat(260).kelp(230, 60, 80).kelp(60, 50, 70);
  b.kin(90, 40, true);
  b.pool(150, 54);
  b.flat(160).fireflies(80, 36, 5, 40).plant(70);
  lagoon(b, 480, 150, 5);
  b.fish('angler', 330, -110);
  b.fish('angler', 150, -100);
  b.current(240, -30, 200, 110, 190, 0, { safe: true });
  b.flat(160).plant(80);
  ledges(b, 2, -28, 120);
  moonBridge(b, 210, 190);
  b.fish('drifter', 170, -130, 40, -130);
  b.flat(200);
  b.optional((o) => o.plat(150, 44, 40).plat(84, 86, 44).shell(62, 104));
  rest(b, 240);

  b.slope(220, 46);
  haunt(b, 460, 150, 'drifter', 5);
  b.fish('angler', 120, -100);
  b.flat(150).plant(70);
  cliff(b, 90);
  gullies(b, 2, 58, 130, 170);
  b.flat(260).pool(130);
  b.goal();
  b.autoTide(34, 22, 4, 9);
  return b.build();
}
