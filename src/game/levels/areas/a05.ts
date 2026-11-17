import { bench, crumbles, den, fight, gaps, glideGap, holdout, movers, rise, shaft, thorns, throne, vent } from '../motifs';
import { L, shellId, type AreaInfo, type LevelSpec } from './common';

export const AREA_5: AreaInfo = {
  index: 5,
  name: 'Storm Reach',
  biome: 'storm',
  line: 'Above the water at last, and the sky wants you back in it.',
  twist: 'Speed: wind in the air, faster foes, wider arenas.',
  boss: 'squall',
  weather: { rain: 1, wind: 1, lightning: true, fog: 0.4, moon: 0.2, fireflies: 0.05 },
  finale: (b, s, n) => {
    gaps(b, s, 2);
    fight(b, n % 2 === 0 ? [['stormjelly', 'stormjelly'], ['sentinel', 'gloomwing', 'stormjelly']] : [['sentinel', 'stormjelly'], ['skitter!', 'gloomwing', 'stormjelly']], 520);
    thorns(b, 2);
  },
};

export const LEVELS_5: LevelSpec[] = [
  L('Squall Line', 'Every leap lands shorter than you meant.', 'A headwind pushes you back in the air', (b, s) => {
    gaps(b, s, 3);
    b.foe('stormjelly', 80, 130);
    rise(b, s, true);
    gaps(b, s, 2);
    bench(b);
    fight(b, [['stormjelly', 'skitter!'], ['stormjelly', 'stormjelly', 'gloomwing']], 500);
  }, { wind: -260 }),
  L('Charged Air', 'It hums before it strikes. Listen.', 'Stormjellies: rings of lightning to step out of', (b) => {
    b.flat(260).foe('stormjelly', 130, 150);
    movers(b, 3);
    b.flat(260).foe('stormjelly', 180, 150).foe('stormjelly', 60, 150);
    bench(b);
    fight(b, [['stormjelly', 'stormjelly'], ['stormjelly', 'stormjelly', 'spitter']], 500);
  }),
  L('Galewing', 'It owns the air here. Borrow some.', 'An optional guardian guards a wider pulse', (b, s) => {
    glideGap(b);
    den(b, s, 'galewing', { upgrade: 'pulse' }, false);
    b.secret('gale', 140, 80, 120, 90);
    b.flat(220);
    b.optional((o) => o.plat(160, 60, 44).plat(90, 120, 44).shell(68, 138, false, shellId(5, 1)));
    crumbles(b, 4);
    fight(b, [['sentinel', 'stormjelly']]);
  }),
  L('The Watch', 'They throw, and then they come.', 'Sentinels: spear, then charge', (b, s) => {
    b.flat(260).foe('sentinel', 110, 130);
    gaps(b, s, 2);
    shaft(b, 210);
    bench(b);
    fight(b, [['sentinel', 'gloomwing'], ['sentinel', 'sentinel']], 540);
  }),
  L('Thunderhead', 'Fast. Faster. The cloud is closing.', 'Against the clock, in the wind', (b, s) => {
    gaps(b, s, 3);
    vent(b, 150);
    crumbles(b, 3);
    b.foe('stormjelly', 80, 130);
    bench(b);
    glideGap(b);
    movers(b, 3);
    rise(b, s, true);
  }, { timeLimit: 130, wind: -160 }),
  L('Eye of the Storm', 'Hold this ground until it passes.', 'Survive the waves until the storm breaks', (b, s) => {
    gaps(b, s, 2);
    holdout(b, [['skitter!', 'stormjelly'], ['gloomwing', 'gloomwing', 'stormjelly'], ['sentinel', 'skitter']], 28);
    rise(b, s, true);
  }),
  L('Thunder Calf', 'Young, loud, and it does not know its own strength.', 'An optional guardian guards a tide vial', (b, s) => {
    movers(b, 3);
    den(b, s, 'thundercalf', { upgrade: 'essence' }, false);
    b.secret('calf', 140, 80, 120, 90);
    b.flat(220);
    b.optional((o) => o.plat(170, 50, 44, 'moonglass').plat(96, 100, 44, 'moonglass').shell(74, 118, true, shellId(5, 2)));
    fight(b, [['sentinel', 'stormjelly', 'gloomwing']], 500);
  }),
  L('Whiteout', 'You hear them long before you see them.', 'Fog hides every foe until it is close', (b, s) => {
    b.flat(260).foe('skitter', 140, 100, true).foe('stormjelly', 60, 130);
    gaps(b, s, 2);
    bench(b);
    fight(b, [['sentinel', 'stormjelly'], ['skitter!', 'skitter!', 'gloomwing']], 500);
    crumbles(b, 3);
  }, { fog: true }),
  L('The Updraft', 'The storm will carry you if you let it.', 'A climb on vents and gliding leaps', (b) => {
    vent(b, 170);
    shaft(b, 220);
    glideGap(b);
    bench(b);
    vent(b, 180);
    b.foe('stormjelly', 40, 130);
    shaft(b, 230);
    glideGap(b);
  }, { gravity: 0.82 }),
  L('The Squall Throne', 'She is the weather.', 'Boss: Squallmother', (b) => {
    glideGap(b);
    fight(b, [['sentinel', 'stormjelly', 'stormjelly']], 480);
    throne(b, 'squall');
  }, undefined, false),
];
