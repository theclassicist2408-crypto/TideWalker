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
  // A long climb on light alone: leave something to drink first.
  if (n >= 4) b.plant(30);
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
  // Fireflies skim the surface of wide water so a long swim never runs a careful swimmer dry.
  if (width >= 400) {
    b.fireflies(width * 0.66, -18, 3, 22);
    b.fireflies(width * 0.34, -18, 3, 22);
  }
  for (let i = 0; i < kelp; i++) {
    const back = width * (0.25 + (0.5 * (i + 0.5)) / kelp);
    b.kelp(back + 22, 44, Math.min(depth - 6, 74));
  }
}

/** A lagoon with something living in it. The fish patrols mid-water along its length. */
export function haunt(b: LevelBuilder, width: number, depth: number, kind: 'drifter' | 'angler' | 'hush', kelp = 2): void {
  lagoon(b, width, depth, kelp);
  const up = -Math.round(depth * 0.62);
  if (kind === 'angler') b.fish('angler', width * 0.5, up);
  else b.fish(kind, width * 0.74, up, width * 0.26, up);
}

/** Flat ground strewn with urchins to hop. */
export function urchins(b: LevelBuilder, n: number, gap = 130): void {
  b.flat(70);
  for (let i = 0; i < n; i++) {
    b.flat(gap);
    b.urchin(gap * 0.5);
  }
  b.flat(60);
}

/** A lit doorway of coral that opens to the creature's glow. */
export function bloomDoor(b: LevelBuilder): void {
  b.flat(150);
  b.bloomGate(40, 104);
  b.flat(60);
}

/**
 * A sunken court closed by a driftwood gate that only the tide can lift.
 * Early arrivals watch the water climb the steps toward them; latecomers swim straight through.
 */
export function tideCourt(b: LevelBuilder): void {
  b.slope(110, 100);
  b.flat(250);
  b.plant(170);
  b.tideGate(70, 112, { openAbove: b.y - 12 });
  b.flat(90).floods(450);
  b.plat(72, 46, 34).plat(36, 92, 34).step(-138);
}
