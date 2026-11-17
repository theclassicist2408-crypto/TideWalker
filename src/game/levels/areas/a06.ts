import { bench, bloomDoor, crackedWall, crumbles, den, fight, gaps, gauntlet, glassBridge, glideGap, movers, rise, shaft, thorns, throne } from '../motifs';
import { L, shellId, type AreaInfo, type LevelSpec } from './common';

export const AREA_6: AreaInfo = {
  index: 6,
  name: 'Coral Cathedral',
  biome: 'coral',
  line: 'Beautiful, and every surface has a point on it.',
  twist: 'Elites: stronger kin of foes you know, in rooms full of thorns.',
  boss: 'pontiff',
  weather: { rain: 0, wind: 0.15, fog: 0.3, moon: 0.8, fireflies: 0.6 },
  finale: (b, _s, n) => {
    thorns(b, 3, 52);
    fight(b, n % 2 === 0 ? [['thornbloom', 'shellback!'], ['thornbloom', 'thornbloom', 'stormjelly']] : [['shellback!', 'lurker'], ['thornbloom', 'stormjelly', 'lurker!']], 500);
  },
};

export const LEVELS_6: LevelSpec[] = [
  L('Thorn Garden', 'Closed, they cannot be hurt. Wait for the bloom.', 'Thornblooms: armoured until they open to fire', (b, s) => {
    b.flat(260).foe('thornbloom', 110);
    thorns(b, 3, 52);
    b.flat(260).foe('thornbloom', 180).foe('thornbloom', 60);
    bench(b);
    fight(b, [['thornbloom', 'thornbloom'], ['thornbloom', 'shellback', 'stormjelly']], 500);
    gaps(b, s, 2);
  }),
  L('The Narrow Way', 'One mistake wide.', 'Spikes above and below a crumbling path', (b) => {
    crumbles(b, 4);
    thorns(b, 4, 56);
    crumbles(b, 5);
    bench(b);
    b.caveStart(110).flat(300);
    b.spikes(220, 46).spikes(100, 46);
    b.caveEnd(110);
    fight(b, [['stormjelly', 'lurker!'], ['thornbloom', 'shellback!']]);
  }),
  L('Rose Window', 'The light through it is the only safe thing here.', 'Moonglass bridges under fire', (b, s) => {
    glassBridge(b, 240);
    b.foe('thornbloom', 60);
    rise(b, s, true);
    b.optional((o) => o.plat(160, 60, 44).plat(90, 120, 44).shell(68, 138, false, shellId(6, 1)));
    glassBridge(b, 280);
    bench(b);
    fight(b, [['thornbloom', 'stormjelly', 'stormjelly'], ['shellback!', 'thornbloom']], 500);
  }),
  L('Choir Urchin', 'It sings one note, and the floor answers.', 'An optional guardian guards a deeper light', (b, s) => {
    movers(b, 3);
    den(b, s, 'choirurchin', { upgrade: 'lumen' }, false);
    b.secret('choir', 140, 80, 120, 90);
    crackedWall(b);
    fight(b, [['shellback!', 'thornbloom', 'lurker']], 480);
  }),
  L('The Elect', 'One of them, and it is enough.', 'A duel with an elite sentinel', (b) => {
    glideGap(b);
    bench(b);
    fight(b, [['sentinel!']], 520);
    thorns(b, 3, 52);
    fight(b, [['sentinel!', 'thornbloom']], 520);
  }),
  L('Vespers', 'Nothing here will let you rest.', 'No healing: the whole level on one life', (b) => {
    crumbles(b, 3);
    b.foe('stormjelly', 60, 130);
    shaft(b, 210);
    bench(b);
    fight(b, [['thornbloom', 'lurker'], ['shellback', 'stormjelly']]);
    thorns(b, 3, 52);
  }, { noHeal: true }),
  L('The Crypt Below', 'Dark, and the walls are listening for light.', 'Darkness where glowing draws the hunters', (b, s) => {
    bloomDoor(b);
    b.flat(260).foe('lurker', 140, 40, true).foe('lurker', 60, 40);
    rise(b, s, true);
    b.optional((o) => o.plat(170, 50, 44, 'moonglass').plat(96, 100, 44, 'moonglass').shell(74, 118, true, shellId(6, 2)));
    bench(b);
    fight(b, [['lurker!', 'stormjelly'], ['thornbloom', 'lurker', 'lurker']]);
  }, { dark: 0.26, glowHunted: true }),
  L('Rosary Crab', 'It counts its beads on your bones.', 'An optional guardian guards a thicker shell', (b, s) => {
    thorns(b, 3, 52);
    den(b, s, 'rosarycrab', { upgrade: 'health' }, false);
    b.secret('rosary', 140, 80, 120, 90);
    glideGap(b);
    fight(b, [['thornbloom', 'shellback!', 'stormjelly']], 500);
  }),
  L('High Mass', 'Four rooms of them. Then the doors.', 'A gauntlet of elite companies', (b) => {
    bench(b);
    gauntlet(b, [[['shellback!', 'thornbloom']], [['lurker!', 'stormjelly', 'stormjelly']], [['sentinel', 'thornbloom']], [['shellback!', 'shellback']]]);
  }),
  L('The Reef Altar', 'It has been kneeling so long it grew into the floor.', 'Boss: the Reef Pontiff', (b) => {
    thorns(b, 3, 52);
    fight(b, [['thornbloom', 'shellback!', 'stormjelly']], 460);
    throne(b, 'pontiff');
  }, undefined, false),
];
