import { Container, Graphics } from 'pixi.js';
import type { Palette } from '../../assets/data/palettes';
import type { LakeDef } from '../core/types';
import { hashString, makeRng } from '../core/util';
import type { World } from '../core/world';
import { OPEN_SKY, type Heightfield } from '../systems/terrain';
import { mixColor, type Gfx } from './gfx';

const CHUNK = 512;
const DEPTH = 1400;

interface Chunk {
  ground: Graphics;
  back: Container;
  front: Container;
}

/** Collects the profile of a heightfield across [x0, x1] into `out` as x,y pairs. */
function profile(hf: Heightfield, x0: number, x1: number, out: number[]): void {
  out.length = 0;
  out.push(x0, hf.at(x0));
  const xs = hf.xs;
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] <= x0) continue;
    if (xs[i] >= x1) break;
    out.push(xs[i], hf.ys[i]);
  }
  out.push(x1, hf.at(x1 - 0.01));
}

/** Ground, cave roofs and scenery, built lazily in chunks as the camera reaches them. */
export class TerrainView {
  readonly back = new Container();
  readonly ground = new Container();
  readonly front = new Container();
  private readonly chunks = new Map<number, Chunk>();
  private readonly scratch: number[] = [];
  private seed = 1;

  constructor(private readonly gfx: Gfx) {}

  reset(levelId: string): void {
    for (const c of this.chunks.values()) this.destroyChunk(c);
    this.chunks.clear();
    this.seed = hashString(levelId);
  }

  private destroyChunk(c: Chunk): void {
    c.ground.destroy();
    c.back.destroy({ children: true });
    c.front.destroy({ children: true });
  }

  /** Builds chunks overlapping the view and frees those far behind. */
  ensure(w: World, pal: Palette, left: number, right: number): void {
    const first = Math.floor((left - 80) / CHUNK);
    const last = Math.floor((right + 80) / CHUNK);
    for (let i = first; i <= last; i++) {
      if (!this.chunks.has(i)) this.chunks.set(i, this.build(w, pal, i));
    }
    if (this.chunks.size > 8) {
      for (const [i, c] of this.chunks) {
        if (i < first - 2 || i > last + 2) {
          this.destroyChunk(c);
          this.chunks.delete(i);
        }
      }
    }
  }

  private build(w: World, pal: Palette, index: number): Chunk {
    const x0 = index * CHUNK;
    const x1 = x0 + CHUNK + 2;
    const pts = this.scratch;
    const g = new Graphics();

    // Ground body in three tones: moonlit crust, body, deep shadow.
    profile(w.ground, x0, x1, pts);
    const bottom = Math.max(...pts.filter((_, i) => i % 2 === 1)) + DEPTH;
    const tones: [number, number][] = [
      [0, mixColor(pal.ground, pal.rim, 0.3)],
      [9, pal.ground],
      [58, mixColor(pal.ground, pal.groundDeep, 0.6)],
      [150, pal.groundDeep],
    ];
    for (const [offset, colour] of tones) {
      const poly: number[] = [];
      for (let i = 0; i < pts.length; i += 2) poly.push(pts[i], pts[i + 1] + offset);
      poly.push(x1, bottom, x0, bottom);
      g.poly(poly).fill(colour);
    }
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.stroke({ width: 2.2, color: pal.rim, alpha: 0.8, join: 'round' });

    // Cave roofs: every run of real ceiling becomes a slab hanging from above.
    if (w.ceil.length > 0) {
      profile(w.ceil, x0, x1, pts);
      let run: number[] = [];
      const flush = (): void => {
        if (run.length >= 4) {
          let top = Infinity;
          for (let i = 1; i < run.length; i += 2) top = Math.min(top, run[i]);
          for (const [offset, colour] of [
            [0, mixColor(pal.ground, pal.rim, 0.12)],
            [-9, pal.ground],
            [-50, pal.groundDeep],
          ] as [number, number][]) {
            const poly: number[] = [];
            for (let i = 0; i < run.length; i += 2) poly.push(run[i], run[i + 1] + offset);
            poly.push(run[run.length - 2], top - DEPTH, run[0], top - DEPTH);
            g.poly(poly).fill(colour);
          }
          g.moveTo(run[0], run[1]);
          for (let i = 2; i < run.length; i += 2) g.lineTo(run[i], run[i + 1]);
          g.stroke({ width: 1.5, color: pal.rim, alpha: 0.32 });
        }
        run = [];
      };
      for (let i = 0; i < pts.length; i += 2) {
        if (pts[i + 1] > OPEN_SKY / 2) run.push(pts[i], pts[i + 1]);
        else flush();
      }
      flush();
    }

    const back = new Container();
    const front = new Container();
    this.decorate(w, pal, index, back, front);
    this.back.addChild(back);
    this.ground.addChild(g);
    this.front.addChild(front);
    return { ground: g, back, front };
  }

