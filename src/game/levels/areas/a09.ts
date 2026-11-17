import { bench, bloomDoor, crackedWall, crumbles, den, fight, gaps, gauntlet, glassBridge, glideGap, rise, shaft, sump, thorns, throne } from '../motifs';
import { L, shellId, type AreaInfo, type LevelSpec } from './common';

export const AREA_9: AreaInfo = {
  index: 9,
  name: 'The Silent Deep',
  biome: 'deep',
  line: 'No light has ever been here. Yours is the first, and it is not welcome.',
  twist: 'Darkness everywhere: glow to see, and be hunted for it.',
  boss: 'hush',
  weather: { rain: 0, wind: 0, fog: 0.6, moon: 0, fireflies: 0.15 },
  finale: (b, _s, n) => {
    glassBridge(b, 220);
    fight(b, n % 2 === 0 ? [['voidling', 'lurker!'], ['voidling', 'voidling', 'stormjelly!']] : [['stormjelly!', 'voidling'], ['lurker!', 'voidling', 'voidling']], 500);
  },
};

const DARK = { dark: 0.3 };

export const LEVELS_9: LevelSpec[] = [
  L('Lightless', 'You cannot see the floor. Shine, and something sees you.', 'Total darkness; glow reveals the path and wakes the hunters', (b, s) => {
    glassBridge(b, 220);
    b.flat(280).foe('voidling', 140, 140);
    gaps(b, s, 2);
    bench(b);
    fight(b, [['voidling', 'voidling'], ['voidling', 'lurker!', 'stormjelly']], 500);
  }, { dark: 0.22, glowHunted: true }),
  L('Hold Your Breath', 'Be dark. Be quick. Do not stop.', 'Stealth: every second of glow calls another hunter', (b) => {
    b.flat(320).foe('voidling', 220, 150).foe('voidling', 90, 150);
    thorns(b, 3, 52);
    b.flat(320).foe('lurker', 200, 40, true).foe('voidling', 80, 150);
    bench(b);
    crumbles(b, 4);
    b.flat(300).foe('voidling', 150, 150, true);
  }, { dark: 0.24, glowHunted: true }, false),
  L('The Black Water', 'Down again, and there is no up from here.', 'A drowned level in the dark, with elite fish', (b) => {
    b.tide([[0, -700]], 0, 7);
    b.flat(320).fish(160, -60, 120, true);
    b.hills(420, 30, 2).fish(210, -70, 140).fish(60, -50, 110);
    b.optional((o) => o.shell(240, 90, true, shellId(9, 1)));
    bench(b);
    b.slope(300, 90).fish(150, -60, 120, true);
    b.flat(420).fish(300, -80, 120).fish(120, -50, 120, true);
    b.slope(300, -90);
  }, { dark: 0.26, flooded: true }, false),
  L('Mute Twin', 'One of them is real.', 'Optional guardian: a blinking twin in the dark', (b, s) => {
    glideGap(b);
    den(b, s, 'mutetwin', { upgrade: 'lumen' }, false);
    b.secret('twin', 140, 80, 120, 90);
    crackedWall(b);
    fight(b, [['voidling', 'stormjelly!', 'lurker']], 500);
  }, DARK),
  L('The Weight', 'Everything is heavier down here.', 'Crushing depth: short leaps, hard falls', (b, s) => {
    gaps(b, s, 2);
    shaft(b, 190);
    crumbles(b, 3);
    bench(b);
    fight(b, [['stormjelly!', 'voidling'], ['lurker!', 'voidling', 'voidling']], 500);
    rise(b, s, true);
  }, { dark: 0.3, gravity: 1.14 }),
  L('The Long Dark', 'No lantern for a long way. Count your breaths.', 'No healing, in the dark', (b) => {
    glassBridge(b, 240);
    b.foe('voidling', 80, 150);
    shaft(b, 210);
    bench(b);
    fight(b, [['voidling', 'lurker'], ['voidling', 'stormjelly!']], 480);
    thorns(b, 3, 52);
  }, { dark: 0.28, noHeal: true }),
  L('Doors in the Deep', 'They open to light. You know what else comes to light.', 'Bloom doors that force you to shine', (b, s) => {
    bloomDoor(b);
    b.flat(280).foe('voidling', 140, 150, true);
    bloomDoor(b);
    rise(b, s, true);
    b.optional((o) => o.plat(170, 50, 44, 'moonglass').plat(96, 100, 44, 'moonglass').shell(74, 118, true, shellId(9, 2)));
    bench(b);
    fight(b, [['voidling', 'voidling', 'voidling'], ['lurker!', 'stormjelly!', 'voidling']], 500);
    bloomDoor(b);
  }, { dark: 0.24, glowHunted: true }),
  L('Lightless Maw', 'It is the dark, with teeth.', 'Optional guardian: a maw that pulls you toward its spiral', (b, s) => {
    sump(b, 460, 200, 3);
    den(b, s, 'lightlessmaw', { upgrade: 'health' }, false);
    b.secret('maw', 140, 80, 120, 90);
    glassBridge(b, 220);
    fight(b, [['voidling', 'voidling', 'stormjelly!']], 500);
  }, DARK),
  L('The Narrowing', 'Three rooms in the dark. The last one is listening.', 'A gauntlet of elites without a lantern', (b) => {
    bench(b);
    gauntlet(b, [[['voidling', 'lurker!']], [['stormjelly!', 'stormjelly', 'voidling']], [['voidling!', 'voidling']]]);
  }, DARK),
  L('Where Sound Ends', 'You will not hear it coming. Watch the marks.', 'Boss: the Hush', (b) => {
    glassBridge(b, 220);
    fight(b, [['voidling', 'voidling', 'lurker!']], 480);
    throne(b, 'hush');
  }, { dark: 0.4 }, false),
];
