import type { AbilityId, UpgradeId } from '../core/types';
import type { LevelBuilder } from './builder';
import type { Stage } from './progress';

/**
 * Reusable level phrases. Each checks the Stage so it only asks for skills the player is sure to
 * have: a plain leap clears 100 px, a dash-leap 150, a double jump 190, and both together 260.
 */

/** Open ground to run, with a little light to pick up. */
export function run(b: LevelBuilder, len = 260): void {
  b.hills(len, 10, 2);
  b.fireflies(len / 2, 34, 2);
}

/** A row of gaps sized to the skills in hand. */
export function gaps(b: LevelBuilder, s: Stage, n: number, depth = 150): void {
  for (let i = 0; i < n; i++) {
    const hard = i % 2 === 1;
    if (hard && s.has('double') && s.has('airdash')) b.pit(240, depth, { act: 'double' });
    else if (hard && s.has('double')) b.pit(170, depth, { act: 'double' });
    else if (hard && s.has('dash')) b.pit(140, depth, { act: 'dash' });
    else b.pit(84, depth);
    b.flat(120);
  }
}

/** A ledge up, as tall as the skills in hand allow. */
export function rise(b: LevelBuilder, s: Stage, tall = false): void {
  if (tall && s.has('wall')) {
    b.flat(60);
    b.step(-190, 'climb');
  } else if (s.has('double')) b.step(-120, 'double');
  else b.step(-56);
  b.flat(110);
}

/** Rocks jutting from a cliff: the way up when nothing else is known yet. */
export function ladder(b: LevelBuilder, height: number): void {
  const n = Math.max(1, Math.ceil(height / 56) - 1);
  b.flat(100, false);
  for (let i = 1; i <= n; i++) b.plat(i % 2 === 1 ? 76 : 38, (i * height) / (n + 1), 36);
  b.step(-height);
  b.flat(80);
}

/** A chimney climbed by kicking from wall to wall. */
export function shaft(b: LevelBuilder, height: number): void {
  b.flat(120);
  // The left wall hangs from above, leaving a doorway at the bottom.
  b.block(86, height + 30, 26, height - 20);
  b.step(-height, 'climb');
  b.flat(90);
}

/** Spike strips to leap. */
export function thorns(b: LevelBuilder, n: number, width = 46): void {
  b.flat(70);
  for (let i = 0; i < n; i++) {
    b.flat(140);
    b.spikes(70 + width / 2, width);
  }
  b.flat(60);
}

/** A chasm crossed on ledges that fall away underfoot. */
export function crumbles(b: LevelBuilder, n: number, depth = 170): void {
  const w = 44;
  const g = 46;
  const width = n * w + (n + 1) * g;
  b.pit(width, depth, {}, (bb) => {
    for (let i = 0; i < n; i++) bb.plat(width - (g + i * (w + g)), i % 2 === 0 ? 6 : 16, w, 'crumble');
  });
  b.flat(100);
}

/** A chasm crossed on platforms that slide to and fro. */
export function movers(b: LevelBuilder, n: number, depth = 180): void {
  const span = 150;
  const width = n * span + 70;
  b.pit(width, depth, {}, (bb) => {
    for (let i = 0; i < n; i++) bb.plat(width - 40 - i * span, 4, 52, 'rock', true, { dx: 62, period: 2.6 + (i % 2) * 0.5 });
  });
  b.flat(100);
}

/** A chasm crossed on moonglass that only holds while lit. */
export function glassBridge(b: LevelBuilder, width: number, depth = 170): void {
  const n = Math.max(2, Math.round(width / 70));
  const w = width / n;
  b.pit(width, depth, {}, (bb) => {
    for (let i = 0; i < n; i++) bb.plat(width - i * w, 0, w, 'moonglass');
  });
  b.flat(90);
}

/** Open water. `fish` needlefish patrol it. Needs the dive to go under. */
export function pond(b: LevelBuilder, width: number, depth: number, fish = 0): void {
  b.basin(width, depth, 0.2);
  b.fireflies(width * 0.5, -16, 3, 24);
  for (let i = 0; i < fish; i++) b.fish(width * (0.3 + (0.4 * (i + 0.5)) / fish), Math.round(depth * 0.6), width * 0.22);
}

/** A resting light and a moon pool. */
export function bench(b: LevelBuilder, len = 200): void {
  b.flat(len);
  b.pool(len * 0.5, 44);
  b.checkpoint(len * 0.5);
}

