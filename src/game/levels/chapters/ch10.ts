import type { LevelData } from '../../core/types';
import { LevelBuilder } from '../builder';
import { cliff, gullies, lagoon, ledges, moonBridge, moonStairs, rest } from '../motifs';

/**
 * Chapter 10 — Hearthreef. One last dark water, and then home. Here glow is no longer a risk:
 * every light the creature wakes joins it, and the reef opens to the brightest it has ever been.
 */
export function ch10(): LevelData {
  const b = new LevelBuilder({
    id: 'ch10',
    index: 10,
    name: 'Hearthreef',
    line: 'Shine. There is no one left to hide from.',
    biome: 'sanctuary',
    teaches: 'Home',
    weather: { rain: 0, wind: 0.15, lightning: false, fog: 0.2, moon: 1, fireflies: 1 },
  });

  b.flat(240).hills(240, 10, 2).fireflies(120, 30, 4);
  gullies(b, 1, 56, 150, 160);
  b.slope(200, 40);
  // The last dark water.
  lagoon(b, 560, 160, 5);
  b.fish('hush', 480, -110, 80, -110);
  b.current(330, -20, 180, 120, 190, 0, { safe: true });
  b.flat(160).plant(80);
  cliff(b, 88);
  rest(b, 240);

  // From here on nothing hunts. The first of the kin are waiting.
  b.flat(220).kin(120, 34).fireflies(60, 40, 4);
  moonBridge(b, 200, 170);
  b.flat(200).kin(90, 40);
  b.optional((o) => o.plat(150, 44, 40).plat(84, 86, 44).shell(62, 104));
  ledges(b, 2, -26, 130);
  b.flat(200).kin(100, 30).plant(40);
  b.slope(220, 40);
  lagoon(b, 420, 130, 3);
  b.current(330, -16, 250, 100, 170, 0, { safe: true });
  b.kin(210, -40);
  b.flat(180).kin(80, 36);
  rest(b, 240);

  moonStairs(b, 3, 30, 180);
  b.flat(240).kin(160, 40).kin(70, 30);
  b.optional((o) => o.plat(190, 42, 52, 'moonglass').plat(118, 82, 52, 'moonglass').shell(92, 100, true).secret('lamp', 140, 130, 110, 60));
  b.hills(280, 12, 2).fireflies(140, 34, 5, 40);
  b.flat(220).kin(140, 36).kin(50, 44);
  gullies(b, 2, 54, 140, 160);
  b.flat(200).kin(100, 34);
  cliff(b, 80);
  b.flat(240).kin(150, 40).kin(60, 30).pool(120, 60);
  // The heart of the reef opens only to light held steady.
  b.flat(180);
  b.bloomGate(50, 110);
  b.flat(320).pool(160, 70).fireflies(160, 40, 6, 60);
  b.goal();
  b.autoTide(50, 34, 4, 9);
  return b.build();
}
