import { bench, crumbles, den, fight, gaps, glassBridge, movers, rise, run, shaft, shrine, thorns, throne } from '../motifs';
import { L, shellId, type AreaInfo, type LevelSpec } from './common';

export const AREA_2: AreaInfo = {
  index: 2,
  name: 'Moonlit Pools',
  biome: 'pools',
  line: 'Still water, and things that sit very still in it.',
  twist: 'Precise footing: moving ledges, moonglass, and foes that wait.',
  boss: 'mooneater',
  weather: { rain: 0, wind: 0.2, fog: 0.2, moon: 1, fireflies: 0.5 },
  finale: (b, s, n) => {
    movers(b, 2);
    fight(b, n % 2 === 0 ? [['lurker', 'gloomwing'], ['shellback', 'spitter', 'gloomwing']] : [['shellback', 'skitter'], ['lurker', 'spitter', 'skitter']], 450);
    gaps(b, s, 2);
  },
};

export const LEVELS_2: LevelSpec[] = [
  L('Glasswater', 'Some lanterns here are not lanterns.', 'False lights: lurkers wait behind a glow', (b, s) => {
    run(b, 240);
    b.flat(200).foe('lurker', 90, 40);
    gaps(b, s, 2);
    b.flat(200).foe('lurker', 120, 40).foe('skitter', 50, 60);
    bench(b);
    fight(b, [['lurker', 'skitter'], ['lurker', 'gloomwing', 'skitter']]);
  }),
  L('Second Wind', 'The air remembers how to hold you.', 'A shrine returns the double jump', (b, s) => {
    thorns(b, 2);
    b.flat(160).foe('spitter', 60);
    bench(b);
    shrine(b, s, 'double');
    b.hint('double', 100, 260);
    b.step(-120, 'double').flat(120);
    b.pit(170, 170, { act: 'double' }).flat(120);
    rise(b, s);
    fight(b, [['gloomwing', 'gloomwing'], ['shellback', 'gloomwing']]);
  }),
  L('The Sliding Stair', 'Nothing here stays where you left it.', 'Moving ledges over open water', (b, s) => {
    movers(b, 3);
    b.foe('gloomwing', 60, 120);
    rise(b, s);
    b.optional((o) => o.plat(160, 60, 44).plat(90, 120, 44).shell(68, 138, false, shellId(2, 1)));
    movers(b, 4);
    bench(b);
    fight(b, [['shellback', 'spitter'], ['shellback', 'gloomwing', 'gloomwing']]);
  }),
  L('Shieldwall', 'They only show you their backs when they are angry.', 'Shellbacks: strike from above or behind', (b, s) => {
    b.flat(220).foe('shellback', 100, 90);
    gaps(b, s, 2);
    b.flat(240).foe('shellback', 150, 80).foe('spitter', 40);
    bench(b);
    fight(b, [['shellback', 'shellback'], ['shellback', 'lurker', 'skitter']], 480);
    thorns(b, 2);
  }),
  L('Moonglass Span', 'Shine, and it holds. Shine, and they come.', 'Bridges that exist only in light', (b, s) => {
    glassBridge(b, 200);
    b.foe('gloomwing', 60, 130);
    rise(b, s);
    glassBridge(b, 260);
    b.foe('gloomwing', 80, 130).foe('gloomwing', 20, 130);
    bench(b);
    fight(b, [['gloomwing', 'gloomwing', 'spitter'], ['lurker', 'shellback']]);
    glassBridge(b, 220);
  }),
  L("Thief's Roost", 'It took the brightest thing you had.', 'Guardian: the Lantern Thief holds the Lumen Pulse', (b, s) => {
    movers(b, 2);
    fight(b, [['lurker', 'gloomwing', 'gloomwing']], 430);
    shaft(b, 200);
    den(b, s, 'lanternthief', { ability: 'pulse' }, true);
    b.hint('pulse', 60, 300);
    b.bloomGate(-40, 400);
    b.flat(200);
  }),
  L('The Mirror Dark', 'The moon is behind cloud. So are they.', 'Darkness, and ledges only your glow reveals', (b, s) => {
    glassBridge(b, 180);
    b.flat(200).foe('lurker', 100, 40);
    rise(b, s, true);
    b.optional((o) => o.plat(170, 50, 44, 'moonglass').plat(96, 100, 44, 'moonglass').shell(74, 118, true, shellId(2, 2)));
    bench(b);
    fight(b, [['lurker', 'lurker'], ['gloomwing', 'shellback', 'lurker']]);
    glassBridge(b, 200);
  }, { dark: 0.28 }),
  L("Heron's Reach", 'It stands in the pool and waits for something small.', 'Optional guardian: a heron that dives from above', (b, s) => {
    crumbles(b, 3);
    rise(b, s);
    den(b, s, 'paleheron', { upgrade: 'health' }, false);
    b.secret('reach', 140, 80, 120, 90);
    movers(b, 3);
    fight(b, [['shellback', 'gloomwing', 'gloomwing']]);
  }),
  L('Ebb Run', 'The water is leaving. Do not be left.', 'Outrun the dark behind you', (b, s) => {
    gaps(b, s, 3);
    b.foe('gloomwing', 80, 120);
    thorns(b, 2);
    rise(b, s);
    movers(b, 2);
    gaps(b, s, 3);
    b.foe('skitter', 60, 80);
    crumbles(b, 3);
    rise(b, s);
    gaps(b, s, 2);
  }, { chase: 150 }, false),
  L("The Eater's Pool", 'Look up. It has the moon in its mouth.', 'Boss: the Moon-Eater', (b) => {
    movers(b, 2);
    fight(b, [['shellback', 'lurker', 'gloomwing']], 440);
    throne(b, 'mooneater');
  }, undefined, false),
];
