import { bench, bloomDoor, crackedWall, crumbles, den, fight, gaps, gauntlet, glideGap, rise, rubble, shaft, shrine, throne, vent } from '../motifs';
import { L, shellId, type AreaInfo, type LevelSpec } from './common';

export const AREA_4: AreaInfo = {
  index: 4,
  name: 'Drowned Ruins',
  biome: 'ruins',
  line: 'Someone built this for lights like you. Something else moved in.',
  twist: 'Mixed companies: broods, shields and wings fighting together.',
  boss: 'choir',
  weather: { rain: 0, wind: 0.25, fog: 0.45, moon: 0.7, fireflies: 0.3 },
  finale: (b, s, n) => {
    rubble(b, 2);
    fight(b, n % 2 === 0 ? [['broodmother', 'gloomwing'], ['shellback', 'burrower', 'gloomwing']] : [['shellback', 'gloomwing', 'gloomwing'], ['broodmother', 'shellback']], 480);
    gaps(b, s, 2);
  },
};

export const LEVELS_4: LevelSpec[] = [
  L('The Falling City', 'Do not stand under anything.', 'Stones fall as you pass beneath', (b, s) => {
    rubble(b, 3);
    b.foe('shellback', 80, 90);
    gaps(b, s, 2);
    rubble(b, 4);
    bench(b);
    fight(b, [['shellback', 'gloomwing'], ['burrower', 'shellback', 'gloomwing']]);
  }),
  L('The Scribe\'s Chisel', 'A light held long enough becomes a blade.', 'A shrine returns the charged strike; cracked walls bar the way', (b, s) => {
    crumbles(b, 3);
    bench(b);
    shrine(b, s, 'charge');
    b.hint('charge', 100, 260);
    crackedWall(b);
    fight(b, [['shellback', 'shellback'], ['shellback', 'broodmother']]);
    crackedWall(b);
  }),
  L('Brood Hall', 'Kill the mother first. Or do not, and see.', 'Broodmothers: the room fills if you wait', (b, s) => {
    b.flat(260).foe('broodmother', 100, 100);
    rise(b, s, true);
    b.optional((o) => o.plat(160, 60, 44).plat(90, 120, 44).shell(68, 138, false, shellId(4, 1)));
    bench(b);
    fight(b, [['broodmother', 'spitter'], ['broodmother', 'broodmother']], 500);
    rubble(b, 2);
  }),
  L('The Long Stair', 'Up, with the sea a step behind.', 'A climb against a rising tide', (b, s) => {
    shaft(b, 210);
    rise(b, s, true);
    vent(b, 150);
    b.foe('gloomwing', 60, 120);
    shaft(b, 230);
    bench(b);
    rise(b, s, true);
    shaft(b, 200);
    vent(b, 160);
    b.autoTide(60, 16, 4, 7, 70);
  }, { tideRush: 1.4 }, false),
  L('Light the Doors', 'They open for you. Everything else hears them open.', 'Bloom doors, and hunters drawn by glow', (b, s) => {
    bloomDoor(b);
    b.flat(200).foe('gloomwing', 100, 140).foe('gloomwing', 40, 140);
    bloomDoor(b);
    bench(b);
    fight(b, [['gloomwing', 'gloomwing', 'gloomwing'], ['shellback', 'broodmother']]);
    bloomDoor(b);
    gaps(b, s, 2);
  }),
  L('The Gate Scribe', 'It is still writing the names of the drowned.', 'Guardian: the Gate Scribe holds the glide', (b, s) => {
    crackedWall(b);
    fight(b, [['shellback', 'burrower', 'gloomwing']], 440);
    den(b, s, 'gatescribe', { ability: 'glide' }, true);
    b.hint('glide', 60, 300);
    glideGap(b);
  }),
  L('The Unlit Nave', 'You will have to carry your own.', 'Darkness, with a shell for those who glow', (b, s) => {
    rubble(b, 3);
    rise(b, s, true);
    b.optional((o) => o.plat(170, 50, 44, 'moonglass').plat(96, 100, 44, 'moonglass').shell(74, 118, true, shellId(4, 2)));
    bench(b);
    fight(b, [['burrower', 'burrower'], ['shellback', 'gloomwing', 'burrower']]);
    crumbles(b, 3);
  }, { dark: 0.28 }),
  L('The Bell Diver', 'It rings when it lands.', 'Optional guardian: ground slams and rising spikes', (b, s) => {
    glideGap(b);
    den(b, s, 'belldiver', { upgrade: 'health' }, false);
    b.secret('bell', 140, 80, 120, 90);
    crackedWall(b);
    fight(b, [['broodmother', 'shellback', 'gloomwing']]);
  }),
  L('The Procession', 'Three rooms. No lantern between them.', 'A gauntlet: three fights without rest', (b) => {
    bench(b);
    gauntlet(b, [[['shellback', 'gloomwing']], [['broodmother', 'burrower']], [['shellback', 'shellback', 'gloomwing']]]);
  }),
  L('The Choir Loft', 'It sings with every mouth it ever drowned.', 'Boss: the Abyss Choir', (b) => {
    glideGap(b);
    fight(b, [['broodmother', 'shellback', 'gloomwing']], 440);
    throne(b, 'choir');
  }, undefined, false),
];
