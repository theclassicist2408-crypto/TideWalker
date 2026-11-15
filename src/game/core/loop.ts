import { FIXED_DT, MAX_STEPS_PER_FRAME } from './constants';

/**
 * Fixed-timestep accumulator. Rendering runs at the display rate; the simulation always advances
 * in identical steps, so physics feel the same at 30, 60 or 120 FPS.
 */
export class FixedLoop {
  private acc = 0;
  /** Interpolation factor between the last two steps, for smooth rendering. */
  alpha = 0;

  /** Feeds elapsed real time; returns how many fixed steps to run now. */
  advance(elapsed: number): number {
    // After a stall (tab switch, GC pause) never try to catch up more than a few steps.
    this.acc += Math.min(elapsed, FIXED_DT * MAX_STEPS_PER_FRAME);
    let steps = 0;
    while (this.acc >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      this.acc -= FIXED_DT;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.acc = 0;
    this.alpha = this.acc / FIXED_DT;
    return steps;
  }

  reset(): void {
    this.acc = 0;
    this.alpha = 0;
  }
}
