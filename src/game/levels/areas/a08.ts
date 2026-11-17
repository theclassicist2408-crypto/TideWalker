import { bench, bloomDoor, crumbles, den, fight, gaps, glassBridge, glideGap, holdout, movers, pond, rise, shaft, sump, thorns, throne, tunnel } from '../motifs';
import { L, shellId, type AreaInfo, type LevelSpec } from './common';

export const AREA_8: AreaInfo = {
  index: 8,
  name: 'Abyssal Gardens',
  biome: 'gardens',
  line: 'Everything here grows toward you.',
  twist: 'Ambush: quiet ground that erupts, swarms, and foes on all sides.',
  boss: 'rootmother',
  weather: { rain: 0, wind: 0.1, fog: 0.4, moon: 0.5, fireflies: 0.9 },
  finale: (b, s, n) => {
    b.flat(320).foe('burrower', 220, 110, true).foe('thornbloom', 90);
    fight(b, n % 2 === 0 ? [['broodmother!', 'thornbloom'], ['burrower!', 'burrower', 'thornbloom']] : [['thornbloom', 'burrower!', 'voidling'], ['broodmother!', 'burrower']], 520);
    gaps(b, s, 2);
  },
};

export const LEVELS_8: LevelSpec[] = [
  L('Soft Ground', 'It looks like a meadow.', 'An ambush: the quiet path erupts', (b, s) => {
    b.flat(360).foe('burrower', 260, 110).foe('burrower', 140, 110, true).foe('burrower', 40, 110);
    gaps(b, s, 2);
    bench(b);
    fight(b, [['burrower', 'burrower', 'burrower'], ['burrower!', 'thornbloom', 'thornbloom']], 520);
  }),
  L('Swarm', 'She is a door. Close her.', 'Elite broodmothers flood the room', (b) => {
    b.flat(300).foe('broodmother', 120, 120, true);
    crumbles(b, 3);
    bench(b);
    fight(b, [['broodmother!', 'thornbloom'], ['broodmother!', 'broodmother']], 540);
    thorns(b, 3, 52);
  }),
  L('The Hanging Beds', 'Flowers above, water below, teeth in both.', 'Fights above and beneath the water', (b, s) => {
    sump(b, 480, 200, 3);
    rise(b, s, true);
    b.optional((o) => o.plat(160, 60, 44).plat(90, 120, 44).shell(68, 138, false, shellId(8, 1)));
    bench(b);
    fight(b, [['thornbloom', 'stormjelly'], ['burrower!', 'thornbloom', 'stormjelly']], 500);
    sump(b, 460, 200, 3);
  }),
  L('Sporeling Queen', 'She never fights alone.', 'Optional guardian: she summons a swarm of mites', (b, s) => {
    movers(b, 3);
    den(b, s, 'sporequeen', { upgrade: 'pulse' }, false);
    b.secret('spore', 140, 80, 120, 90);
    glideGap(b);
    fight(b, [['broodmother!', 'burrower', 'thornbloom']], 520);
  }),
  L('First Shadow', 'Something stepped out from behind you.', 'Voidlings: unseen until they strike', (b) => {
    b.flat(300).foe('voidling', 150, 140);
    glassBridge(b, 220);
    b.flat(300).foe('voidling', 200, 140).foe('voidling', 80, 140);
    bench(b);
    fight(b, [['voidling', 'voidling'], ['voidling', 'thornbloom', 'burrower']], 500);
  }),
  L('Thornway', 'The path is the trap.', 'Urchin tunnels with burrowers beneath', (b, s) => {
    tunnel(b, 400, 4);
    b.flat(260).foe('burrower', 130, 110, true);
    bench(b);
    tunnel(b, 440, 4);
    fight(b, [['burrower!', 'thornbloom'], ['broodmother', 'burrower', 'burrower']]);
    gaps(b, s, 2);
  }),
  L('Nightbloom', 'They open in the dark. So do the things that eat them.', 'Darkness, bloom doors, and hunters drawn to glow', (b, s) => {
    bloomDoor(b);
    b.flat(280).foe('voidling', 140, 140).foe('thornbloom', 50);
    rise(b, s, true);
    b.optional((o) => o.plat(170, 50, 44, 'moonglass').plat(96, 100, 44, 'moonglass').shell(74, 118, true, shellId(8, 2)));
    bench(b);
    fight(b, [['voidling', 'thornbloom'], ['voidling', 'voidling', 'burrower']]);
    bloomDoor(b);
  }, { dark: 0.26, glowHunted: true }),
  L('Thorn Knight', 'It was a gardener once.', 'Optional guardian: a charging knight that blinks behind you', (b, s) => {
    pond(b, 420, 170, 2);
    den(b, s, 'thornknight', { upgrade: 'health' }, false);
    b.secret('knight', 140, 80, 120, 90);
    shaft(b, 220);
    fight(b, [['thornbloom', 'burrower!', 'voidling']], 500);
  }),
  L('Overgrowth', 'Hold the clearing. Everything is coming.', 'Survive an ambush from every side', (b, s) => {
    gaps(b, s, 2);
    holdout(b, [['burrower', 'mite', 'mite'], ['thornbloom', 'voidling'], ['burrower', 'mite']], 26);
    thorns(b, 3, 52);
  }),
  L('The Root', 'All of it is her.', 'Boss: the Rootmother', (b) => {
    tunnel(b, 360, 3);
    fight(b, [['burrower!', 'thornbloom', 'voidling']], 480);
    throne(b, 'rootmother');
  }, undefined, false),
];
