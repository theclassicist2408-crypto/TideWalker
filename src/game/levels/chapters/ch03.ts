import type { LevelData } from '../../core/types';
import { LevelBuilder } from '../builder';
import { cliff, gullies, haunt, lagoon, ledges, moonBridge, rest, stones } from '../motifs';

/**
 * Chapter 3 — Quiet Mirrors. Moonlit tidal pools, and the first shadow-fish.
 * Teaches that light is seen: go dark, hide in kelp, or answer with a Lumen Pulse.
 */
export function ch03(): LevelData {
  const b = new LevelBuilder({
    id: 'ch03',
    index: 3,
    name: 'Quiet Mirrors',
    line: 'Still water keeps what it sees.',
    biome: 'pools',
    teaches: 'Shadow',
    weather: { rain: 0, wind: 0.2, lightning: false, fog: 0.2, moon: 1, fireflies: 0.5 },
  });

  b.flat(240).hills(280, 12, 2).fireflies(140, 34, 4);
  gullies(b, 1, 56, 150, 150);
  b.slope(180, 30);
  // First mirror: a dry road of stones above, something slow beneath.
  b.flat(100);
  stones(b, 320, 4, 160);
  b.fish('drifter', 270, -112, 60, -112);
  b.flat(180).plant(90);
  b.flat(120).hint('hide', 110, 420);
  haunt(b, 420, 120, 'drifter', 3);
  rest(b, 240);

  ledges(b, 2, -26, 120);
  moonBridge(b, 200, 170);
  b.fish('drifter', 160, -110, 40, -110);
  b.flat(160).plant(80);
  b.slope(240, 50);
  b.flat(110).hint('pulse', 100, 460);
  haunt(b, 460, 130, 'drifter', 1);
  b.optional((o) => o.shell(230, -108, true));
  b.flat(170).plant(70).fireflies(110, 30, 3);
  cliff(b, 90);
  rest(b, 240);

  gullies(b, 2, 58, 130, 150);
  b.slope(220, 40);
  lagoon(b, 520, 140, 4);
  b.fish('drifter', 430, -84, 250, -84);
  b.fish('drifter', 250, -100, 90, -100);
  b.current(330, -20, 180, 100, 180, 0, { safe: true });
  b.flat(160).plant(80);
  cliff(b, 88);
  b.flat(200);
  b.optional((o) => o.plat(150, 44, 40).plat(84, 86, 44).shell(62, 104).secret('ledge', 110, 130, 100, 60));
  stones(b, 300, 4, 170, true);
  b.fish('drifter', 250, -118, 50, -118);
  rest(b, 240);

  ledges(b, 2, -28, 120);
  b.slope(200, 30);
  haunt(b, 400, 120, 'drifter', 3);
  b.flat(150).plant(70);
  cliff(b, 84);
  moonBridge(b, 190, 170);
  b.flat(260).pool(130);
  b.goal();
  b.autoTide(64, 30, 4, 8);
  return b.build();
}
