import { bench, crumbles, den, fight, gaps, ladder, rise, run, shaft, shrine, thorns, throne } from '../motifs';
import { shellId, type AreaInfo, type LevelSpec } from './common';

export const AREA_1: AreaInfo = {
  index: 1,
  name: 'The Shallows',
  biome: 'shallows',
  line: 'What the storm left, and what crawled in after.',
  twist: 'Stripped of everything: only the blade and your legs.',
  boss: 'warden',
  weather: { rain: 0.35, wind: 0.4, fog: 0.3, moon: 0.6, fireflies: 0.3 },
  finale: (b, s, n) => {
    gaps(b, s, 2);
    fight(b, n % 2 === 0 ? [['skitter', 'gloomwing'], ['spitter', 'skitter', 'skitter']] : [['spitter', 'skitter'], ['gloomwing', 'gloomwing', 'skitter']], 440);
    thorns(b, 2);
  },
};

export const LEVELS_1: LevelSpec[] = [
  {
    name: 'Wreckwash',
    line: 'Your light is gone. Your blade is not.',
    twist: 'First ambush: the gates close behind you',
    build: (b, s) => {
      run(b, 260);
      b.foe('skitter', 60, 90);
      gaps(b, s, 2);
      b.flat(160).foe('skitter', 80, 70);
      ladder(b, 96);
      bench(b);
      fight(b, [['skitter', 'skitter'], ['skitter', 'spitter']]);
      thorns(b, 2);
    },
  },
  {
    name: 'Brine Steps',
    line: 'Something of yours is waiting on the far side.',
    twist: 'A shrine returns the dash; the way out needs it',
    build: (b, s) => {
      gaps(b, s, 2);
      b.flat(160).foe('spitter', 60);
      thorns(b, 2);
      bench(b);
      shrine(b, s, 'dash');
      b.hint('dash', 100, 240);
      b.pit(150, 160, { act: 'dash' }).flat(140);
      fight(b, [['skitter', 'spitter'], ['skitter', 'skitter', 'spitter']]);
      gaps(b, s, 3);
    },
  },
  {
    name: 'Tide Race',
    line: 'The sea is faster than it looks.',
    twist: 'The tide rises fast: climb or swim',
    rules: { tideRush: 1.6 },
    finale: false,
    build: (b, s) => {
      gaps(b, s, 2);
      rise(b, s);
      b.flat(140).foe('skitter', 70, 60);
      rise(b, s);
      b.optional((o) => o.plat(150, 50, 40).plat(84, 96, 44).shell(62, 114, false, shellId(1, 1)));
      bench(b);
      ladder(b, 110);
      // No locked fight here: with the sea coming in, a closed gate would be a trap.
      b.flat(260).foe('gloomwing', 150, 120).foe('skitter', 70, 60);
      rise(b, s);
      gaps(b, s, 2);
      ladder(b, 100);
      b.autoTide(40, 14, 5, 6, 100);
    },
  },
  {
    name: 'Crumbling Causeway',
    line: 'Do not stand where you land.',
    twist: 'Ledges fall away underfoot',
    build: (b, s) => {
      b.foe('spitter', 40);
      crumbles(b, 3);
      thorns(b, 2);
      b.foe('gloomwing', 100, 120);
      crumbles(b, 4);
      bench(b);
      fight(b, [['spitter', 'spitter'], ['gloomwing', 'gloomwing', 'skitter']]);
      crumbles(b, 5);
      gaps(b, s, 2);
    },
  },
  {
    name: "Hound's Hollow",
    line: 'It has your grip between its teeth.',
    twist: 'Guardian: the Brine Hound holds the wall-cling',
    build: (b, s) => {
      gaps(b, s, 2);
      fight(b, [['skitter', 'skitter', 'spitter']], 420);
      thorns(b, 2);
      den(b, s, 'brinehound', { ability: 'wall' }, true);
      b.hint('wall', 60, 300);
      shaft(b, 190);
      run(b, 200);
    },
  },
  {
    name: 'The Chimney',
    line: 'Up is the only way that is not drowned.',
    twist: 'A vertical climb, wall to wall',
    build: (b, s) => {
      shaft(b, 200);
      b.foe('spitter', 50);
      rise(b, s, true);
      b.foe('gloomwing', 60, 120);
      shaft(b, 230);
      bench(b);
      fight(b, [['gloomwing', 'gloomwing'], ['skitter', 'spitter', 'gloomwing']], 440);
      rise(b, s, true);
      thorns(b, 2);
      shaft(b, 210);
    },
  },
  {
    name: 'Lights Out',
    line: 'You never noticed how much you used to shine.',
    twist: 'Darkness: you see only what is close',
    rules: { dark: 0.3 },
    build: (b, s) => {
      gaps(b, s, 2);
      b.flat(160).foe('skitter', 80, 70);
      thorns(b, 3);
      rise(b, s, true);
      b.optional((o) => o.plat(160, 46, 44, 'moonglass').plat(86, 90, 44, 'moonglass').shell(64, 108, true, shellId(1, 2)));
      bench(b);
      fight(b, [['skitter', 'gloomwing'], ['spitter', 'skitter', 'gloomwing']]);
      crumbles(b, 3);
      gaps(b, s, 2);
    },
  },
  {
    name: "Clatterjaw's Shelf",
    line: 'Old, slow, and sitting on something bright.',
    twist: 'An optional guardian, and a prize for beating it',
    build: (b, s) => {
      thorns(b, 2);
      shaft(b, 180);
      b.foe('spitter', 60);
      gaps(b, s, 3);
      den(b, s, 'clatterjaw', { upgrade: 'essence' }, false);
      b.secret('shelf', 140, 80, 120, 90);
      fight(b, [['skitter', 'skitter', 'gloomwing'], ['spitter', 'spitter', 'skitter']]);
      rise(b, s, true);
    },
  },
  {
    name: 'Before the Gate',
    line: 'The pool is closing. Run.',
    twist: 'Against the clock',
    rules: { timeLimit: 110 },
    build: (b, s) => {
      gaps(b, s, 3);
      thorns(b, 2);
      b.foe('skitter', 60, 80);
      shaft(b, 170);
      crumbles(b, 3);
      bench(b);
      gaps(b, s, 3);
      b.foe('gloomwing', 80, 120);
      rise(b, s, true);
      thorns(b, 3);
    },
  },
  {
    name: "The Warden's Pool",
    line: 'It kept the shallows before the moon went out.',
    twist: 'Boss: the Drowned Warden',
    finale: false,
    build: (b, s) => {
      gaps(b, s, 2);
      fight(b, [['skitter', 'spitter', 'gloomwing']], 420);
      shaft(b, 180);
      throne(b, 'warden');
    },
  },
];
