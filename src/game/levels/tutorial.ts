import type { LevelData } from '../core/types';
import { LevelBuilder } from './builder';
import { bench, glassBridge, shaft } from './motifs';

/**
 * The Shallows — Tutorial. The Tideborn at full strength, before the Tide King takes its light.
 * Every skill is met alone and safely, in the order a hand learns them, and the level ends with
 * one small fight that uses them together.
 */
export function tutorialLevel(): LevelData {
  const b = new LevelBuilder({
    id: 'tutorial',
    area: 0,
    index: 0,
    name: 'The Shallows',
    line: 'Before the fall, you could do all of this.',
    biome: 'shallows',
    twist: 'Every power, once',
    weather: { rain: 0, wind: 0.15, fog: 0.2, moon: 1, fireflies: 0.8 },
  });
  b.tide([[0, 58]], 3, 8);

  // Move, run, jump.
  b.flat(300).hint('move', 290, 260);
  b.hills(240, 10, 2);
  b.flat(140).hint('jump', 130, 240);
  b.step(-50).flat(120).pit(84, 150).flat(140);
  // Double jump: a ledge one leap cannot reach.
  b.flat(120).hint('double', 110, 260);
  b.step(-120, 'double').flat(160);
  // Wall cling and wall jump: a chimney.
  b.hint('wall', 0, 320);
  shaft(b, 210);
  bench(b, 200);
  b.hint('bench', 150, 150);

  // Dash and air-dash.
  b.slope(260, 150);
  b.flat(140).hint('dash', 130, 260);
  b.pit(150, 150, { act: 'dash' }).flat(160);
  b.hint('airdash', 0, 360);
  b.pit(250, 150, { act: 'double' }).flat(160);
  // Glide: a long way across, from high up.
  b.step(-120, 'double').flat(140).hint('glide', 130, 420);
  b.pit(330, 260, { act: 'glide', farDy: 110 }).flat(160);

  // Water: swim, then dive under a sunken wall. The pool is the lowest ground in the level.
  b.step(140).flat(130).step(140).flat(120);
  b.flat(100).hint('swim', 90, 300);
  b.basin(520, 190, 0.18);
  b.block(280, 26, 40, 110);
  b.hint('dive', 400, 240);
  b.via(300, -150, { swim: true }).via(220, -150, { swim: true });
  b.fireflies(120, -20, 3, 24);
  bench(b, 200);

  // The blade.
  b.flat(260).hint('attack', 250, 260);
  b.foe('skitter', 60, 70);
  b.flat(200).hint('downstrike', 190, 260);
  b.urchin(110).urchin(60);
  b.flat(200).hint('charge', 190, 260);
  b.block(40, 130, 30, 130, 'cracked');
  // Light: glow shows the way, pulse opens it — and both are seen.
  b.flat(140).hint('glow', 130, 320);
  glassBridge(b, 190);
  b.flat(180).hint('pulse', 170, 260);
  b.bloomGate(40, 130);
  b.flat(260).hint('danger', 250, 300);
  b.foe('gloomwing', 90, 130);
  // Healing: an old wound aches here, and there is a quiet place to mend it.
  b.flat(240).hint('heal', 230, 260);
  bench(b, 200);
  b.hint('pause', 190, 180);

  // One small fight with everything, and a guardian to show the health bar.
  b.flat(90);
  b.arena(440, [['skitter', 'spitter'], ['skitter', 'gloomwing']]);
  b.flat(160).hint('boss', 150, 200);
  b.arena(500, [[]], { miniboss: 'echo' });
  b.flat(320).hint('rematch', 300, 260);
  b.pool(140, 50);
  b.goal();
  return b.build();
}
