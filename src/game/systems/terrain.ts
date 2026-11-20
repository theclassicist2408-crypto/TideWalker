/**
 * Piecewise-linear height profile. Vertical walls are encoded as two points sharing one x.
 * For a duplicated x the later point wins, so `at(x)` is right-continuous.
 */
export class Heightfield {
  readonly xs: number[];
  readonly ys: number[];
  private last = 0;

  constructor(xs: number[], ys: number[], private readonly empty = 0) {
    if (xs.length !== ys.length) throw new Error('Heightfield: xs and ys differ in length');
    this.xs = xs;
    this.ys = ys;
  }

  get length(): number {
    return this.xs.length;
  }

  at(x: number): number {
    const xs = this.xs;
    const n = xs.length;
    if (n === 0) return this.empty;
    if (x <= xs[0]) return this.ys[0];
    if (x >= xs[n - 1]) return this.ys[n - 1];
    // Queries are spatially coherent, so try the cached segment before searching.
    let i = this.last;
    if (!(i < n - 1 && xs[i] <= x && x < xs[i + 1])) {
      let lo = 0;
      let hi = n - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (xs[mid] <= x) lo = mid;
        else hi = mid - 1;
      }
      i = lo;
      this.last = i;
    }
    const x0 = xs[i];
    const x1 = xs[i + 1];
    if (x1 === x0) return this.ys[i + 1];
    return this.ys[i] + ((this.ys[i + 1] - this.ys[i]) * (x - x0)) / (x1 - x0);
  }

  /**
   * True if a sheer face (a vertical edge, or a segment steeper than `steep`) taller than `minH`
   * lies within [x0, x1]. Slopes up to `steep` are surfaces to stand on, not walls.
   */
  sheerIn(x0: number, x1: number, minH = 4, steep = 2.5): boolean {
    const xs = this.xs;
    const ys = this.ys;
    const n = xs.length;
    if (n < 2) return false;
    // First vertex at or before x0, found by bisection.
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (xs[mid] <= x0) lo = mid;
      else hi = mid - 1;
    }
    for (let i = lo; i < n - 1 && xs[i] <= x1; i++) {
      const rise = Math.abs(ys[i + 1] - ys[i]);
      if (rise <= minH || xs[i + 1] < x0) continue;
      if (rise > steep * (xs[i + 1] - xs[i])) return true;
    }
    return false;
  }

  /** Highest surface (smallest y) across [x0, x1], sampled at the ends and every interior vertex. */
  minIn(x0: number, x1: number): number {
    let best = Math.min(this.at(x0), this.at(x1));
    const xs = this.xs;
    for (let i = 0; i < xs.length; i++) {
      if (xs[i] > x1) break;
      if (xs[i] >= x0 && this.ys[i] < best) best = this.ys[i];
    }
    return best;
  }
}

/** Sentinel "no ceiling" height. */
export const OPEN_SKY = -100000;
