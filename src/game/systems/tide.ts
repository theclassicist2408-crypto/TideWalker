import type { TideDef } from '../core/types';
import { smoothstep } from '../core/util';

/** The tide: a keyframed water level with a slow swell layered on top. */
export class Tide {
  /** Tide clock in seconds (scaled by difficulty, rewound at checkpoints). */
  time = 0;
  /** Current surface y. */
  level = 0;
  /** +1 rising (water climbing, y decreasing), -1 falling, 0 slack. */
  trend = 0;
  /** 0 at the lowest keyframe, 1 at the highest. */
  progress = 0;
  private readonly lowest: number;
  private readonly highest: number;

  constructor(private readonly def: TideDef) {
    if (def.keys.length === 0) throw new Error('Tide needs at least one keyframe');
    let lo = -Infinity;
    let hi = Infinity;
    for (const [, y] of def.keys) {
      if (y > lo) lo = y;
      if (y < hi) hi = y;
    }
    this.lowest = lo;
    this.highest = hi;
    this.update(0);
  }

  /** Keyframed level plus the slow breath, without swell. */
  baseAt(t: number): number {
    const amp = this.def.breathAmp ?? 0;
    const breath = amp > 0 ? Math.sin((t / (this.def.breathPeriod ?? 40)) * Math.PI * 2) * amp : 0;
    return this.keyAt(t) + breath;
  }

  private keyAt(t: number): number {
    const keys = this.def.keys;
    if (t <= keys[0][0]) return keys[0][1];
    const last = keys[keys.length - 1];
    if (t >= last[0]) return last[1];
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i];
      const b = keys[i + 1];
      if (t >= a[0] && t <= b[0]) {
        const f = smoothstep((t - a[0]) / Math.max(0.0001, b[0] - a[0]));
        return a[1] + (b[1] - a[1]) * f;
      }
    }
    return last[1];
  }

  levelAt(t: number): number {
    const swell = this.def.amp > 0 ? Math.sin((t / this.def.period) * Math.PI * 2) * this.def.amp : 0;
    return this.baseAt(t) + swell;
  }

  /** Advances the clock by `dt` (already scaled) and refreshes level, trend and progress. */
  update(dt: number): void {
    this.time += dt;
    const now = this.levelAt(this.time);
    const soon = this.baseAt(this.time + 1.5);
    const base = this.baseAt(this.time);
    const delta = base - soon;
    this.trend = delta > 0.4 ? 1 : delta < -0.4 ? -1 : 0;
    this.level = now;
    const span = this.lowest - this.highest;
    this.progress = span > 0.001 ? Math.min(1, Math.max(0, (this.lowest - base) / span)) : 0;
  }

  setTime(t: number): void {
    this.time = Math.max(0, t);
    this.update(0);
  }
}
