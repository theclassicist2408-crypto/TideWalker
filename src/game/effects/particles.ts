import { Container, type Sprite } from 'pixi.js';
import type { SpriteName } from '../../assets/sprites/atlas';
import type { Gfx } from './gfx';

interface Particle {
  sprite: Sprite;
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  life: number;
  ttl: number;
  s0: number;
  s1: number;
  a0: number;
  flat: number;
  spin: number;
}

export interface Burst {
  frame?: SpriteName;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  gravity?: number;
  drag?: number;
  ttl: number;
  /** Start and end size in world px. */
  s0: number;
  s1?: number;
  alpha?: number;
  tint?: number;
  /** y-scale multiplier (ripples are flattened rings). */
  flat?: number;
  spin?: number;
  rotation?: number;
}

/** Fixed-size pooled particle layer. Nothing is allocated after construction. */
export class ParticleLayer {
  readonly container = new Container();
  private readonly pool: Particle[] = [];
  private cursor = 0;
  /** Scales how many particles are actually spawned (reduced motion / low performance). */
  density = 1;
  private skip = 0;

  constructor(
    private readonly gfx: Gfx,
    size: number,
    additive: boolean,
  ) {
    for (let i = 0; i < size; i++) {
      const sprite = gfx.sprite('dot');
      sprite.visible = false;
      if (additive) sprite.blendMode = 'add';
      this.container.addChild(sprite);
      this.pool.push({ sprite, alive: false, x: 0, y: 0, vx: 0, vy: 0, gravity: 0, drag: 0, life: 0, ttl: 1, s0: 1, s1: 1, a0: 1, flat: 1, spin: 0 });
    }
  }

  spawn(b: Burst): void {
    if (this.density < 1) {
      this.skip += this.density;
      if (this.skip < 1) return;
      this.skip -= 1;
    }
    // Round-robin: the oldest particle is recycled when the pool is full.
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    p.alive = true;
    p.x = b.x;
    p.y = b.y;
    p.vx = b.vx ?? 0;
    p.vy = b.vy ?? 0;
    p.gravity = b.gravity ?? 0;
    p.drag = b.drag ?? 0;
    p.life = 0;
    p.ttl = b.ttl;
    p.s0 = b.s0;
    p.s1 = b.s1 ?? b.s0;
    p.a0 = b.alpha ?? 1;
    p.flat = b.flat ?? 1;
    p.spin = b.spin ?? 0;
    const s = p.sprite;
    s.texture = this.gfx.tex(b.frame ?? 'dot');
    s.tint = b.tint ?? 0xffffff;
    s.rotation = b.rotation ?? 0;
    s.visible = true;
  }

  update(dt: number): void {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.ttl) {
        p.alive = false;
        p.sprite.visible = false;
        continue;
      }
      const t = p.life / p.ttl;
      p.vy += p.gravity * dt;
      if (p.drag > 0) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const s = p.sprite;
      const size = p.s0 + (p.s1 - p.s0) * t;
      const w = s.texture.frame.width;
      const k = size / w;
      s.scale.set(k, k * p.flat);
      s.position.set(p.x, p.y);
      // Fade in quickly, out slowly.
      s.alpha = p.a0 * (t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88);
      if (p.spin !== 0) s.rotation += p.spin * dt;
    }
  }

  clear(): void {
    for (const p of this.pool) {
      p.alive = false;
      p.sprite.visible = false;
    }
  }
}
