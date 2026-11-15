import type { LevelBuilder } from './builder';

/**
 * Reusable shoreline phrases. Every motif keeps required jumps within easy reach
 * (rise <= 46 px, gap <= 64 px against a 90 px / 104 px ability) so chapters stay fair.
 */

/** A run of small leaps over tide-cut gullies. */
export function gullies(b: LevelBuilder, n: number, gap = 56, land = 130, depth = 140): void {
  for (let i = 0; i < n; i++) {
    b.pit(gap, depth);
    b.flat(land);
  }
}

/** Ledges stepping up (rise < 0) or down (rise > 0). */
export function ledges(b: LevelBuilder, n: number, rise = -28, run = 110): void {
  for (let i = 0; i < n; i++) {
    b.step(rise);
    b.flat(run);
  }
}

/** A chasm crossed on moonglass that only holds while lit. */
export function moonBridge(b: LevelBuilder, width: number, depth = 150): void {
  const n = Math.max(2, Math.round(width / 70));
  const w = width / n;
  b.pit(width, depth, {}, (bb) => {
    for (let i = 0; i < n; i++) bb.plat(width - i * w, 0, w, 'moonglass');
  });
}

/** Rising moonglass steps to a higher shore. */
export function moonStairs(b: LevelBuilder, n: number, rise = 34, depth = 150): void {
  const stepW = 56;
  const gap = 12;
  const width = n * (stepW + gap) + gap;
  const total = (n + 1) * rise;
  b.pit(width, depth, { farDy: -total }, (bb) => {
    // After the pit the cursor sits on the far (higher) rim; platforms are placed relative to it.
    for (let i = 0; i < n; i++) bb.plat(width - gap - i * (stepW + gap), -total + (i + 1) * rise, stepW, 'moonglass');
  });
}

/** A cliff face climbed on jutting rocks. */
export function cliff(b: LevelBuilder, height: number): void {
  const n = Math.max(1, Math.ceil(height / 44) - 1);
  b.flat(90);
  for (let i = 1; i <= n; i++) b.plat(i % 2 === 1 ? 72 : 36, (i * height) / (n + 1), 34);
  b.step(-height);
}

/** Stepping stones over open water. `crumble` makes every second stone fall away. */
export function stones(b: LevelBuilder, width: number, n: number, depth = 150, crumble = false): void {
  const w = 40;
  const g = (width - n * w) / (n + 1);
  b.pit(width, depth, {}, (bb) => {
    for (let i = 0; i < n; i++) bb.plat(width - (g + i * (w + g)), i % 2 === 0 ? 4 : 12, w, crumble && i % 2 === 1 ? 'crumble' : 'rock');
  });
}

/** A place to breathe: moon pool and tide lantern. */
export function rest(b: LevelBuilder, len = 240): void {
  b.flat(len);
  b.pool(len * 0.55);
  b.checkpoint(len * 0.3);
}

/** A vent that throws the creature up a wall too tall to climb. */
export function geyserLift(b: LevelBuilder, height: number, period = 4.2): void {
  b.flat(150);
  const power = Math.sqrt(2 * 1500 * (height + 34));
  b.geyser(34, power, period, 0);
  b.step(-height);
  b.flat(60);
}

/** Open water to swim: a wide basin, optionally with kelp to hide in. */
export function lagoon(b: LevelBuilder, width: number, depth: number, kelp = 0): void {
  b.basin(width, depth, 0.22);
  for (let i = 0; i < kelp; i++) {
    const back = width * (0.25 + (0.5 * (i + 0.5)) / kelp);
    b.kelp(back + 22, 44, Math.min(depth - 6, 74));
  }
}
