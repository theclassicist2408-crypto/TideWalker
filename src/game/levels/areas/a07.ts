import { bench, crackedWall, crumbles, den, fight, gaps, glideGap, holdout, movers, rise, rubble, shaft, thorns, throne, vent } from '../motifs';
import { L, shellId, type AreaInfo, type LevelSpec } from './common';

export const AREA_7: AreaInfo = {
  index: 7,
  name: 'Sunken Forge',
  biome: 'forge',
  line: 'The fires went out a long time ago. The heat did not.',
  twist: 'A hostile place: vents, falling slag, shockwaves along the floor.',
  boss: 'smith',
  weather: { rain: 0, wind: 0.2, fog: 0.5, moon: 0.3, fireflies: 0.4 },
  finale: (b, s, n) => {
    rubble(b, 3);
    fight(b, n % 2 === 0 ? [['emberhusk', 'spitter!'], ['emberhusk', 'sentinel']] : [['sentinel', 'broodmother'], ['emberhusk', 'emberhusk']], 520);
    gaps(b, s, 2);
  },
};

export const LEVELS_7: LevelSpec[] = [
  L('Slagfall', 'It comes off the ceiling in pieces.', 'Falling slag over a floor of spikes', (b, s) => {
    rubble(b, 4);
    thorns(b, 3, 52);
    rubble(b, 4);
    bench(b);
    fight(b, [['emberhusk', 'spitter'], ['emberhusk', 'sentinel']], 520);
    gaps(b, s, 2);
  }),
  L('Husks', 'Slow. Do not mistake that for safe.', 'Emberhusks: leap the wave when they strike the floor', (b) => {
    b.flat(300).foe('emberhusk', 140, 110);
    crumbles(b, 3);
    b.flat(320).foe('emberhusk', 220, 100).foe('spitter', 60, 40, true);
    bench(b);
    fight(b, [['emberhusk', 'emberhusk'], ['emberhusk', 'broodmother']], 540);
  }),
  L('The Bellows', 'The forge still breathes. Ride its breath.', 'A climb on steam vents with slag falling', (b) => {
    vent(b, 170, 3);
    b.stone(40, 150);
    shaft(b, 220);
    b.flat(220);
    b.optional((o) => o.plat(160, 60, 44).plat(90, 120, 44).shell(68, 138, false, shellId(7, 1)));
    vent(b, 180, 3);
    bench(b);
    rubble(b, 3);
    vent(b, 160, 2.8);
    glideGap(b);
  }),
  L('Slagback', 'It carries the old furnace on its shoulders.', 'Optional guardian: slams under a rain of slag', (b, s) => {
    movers(b, 3);
    den(b, s, 'slagback', { upgrade: 'essence' }, false);
    b.secret('slag', 140, 80, 120, 90);
    crackedWall(b);
    fight(b, [['emberhusk', 'sentinel', 'spitter']], 500);
  }),
  L('Quench', 'The sea found the forge. It is filling fast.', 'A rising tide in a hall of spikes', (b, s) => {
    thorns(b, 3, 52);
    rise(b, s, true);
    crumbles(b, 4);
    bench(b);
    shaft(b, 230);
    vent(b, 170, 3);
    rise(b, s, true);
    b.autoTide(60, 16, 4, 7, 72);
  }, { tideRush: 1.5 }, false),
  L('Hammerfall', 'Every wall here was put up to keep something in.', 'Cracked walls between you and each fight', (b, s) => {
    crackedWall(b);
    fight(b, [['sentinel', 'spitter!']], 460);
    crackedWall(b);
    bench(b);
    fight(b, [['emberhusk', 'broodmother'], ['sentinel', 'sentinel']], 520);
    crackedWall(b);
    gaps(b, s, 2);
  }),
  L('The Cold Furnace', 'No fire. No light. Only the sound of them working.', 'Darkness and shockwaves', (b, s) => {
    rubble(b, 3);
    b.flat(300).foe('emberhusk', 150, 110);
    rise(b, s, true);
    b.optional((o) => o.plat(170, 50, 44, 'moonglass').plat(96, 100, 44, 'moonglass').shell(74, 118, true, shellId(7, 2)));
    bench(b);
    fight(b, [['emberhusk', 'sentinel'], ['emberhusk', 'spitter!', 'spitter']], 520);
  }, { dark: 0.26 }),
  L('Bellows Eel', 'It lives in the pipes and comes out angry.', 'Optional guardian: beams from the pipes, then dives', (b, s) => {
    vent(b, 170, 3);
    den(b, s, 'bellowseel', { upgrade: 'lumen' }, false);
    b.secret('eel', 140, 80, 120, 90);
    rubble(b, 3);
    fight(b, [['emberhusk', 'emberhusk', 'spitter!']], 520);
  }),
  L('The Anvil', 'Stand on it and let them come.', 'Survive the forge waking up', (b, s) => {
    gaps(b, s, 2);
    holdout(b, [['sentinel', 'spitter'], ['emberhusk', 'skitter!'], ['broodmother', 'sentinel']], 30);
    rubble(b, 3);
  }),
  L("The Smith's Floor", 'It is still making something. It has decided on you.', 'Boss: the Cinder Smith', (b) => {
    rubble(b, 3);
    fight(b, [['emberhusk', 'sentinel', 'spitter!']], 480);
    throne(b, 'smith');
  }, undefined, false),
];
