import { bench, crackedWall, crumbles, den, fight, gaps, gauntlet, glassBridge, glideGap, holdout, movers, rise, rubble, shaft, thorns, throne, vent } from '../motifs';
import { L, shellId, type AreaInfo, type LevelSpec } from './common';

export const AREA_10: AreaInfo = {
  index: 10,
  name: "Tide King's Throne",
  biome: 'throne',
  line: 'Everything he took is here. So is he.',
  twist: 'The final climb: every foe, every hazard, the hardest of each.',
  boss: 'tideking',
  weather: { rain: 0.2, wind: 0.4, lightning: true, fog: 0.3, moon: 1, fireflies: 0.8 },
  finale: (b, s, n) => {
    gaps(b, s, 2);
    fight(b, n % 2 === 0 ? [['sentinel!', 'thornbloom!'], ['emberhusk!', 'voidling', 'stormjelly!']] : [['emberhusk!', 'sentinel'], ['sentinel!', 'voidling', 'thornbloom']], 540);
    thorns(b, 3, 52);
  },
};

export const LEVELS_10: LevelSpec[] = [
  L('The Gilded Stair', 'His guards have had a long time to practise.', 'Elite companies on a climbing stair', (b, s) => {
    shaft(b, 220);
    b.foe('sentinel', 60, 110, true);
    rise(b, s, true);
    bench(b);
    fight(b, [['sentinel!', 'stormjelly!'], ['emberhusk!', 'sentinel']], 540);
    shaft(b, 230);
  }),
  L('Crownfall', 'The palace is coming down around its king.', 'Falling masonry, crumbling floors, moving ledges', (b) => {
    rubble(b, 4);
    crumbles(b, 5);
    movers(b, 4);
    bench(b);
    rubble(b, 4);
    fight(b, [['emberhusk!', 'thornbloom!'], ['sentinel!', 'sentinel']], 540);
  }),
  L('The Drowned Court', 'The tide he made is rising in his own halls.', 'A rising tide through the palace', (b, s) => {
    rise(b, s, true);
    vent(b, 180, 2.8);
    b.flat(220);
    b.optional((o) => o.plat(160, 60, 44).plat(90, 120, 44).shell(68, 138, false, shellId(10, 1)));
    shaft(b, 230);
    bench(b);
    crumbles(b, 4);
    rise(b, s, true);
    glideGap(b);
    vent(b, 170, 2.8);
    b.autoTide(60, 14, 5, 6, 76);
  }, { tideRush: 1.6 }, false),
  L('Crown Guard', 'It has never once been asked to move.', 'An optional guardian guards a tide vial', (b, s) => {
    movers(b, 3);
    den(b, s, 'crownguard', { upgrade: 'essence' }, false);
    b.secret('guard', 140, 80, 120, 90);
    crackedWall(b);
    fight(b, [['sentinel!', 'emberhusk!', 'voidling']], 540);
  }),
  L('The Stolen Moon', 'He keeps it here. It lights everything, and everyone.', 'Bright as day: you are seen from afar', (b) => {
    glassBridge(b, 260);
    b.foe('sentinel', 80, 130, true).foe('stormjelly', 20, 140, true);
    glideGap(b);
    bench(b);
    fight(b, [['sentinel!', 'sentinel!'], ['thornbloom!', 'stormjelly!', 'voidling']], 540);
  }, { glowHunted: true }),
  L('The Last Mile', 'Run. He has sent the sea after you.', 'A chase to the throne room doors', (b, s) => {
    gaps(b, s, 3);
    thorns(b, 2, 52);
    crumbles(b, 4);
    rise(b, s, true);
    movers(b, 3);
    gaps(b, s, 3);
    glideGap(b);
    crumbles(b, 3);
  }, { chase: 165 }, false),
  L('The Eclipse', 'He has put the light out. Yours too, nearly.', 'Darkness, no healing', (b, s) => {
    glassBridge(b, 240);
    b.foe('voidling', 80, 150, true);
    rise(b, s, true);
    b.optional((o) => o.plat(170, 50, 44, 'moonglass').plat(96, 100, 44, 'moonglass').shell(74, 118, true, shellId(10, 2)));
    bench(b);
    fight(b, [['voidling!', 'thornbloom'], ['emberhusk!', 'voidling']], 520);
  }, { dark: 0.26, noHeal: true }),
  L('The Herald', 'It announces him. It will announce you, too, when you fall.', 'An optional guardian guards a thicker shell', (b, s) => {
    glideGap(b);
    den(b, s, 'herald', { upgrade: 'health' }, false);
    b.secret('herald', 140, 80, 120, 90);
    rubble(b, 3);
    fight(b, [['sentinel', 'thornbloom!', 'stormjelly']], 540);
  }),
  L('The Antechamber', 'Everything he has left stands in these four rooms.', 'The last gauntlet, then a stand before the doors', (b) => {
    bench(b);
    gauntlet(b, [[['sentinel', 'emberhusk']], [['thornbloom!', 'voidling', 'stormjelly!']], [['emberhusk!', 'sentinel']]]);
    holdout(b, [['sentinel', 'voidling'], ['emberhusk', 'stormjelly!'], ['sentinel', 'thornbloom']], 28);
  }, undefined, false),
  L('The Throne', 'He drowned the moon. Take it back.', 'Final boss: the Tide King', (b, s) => {
    gaps(b, s, 2);
    fight(b, [['sentinel!', 'thornbloom']], 520);
    throne(b, 'tideking');
  }, undefined, false),
];