  /** Scatters biome scenery along the ground: small things in front, large silhouettes behind. */
  private decorate(w: World, pal: Palette, index: number, back: Container, front: Container): void {
    const rng = makeRng(this.seed + index * 7919);
    const x0 = index * CHUNK;
    const gfx = this.gfx;
    let x = x0 + rng() * 30;
    while (x < x0 + CHUNK) {
      const gy = w.ground.at(x);
      const steep = Math.abs(w.ground.at(x + 8) - w.ground.at(x - 8)) > 12;
      const roofed = w.ceil.length > 0 && w.ceil.at(x) > OPEN_SKY / 2;
      const roll = rng();
      if (!steep && x > 20 && x < w.level.width) {
        const small = (name: 'grass' | 'pebble' | 'coral', tint: number, scale: number): void => {
          const s = gfx.sprite(name, 0.5, 1);
          s.position.set(x, gy + 2);
          s.scale.set(gfx.inv * scale * (rng() < 0.5 ? -1 : 1), gfx.inv * scale);
          s.tint = tint;
          s.alpha = 0.75 + rng() * 0.25;
          front.addChild(s);
        };
        const tall = (name: 'wreck' | 'column' | 'arch' | 'spire' | 'kelpBlade', scale: number, alpha: number): void => {
          const s = gfx.sprite(name, 0.5, 1);
          s.position.set(x, gy + 6);
          s.scale.set(gfx.inv * scale * (rng() < 0.5 ? -1 : 1), gfx.inv * scale * (0.8 + rng() * 0.5));
          s.alpha = alpha;
          back.addChild(s);
        };
        if (pal.style === 'stacks') {
          if (roll < 0.34) small('pebble', 0xffffff, 0.7 + rng() * 0.8);
          else if (roll < 0.58) small('grass', 0xb8c6f0, 0.8 + rng() * 0.5);
          else if (roll < 0.63 && !roofed) tall('wreck', 0.8 + rng() * 0.6, 0.85);
        } else if (pal.style === 'hills') {
          if (roll < 0.4) small('grass', 0xd6e4ff, 0.8 + rng() * 0.6);
          else if (roll < 0.6) small('pebble', 0xdde6ff, 0.6 + rng() * 0.7);
          else if (roll < 0.7) small('coral', 0xbfd0ff, 0.6 + rng() * 0.4);
        } else if (pal.style === 'kelp') {
          if (roll < 0.3) small('grass', 0x8ff0c8, 0.8 + rng() * 0.7);
          else if (roll < 0.48) small('coral', 0x7fd8c0, 0.6 + rng() * 0.5);
          else if (roll < 0.8) tall('kelpBlade', 0.7 + rng() * 0.9, 0.55);
        } else if (pal.style === 'ruins') {
          if (roll < 0.24) small('pebble', 0xd8ccff, 0.7 + rng() * 0.9);
          else if (roll < 0.4) small('grass', 0xc0b4f0, 0.7 + rng() * 0.4);
          else if (roll < 0.53) tall('column', 0.6 + rng() * 0.6, 0.8);
          else if (roll < 0.58 && !roofed) tall('arch', 0.8 + rng() * 0.5, 0.7);
        } else {
          if (roll < 0.36) small('coral', 0xffd9b0, 0.7 + rng() * 0.6);
          else if (roll < 0.62) small('grass', 0xffe9b8, 0.8 + rng() * 0.6);
          else if (roll < 0.7 && !roofed) tall('spire', 0.5 + rng() * 0.5, 0.75);
        }
      }
      x += 22 + rng() * 46;
    }
  }
}