/** A locked fight. Waves are lists of enemy kinds; a trailing `!` marks an elite. */
export function fight(b: LevelBuilder, waves: string[][], width = 460): void {
  b.flat(70);
  b.arena(width, waves);
  b.flat(70);
}

/** A shrine that gives an ability back, with room to try it. */
export function shrine(b: LevelBuilder, s: Stage, ability: AbilityId): void {
  b.flat(220);
  b.grant(110, { ability });
  b.pool(110, 40);
  s.add(ability);
}

/** A guardian's den. Locked ones must be won; open ones can be run past. */
export function den(b: LevelBuilder, s: Stage, id: string, prize: { ability?: AbilityId; upgrade?: UpgradeId }, lock: boolean): void {
  bench(b, 180);
  b.flat(60);
  b.arena(520, [[]], { miniboss: id, lock });
  b.flat(200);
  b.grant(100, { ...prize, after: id });
  if (prize.ability && lock) s.add(prize.ability);
}

/** The area's boss: a lantern right outside, a wide arena, and the way on. */
export function throne(b: LevelBuilder, id: string): void {
  bench(b, 200);
  b.flat(80);
  b.arena(600, [[]], { boss: id });
  b.flat(260);
  b.pool(130, 50);
}

/** A vent that throws the creature up a wall. */
export function vent(b: LevelBuilder, height: number, period = 3.4): void {
  b.flat(150);
  b.geyser(34, Math.sqrt(2 * 1750 * (height + 40)), period, 0);
  b.step(-height);
  b.flat(70);
}

/** Loose stones overhead: they fall as the creature passes beneath. */
export function rubble(b: LevelBuilder, n: number): void {
  b.flat(60);
  for (let i = 0; i < n; i++) {
    b.flat(120);
    b.stone(60, 150 + (i % 2) * 30);
  }
  b.flat(60);
}

/** A coral door that opens to light. */
export function bloomDoor(b: LevelBuilder): void {
  b.flat(170, false);
  b.bloomGate(40, 400);
  b.flat(60);
}

/** A cracked wall that only a charged strike breaks. */
export function crackedWall(b: LevelBuilder): void {
  b.flat(160);
  b.block(50, 400, 30, 400, 'cracked');
  b.flat(40);
}

/** A low tunnel with urchins on its floor: duck in and hop them. */
export function tunnel(b: LevelBuilder, len: number, n: number): void {
  b.caveStart(86);
  b.flat(60);
  for (let i = 0; i < n; i++) {
    b.flat(len / n);
    b.urchin(len / n / 2);
  }
  b.flat(60);
  b.caveEnd(86);
}

/** Deep water with a sunken wall across it: the only way on is under. Needs the dive. */
export function sump(b: LevelBuilder, width: number, depth: number, fish = 0): void {
  b.basin(width, depth, 0.16, (bb) => {
    bb.block(width * 0.5 + 20, 30, 40, depth * 0.55);
    bb.via(width * 0.5 + 40, -(depth - 30), { swim: true }).via(width * 0.5 - 40, -(depth - 30), { swim: true });
  });
  b.fireflies(width * 0.25, -18, 3, 22);
  for (let i = 0; i < fish; i++) b.fish(width * (i % 2 === 0 ? 0.74 : 0.26), Math.round(depth * 0.65), width * 0.16);
}

/** Water with a current running through it. */
export function race(b: LevelBuilder, width: number, depth: number, push: number, fish = 0): void {
  pond(b, width, depth, fish);
  b.current(width * 0.8, -10, width * 0.6, depth - 20, push, 0, push > 0 ? { safe: true } : { mode: 'beat', period: 4.5, duty: 0.5 });
}

/** A long drop to glide across. */
export function glideGap(b: LevelBuilder): void {
  b.step(-110, 'double');
  b.flat(120);
  b.pit(340, 280, { act: 'glide', farDy: 100 });
  b.flat(110);
}

/** Hold out until the timer ends; foes keep coming. */
export function holdout(b: LevelBuilder, waves: string[][], seconds: number): void {
  bench(b, 180);
  b.flat(70);
  b.arena(480, waves, { survive: seconds });
  b.flat(70);
}

/** Back-to-back fights with no lantern between them. */
export function gauntlet(b: LevelBuilder, fights: string[][][]): void {
  for (const waves of fights) {
    b.flat(60);
    b.arena(420, waves);
    b.flat(100);
    b.plant(50);
  }
}
