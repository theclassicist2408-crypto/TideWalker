import type { LevelData } from '../../core/types';
import { LevelBuilder } from '../builder';
import { cliff, gullies, lagoon, ledges, moonBridge, rest, stones } from '../motifs';

/**
 * Chapter 8 — Choir of the Drowned. Flooded halls, and the Hush: a vast eel that sweeps them
 * whether you shine or not. Teaches timing and stillness — light only makes it hurry.
 */
export function ch08(): LevelData {
  const b = new LevelBuilder({
    id: 'ch08',
    index: 8,
    name: 'Choir of the Drowned',
    line: 'Something long and patient keeps these halls.',
    biome: 'ruins',
    teaches: 'The Hush',
    weather: { rain: 0, wind: 0.15, lightning: false, fog: 0.6, moon: 0.4, fireflies: 0.25 },
  });

  b.flat(240).hills(200, 8, 2);
  gullies(b, 1, 56, 140, 170);
  b.slope(200, 40);
  // First hall: the Hush passes beneath a road of stones. Watch it once before you trust the water.
  b.flat(100);
  stones(b, 420, 6, 190);
  b.fish('hush', 380, -130, 40, -130);
  b.flat(160).plant(80);
  rest(b, 240);

  b.slope(220, 50);
  b.flat(100).hint('hide', 90, 300);
  lagoon(b, 620, 160, 6);
  b.fish('hush', 540, -110, 80, -110);
  b.current(330, -20, 160, 120, 170, 0, { safe: true });
  b.flat(160).plant(80).fireflies(110, 30, 3);
  cliff(b, 88);
  b.flat(200);
  b.optional((o) => o.plat(150, 44, 40).plat(84, 86, 44).shell(62, 104));
  moonBridge(b, 220, 190);
  b.fish('drifter', 180, -130, 40, -130);
  rest(b, 240);

  gullies(b, 2, 58, 130, 170);
  b.slope(220, 50);
  b.caveStart(96);
  b.flat(100);
  lagoon(b, 560, 150, 5);
  b.fish('hush', 480, -100, 80, -100);
  b.fish('drifter', 300, -60, 140, -60);
  b.optional((o) => o.shell(280, -136, true).secret('crypt', 330, -104, 100, 60));
  b.roof(90);
  b.flat(150).plant(70);
  b.caveEnd(96);
  ledges(b, 2, -28, 120);
  stones(b, 300, 4, 180, true);
  rest(b, 240);

  b.slope(200, 40);
  lagoon(b, 520, 150, 5);
  b.fish('hush', 440, -100, 80, -100);
  b.fish('angler', 180, -104);
  b.current(390, -20, 150, 110, 180, 0, { safe: true });
  b.flat(150).plant(70);
  cliff(b, 90);
  moonBridge(b, 190, 180);
  ledges(b, 2, -28, 120);
  b.flat(260).pool(130);
  b.goal();
  b.autoTide(40, 24, 4, 8);
  return b.build();
}
