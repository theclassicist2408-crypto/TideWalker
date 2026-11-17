import { bench, den, fight, gaps, pond, race, rise, run, shaft, shrine, sump, throne, tunnel } from '../motifs';
import { L, shellId, type AreaInfo, type LevelSpec } from './common';

export const AREA_3: AreaInfo = {
  index: 3,
  name: 'Kelp Abyss',
  biome: 'kelp',
  line: 'The floor falls away, and the fight goes under with it.',
  twist: 'Underwater combat: dive, swim, and strike in three dimensions.',
  boss: 'sovereign',
  weather: { rain: 0, wind: 0.1, fog: 0.4, moon: 0.5, fireflies: 0.6 },
  finale: (b, s, n) => {
    if (s.has('dive')) sump(b, 440, 190, 2);
    else pond(b, 400, 150, 0);
    fight(b, n % 2 === 0 ? [['burrower', 'spitter'], ['burrower', 'lurker', 'skitter']] : [['burrower', 'skitter'], ['burrower', 'burrower', 'spitter']], 460);
  },
};

export const LEVELS_3: LevelSpec[] = [
  L('The Drop', 'Everything you want is under the surface.', 'A shrine returns the dive; the way on is under water', (b, s) => {
    run(b, 220);
    pond(b, 360, 150, 0);
    bench(b);
    shrine(b, s, 'dive');
    b.hint('dive', 100, 260);
    sump(b, 460, 200, 0);
    b.flat(140);
    sump(b, 420, 190, 1);
  }, undefined, false),
  L('Needles', 'Fast, thin, and never alone.', 'Needlefish: dart packs in open water', (b, s) => {
    pond(b, 520, 190, 2);
    gaps(b, s, 2);
    sump(b, 480, 200, 2);
    bench(b);
    pond(b, 560, 200, 3);
    rise(b, s);
  }),
  L('Undertow', 'Wait for the water to breathe out.', 'Currents that carry you, and currents that refuse you', (b) => {
    race(b, 520, 190, 260, 1);
    b.flat(140);
    race(b, 520, 190, -420, 1);
    b.optional((o) => o.shell(260, -150, true, shellId(3, 1)));
    bench(b);
    race(b, 560, 200, 280, 2);
    shaft(b, 190);
  }),
  L('What the Sand Hides', 'The floor is watching your feet.', 'Burrowers erupt where you stand', (b, s) => {
    b.flat(260).foe('burrower', 130, 120);
    gaps(b, s, 2);
    b.flat(300).foe('burrower', 200, 100).foe('burrower', 80, 100);
    bench(b);
    fight(b, [['burrower', 'burrower'], ['burrower', 'spitter', 'spitter']], 480);
  }),
  L("Knotfin's Tangle", 'It has made a nest of what it stole.', 'Guardian: Knotfin holds the air dash', (b, s) => {
    sump(b, 460, 190, 2);
    fight(b, [['burrower', 'lurker', 'spitter']], 430);
    den(b, s, 'knotfin', { ability: 'airdash' }, true);
    b.hint('airdash', 60, 300);
    b.pit(250, 190, { act: 'double' }).flat(140);
    rise(b, s, true);
  }),
  L('Thornwater', 'There is a way through. It is narrow.', 'Urchin tunnels, above and below the water', (b) => {
    tunnel(b, 360, 3);
    sump(b, 460, 200, 1);
    b.urchin(300, -150).urchin(180, -150);
    bench(b);
    tunnel(b, 420, 4);
    fight(b, [['burrower', 'skitter'], ['lurker', 'burrower']]);
  }),
  L('The Green Dark', 'Down here the light does not reach. Yours does.', 'A drowned level in darkness', (b) => {
    b.tide([[0, -700]], 0, 7);
    b.flat(300).fish(150, -60, 110);
    b.hills(400, 30, 2).fish(200, -70, 140).fish(60, -50, 100);
    b.optional((o) => o.shell(240, 90, true, shellId(3, 2)));
    bench(b);
    b.slope(300, 90).fish(150, -60, 120);
    b.flat(400).fish(280, -80, 120).fish(120, -50, 120);
    b.slope(300, -90);
  }, { dark: 0.3, flooded: true }, false),
  L('The Weeping Float', 'It hangs in the water like a held breath.', 'An optional guardian guards a deeper light', (b, s) => {
    race(b, 480, 190, 240, 2);
    rise(b, s, true);
    den(b, s, 'weepingfloat', { upgrade: 'lumen' }, false);
    b.secret('float', 140, 80, 120, 90);
    sump(b, 440, 190, 2);
  }),
  L('Riptide', 'Swim. It is right behind you.', 'A chase through flooded caves', (b) => {
    b.tide([[0, -700]], 0, 7);
    b.flat(400);
    b.hills(500, 40, 3).urchin(260, 30).urchin(120, 26);
    b.slope(300, 80).flat(300).urchin(150, 20);
    b.hills(500, 40, 3).fish(250, -60, 100);
    b.slope(300, -80).flat(400).urchin(220, 24).urchin(90, 30);
  }, { chase: 120, flooded: true }, false),
  L("The Sovereign's Root", 'The whole forest is one thing, and it has noticed you.', 'Boss: the Kelp Sovereign', (b) => {
    sump(b, 440, 190, 2);
    fight(b, [['burrower', 'burrower', 'spitter']], 440);
    throne(b, 'sovereign');
  }, undefined, false),
];
