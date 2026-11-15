import type { LevelData } from '../../core/types';
import { LevelBuilder } from '../builder';
import { bloomDoor, cliff, geyserLift, gullies, haunt, lagoon, ledges, moonBridge, moonStairs, rest, stones, urchins } from '../motifs';

/**
 * Chapter 9 — Nightfall Surge. The storm comes back and the whole sea with it.
 * Nothing new is taught but the last hazard, whirlpools; everything learned is asked for at once.
 */
export function ch09(): LevelData {
  const b = new LevelBuilder({
    id: 'ch09',
    index: 9,
    name: 'Nightfall Surge',
    line: 'Run. Shine when you must. Do not look back.',
    biome: 'storm',
    teaches: 'Whirlpools',
    weather: { rain: 1, wind: 1, lightning: true, fog: 0.5, moon: 0.2, fireflies: 0.05 },
  });

  b.flat(240);
  gullies(b, 2, 58, 130, 150);
  ledges(b, 2, -28, 120);
  stones(b, 300, 4, 170, true);
  b.fish('drifter', 250, -120, 50, -120);
  b.flat(120);
  cliff(b, 90);
  rest(b, 220);

  // The first whirlpool: water that wants to keep you.
  b.slope(180, 30);
  lagoon(b, 460, 150, 2);
  b.current(320, -10, 180, 150, 420, 0, { radial: true });
  b.current(140, -16, 130, 110, 200, 0, { safe: true });
  b.flat(140).plant(70);
  geyserLift(b, 130, 3.4);
  b.flat(140);
  moonBridge(b, 220, 190);
  b.fish('drifter', 180, -130, 40, -130);
  urchins(b, 2, 120);
  cliff(b, 92);
  b.flat(200);
  b.optional((o) => o.plat(150, 44, 40, 'crumble').plat(84, 86, 44).shell(62, 104));
  rest(b, 220);

  moonStairs(b, 4, 32, 200);
  b.flat(120);
  haunt(b, 440, 140, 'hush', 4);
  b.current(250, -16, 150, 120, -320, 0, { mode: 'beat', period: 5, duty: 0.5 });
  b.flat(140).plant(70);
  cliff(b, 90);
  bloomDoor(b);
  stones(b, 320, 4, 190, true);
  b.fish('drifter', 260, -130, 60, -130);
  geyserLift(b, 140, 3.4);
  b.flat(220);
  b.optional((o) => o.plat(160, 42, 52, 'moonglass').plat(84, 82, 52, 'moonglass').shell(58, 100, true).secret('eye', 110, 130, 110, 60));
  rest(b, 220);

  // Last climb, the sea right behind.
  ledges(b, 3, -30, 110);
  moonBridge(b, 200, 190);
  cliff(b, 92);
  gullies(b, 2, 60, 120, 170);
  moonStairs(b, 3, 32, 200);
  cliff(b, 88);
  b.flat(260).pool(130);
  b.goal();
  b.autoTide(66, 20, 9, 5.5, { pace: 74 });
  return b.build();
}
