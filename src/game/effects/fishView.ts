import { Container, type Sprite } from 'pixi.js';
import { LIGHT } from '../../assets/data/palettes';
import { clamp, damp, lerp } from '../core/util';
import type { FishState, World } from '../core/world';
import type { Gfx } from './gfx';

/** One shadow-fish: a dark tapering body, a chain of tail segments, eyes that kindle when it notices light. */
export class FishView {
  readonly root = new Container();
  readonly glow = new Container();
  private readonly body: Sprite;
  private readonly segs: Sprite[] = [];
  private readonly tailFin: Sprite;
  private readonly eye: Sprite;
  private readonly lure: Sprite | null = null;
  private readonly lureHalo: Sprite | null = null;
  private readonly sx: Float32Array;
  private readonly sy: Float32Array;
  private angle = 0;
  private time = Math.random() * 10;
  private readonly size: number;
  /** Screen-facing head position (for edge warnings). */
  x = 0;
  y = 0;

  constructor(
    private readonly gfx: Gfx,
    readonly fish: FishState,
  ) {
    const n = fish.kind === 'hush' ? 16 : fish.kind === 'angler' ? 4 : 5;
    this.size = fish.kind === 'hush' ? 1.5 : fish.kind === 'angler' ? 1.1 : 0.9;
    this.sx = new Float32Array(n);
    this.sy = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const s = gfx.sprite('fishSeg');
      this.segs.push(s);
      this.root.addChild(s);
      this.sx[i] = fish.x - i * 8;
      this.sy[i] = fish.y;
    }
    this.tailFin = gfx.sprite('fishTail', 1, 0.5);
    this.body = gfx.sprite('fishBody', 0.72, 0.5);
    this.root.addChild(this.tailFin, this.body);
    this.eye = gfx.sprite('fishEye');
    this.eye.blendMode = 'add';
    this.eye.tint = LIGHT.dangerEye;
    this.glow.addChild(this.eye);
    if (fish.kind === 'angler') {
      this.lureHalo = gfx.sprite('soft');
      this.lureHalo.blendMode = 'add';
      this.lure = gfx.sprite('dot');
      this.lure.blendMode = 'add';
      this.glow.addChild(this.lureHalo, this.lure);
    }
  }

  /** World position of the angler's false light. */
  lureX = 0;
  lureY = 0;

  update(w: World, alpha: number, dt: number, lightRadius: number): void {
    const f = this.fish;
    const dormant = f.mode === 'dormant';
    this.root.visible = !dormant;
    this.glow.visible = !dormant;
    if (dormant) return;
    this.time += dt;
    const inv = this.gfx.inv;
    const x = lerp(f.prevX, f.x, alpha);
    const y = lerp(f.prevY, f.y, alpha);
    this.x = x;
    this.y = y;

    const speed = Math.hypot(f.vx, f.vy);
    if (speed > 6) {
      let target = Math.atan2(f.vy, f.vx);
      let diff = target - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      target = this.angle + diff;
      this.angle += (target - this.angle) * damp(f.mode === 'lunge' ? 20 : 5, dt);
    }
    const shake = f.mode === 'windup' ? Math.sin(this.time * 60) * 1.4 : 0;
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    const flip = cos < 0 ? -1 : 1;
    const size = this.size;

    this.body.position.set(x + shake, y);
    this.body.rotation = this.angle;
    this.body.scale.set(inv * size, inv * size * flip);

    // Tail chain trails the body with an undulating wave.
    let lx = x - cos * 24 * size;
    let ly = y - sin * 24 * size;
    const n = this.segs.length;
    const spacing = (f.kind === 'hush' ? 9 : 7) * size;
    const waveAmp = (1.2 + clamp(speed / 120, 0, 1) * 2.4) * size;
    for (let i = 0; i < n; i++) {
      const dx = this.sx[i] - lx;
      const dy = this.sy[i] - ly;
      const d = Math.hypot(dx, dy) || 1;
      this.sx[i] = lx + (dx / d) * spacing;
      this.sy[i] = ly + (dy / d) * spacing;
      const t = i / n;
      const wave = Math.sin(this.time * 5 - i * 0.7) * waveAmp * t;
      const s = this.segs[i];
      s.position.set(this.sx[i] - sin * wave, this.sy[i] + cos * wave);
      const k = (1 - t * 0.72) * size * (f.kind === 'hush' ? 1.25 : 1);
      s.scale.set(inv * k * 1.15, inv * k);
      s.rotation = Math.atan2(dy, dx);
      lx = this.sx[i];
      ly = this.sy[i];
    }
    const last = n - 1;
    this.tailFin.position.set(this.sx[last], this.sy[last]);
    this.tailFin.rotation = Math.atan2(this.sy[last] - (last > 0 ? this.sy[last - 1] : y), this.sx[last] - (last > 0 ? this.sx[last - 1] : x)) + Math.PI + Math.sin(this.time * 5) * 0.3;
    this.tailFin.scale.set(inv * size * 0.9);

    // Visibility: a silhouette in the dark, clearer when light falls on it or it is hunting.
    const p = w.player;
    const dist = Math.hypot(p.x - x, p.y - y);
    const lit = clamp(1.25 - dist / Math.max(40, lightRadius), 0, 1);
    const base = f.kind === 'angler' ? 0.05 : f.kind === 'hush' ? 0.62 : 0.5;
    this.root.alpha = clamp(base + lit * 0.6 + f.alert * 0.45, 0, 0.96);

    const ex = x + cos * 13 * size - sin * -3 * size * flip;
    const ey = y + sin * 13 * size + cos * -3 * size * flip;
    this.eye.position.set(ex, ey);
    this.eye.rotation = this.angle;
    const flare = f.mode === 'windup' ? 1.9 + Math.sin(this.time * 40) * 0.3 : 1;
    this.eye.scale.set(inv * size * 1.1 * flare);
    this.eye.alpha = clamp(f.alert * 1.1 + (f.kind === 'hush' ? 0.35 : 0.08) + lit * 0.2, 0, 1);

    if (this.lure && this.lureHalo) {
      // The false light hangs above the angler's home, never moving with the strike.
      const bob = Math.sin(this.time * 1.7) * 2;
      const hx = f.hx1;
      const hy = f.hy1 - 26 + bob;
      this.lureX = hx;
      this.lureY = hy;
      const away = f.mode !== 'patrol';
      // Tell: it pulses unevenly, and turns violet as the angler's patience runs out.
      const pulse = 0.72 + 0.2 * Math.sin(this.time * 4.3) * Math.sin(this.time * 1.1) + 0.08 * Math.sin(this.time * 13);
      const a = away ? 0.15 : pulse;
      this.lure.position.set(hx, hy);
      this.lure.scale.set(9 / 24);
      this.lure.alpha = a;
      this.lureHalo.position.set(hx, hy);
      this.lureHalo.scale.set(70 / 128);
      this.lureHalo.alpha = a * 0.5;
      const col = f.alert > 0.25 ? LIGHT.danger : LIGHT.lure;
      this.lure.tint = col;
      this.lureHalo.tint = col;
    }
  }
}