/** The sea and any still water in basins: translucent bodies with moving surfaces, redrawn each frame. */
export class WaterView {
  readonly g = new Graphics();
  // Scratch buffers, reused every frame.
  private readonly pts: number[] = [];
  private readonly poly: number[] = [];

  /** Surface height including ripples, so splashes and floating things can sit on it. */
  static surface(x: number, waterY: number, t: number): number {
    return waterY + Math.sin(x * 0.034 + t * 1.5) * 1.8 + Math.sin(x * 0.011 - t * 0.7) * 2.6;
  }

  draw(pal: Palette, left: number, right: number, bottom: number, waterY: number, lakes: readonly LakeDef[], ground: { at(x: number): number }, t: number, calm: number): void {
    const g = this.g;
    g.clear();
    if (waterY <= bottom) {
      const x0 = Math.floor((left - 24) / 16) * 16;
      this.surfaceLine(x0, right + 24, waterY, t, calm);
      this.body(pal, bottom + 40, null);
    }
    for (let i = 0; i < lakes.length; i++) {
      const l = lakes[i];
      if (l.x1 < left - 24 || l.x0 > right + 24 || l.y >= waterY || l.y > bottom) continue;
      this.surfaceLine(l.x0, l.x1, l.y, t, calm);
      this.body(pal, 0, ground);
    }
  }

  /** Fills `pts` with the rippled surface from x0 to x1 (ends included). */
  private surfaceLine(x0: number, x1: number, y: number, t: number, calm: number): void {
    const pts = this.pts;
    pts.length = 0;
    const n = Math.max(2, Math.ceil((x1 - x0) / 16) + 1);
    for (let i = 0; i < n; i++) {
      const x = x0 + ((x1 - x0) * i) / (n - 1);
      pts.push(x, y + (WaterView.surface(x, y, t) - y) * calm);
    }
  }

  /**
   * Fills the water under the surface in `pts` in three depth bands. The floor is flat at
   * `floor`, or follows `ground` for a basin, so the water sits in the bowl that holds it.
   */
  private body(pal: Palette, floor: number, ground: { at(x: number): number } | null): void {
    const g = this.g;
    const pts = this.pts;
    const n = pts.length;
    for (let b = 0; b < BANDS.length; b++) {
      const [offset, color, alpha] = BANDS[b];
      const poly = this.poly;
      poly.length = 0;
      for (let i = 0; i < n; i += 2) {
        const bed = ground ? ground.at(pts[i]) : floor;
        poly.push(pts[i], Math.min(pts[i + 1] + offset, bed));
      }
      for (let i = n - 2; i >= 0; i -= 2) poly.push(pts[i], ground ? ground.at(pts[i]) + 2 : floor);
      g.poly(poly).fill({ color: color === 0 ? pal.water : pal.waterDeep, alpha });
    }
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < n; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.stroke({ width: 1.6, color: pal.surface, alpha: 0.62 });
    g.moveTo(pts[0], pts[1] + 3.5);
    for (let i = 2; i < n; i += 2) g.lineTo(pts[i], pts[i + 1] + 3.5);
    g.stroke({ width: 3, color: pal.surface, alpha: 0.12 });
  }
}

/** Depth bands of a body of water: [offset below the surface, 0 = water / 1 = deep, alpha]. */
const BANDS: [number, number, number][] = [
  [0, 0, 0.4],
  [46, 1, 0.34],
  [150, 1, 0.4],
];
