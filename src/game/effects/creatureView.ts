import { Container, type Sprite } from 'pixi.js';
import { LIGHT } from '../../assets/data/palettes';
import { clamp, damp, lerp } from '../core/util';
import type { World } from '../core/world';
import { mixColor, type Gfx } from './gfx';

const TAIL = 6;

/** The creature: body, eyes, fin, flowing tail, halo. Fully procedural animation. */
export class CreatureView {
  readonly root = new Container();
  readonly halo: Sprite;
  private readonly inner = new Container();
  private readonly body: Sprite;
  private readonly eyeA: Sprite;
  private readonly eyeB: Sprite;
  private readonly fin: Sprite;
  private readonly bulb: Sprite;
  private readonly tail: Sprite[] = [];
  private readonly tx = new Float32Array(TAIL);
  private readonly ty = new Float32Array(TAIL);
  private sx = 1;
  private sy = 1;
  private svx = 0;
  private svy = 0;
  private face = 1;
  private blink = 2;
  private stride = 0;
  private time = 0;
  private rot = 0;
  x = 0;
  y = 0;

  constructor(private readonly gfx: Gfx) {
    this.halo = gfx.sprite('soft');
    this.halo.blendMode = 'add';
    for (let i = 0; i < TAIL; i++) {
      const seg = gfx.sprite('dot');
      this.tail.push(seg);
      this.root.addChild(seg);
    }
    this.fin = gfx.sprite('fin', 1, 0.5);
    this.body = gfx.sprite('body');
    this.eyeA = gfx.sprite('eye');
    this.eyeB = gfx.sprite('eye');
    this.bulb = gfx.sprite('dot');
    this.bulb.blendMode = 'add';
    this.inner.addChild(this.fin, this.body, this.eyeA, this.eyeB, this.bulb);
    this.root.addChild(this.inner);
  }

  /** Kick the squash-and-stretch spring. */
  squash(x: number, y: number): void {
    this.sx = x;
    this.sy = y;
  }

  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    for (let i = 0; i < TAIL; i++) {
      this.tx[i] = x - i * 4;
      this.ty[i] = y;
    }
    this.sx = this.sy = 1;
    this.svx = this.svy = 0;
  }

  update(w: World, alpha: number, dt: number): void {
    const p = w.player;
    const inv = this.gfx.inv;
    this.time += dt;
    const x = lerp(p.prevX, p.x, alpha);
    let y = lerp(p.prevY, p.y, alpha);
    const speed = Math.hypot(p.vx, p.vy);

    // Squash and stretch: damped spring back to rest, plus stretch along fast motion.
    const k = 190;
    const c = 15;
    this.svx += ((1 - this.sx) * k - this.svx * c) * dt;
    this.svy += ((1 - this.sy) * k - this.svy * c) * dt;
    this.sx += this.svx * dt;
    this.sy += this.svy * dt;
    const airStretch = p.onGround ? 0 : clamp(Math.abs(p.vy) / 900, 0, 0.22);
    const dashStretch = p.dashT > 0 ? 0.28 : 0;

    // Land gait: small bounding hops driven by distance travelled.
    if (p.onGround && Math.abs(p.vx) > 12) {
      this.stride += Math.abs(p.vx) * dt * 0.085;
      y -= Math.abs(Math.sin(this.stride)) * 2.6;
    }
    const breath = Math.sin(this.time * 2.3) * 0.028;
    const crouch = p.crouch ? 0.22 : 0;

    this.face += ((p.facing >= 0 ? 1 : -1) - this.face) * damp(16, dt);
    const targetRot = p.swim ? Math.atan2(p.vy, Math.abs(p.vx) + 30) * 0.9 : p.onGround ? 0 : clamp(p.vy / 900, -0.5, 0.6);
    this.rot += (targetRot - this.rot) * damp(10, dt);

    const tremble = p.danger > 0.55 ? (p.danger - 0.55) * 2.2 : 0;
    this.x = x + (tremble > 0 ? Math.sin(this.time * 70) * tremble : 0);
    this.y = y;
    this.inner.position.set(this.x, this.y + crouch * 6);
    this.inner.rotation = this.rot * (this.face >= 0 ? 1 : -1);
    this.inner.scale.set(
      (this.sx + breath + crouch * 0.5 + dashStretch + (p.swim ? clamp(speed / 500, 0, 0.16) : 0)) * (this.face >= 0 ? Math.max(0.25, this.face) : Math.min(-0.25, this.face)),
      this.sy - breath - crouch + airStretch - dashStretch * 0.4,
    );

    // Colour: dim blue-grey when spent, warm gold when shining.
    const frac = clamp(p.lumen / w.diff.lumenMax, 0, 1);
    const warmth = clamp(p.glow * 0.85 + frac * 0.3, 0, 1);
    const tint = mixColor(LIGHT.creatureDim, LIGHT.creatureWarm, warmth);
    const flicker = p.invuln > 0 ? 0.55 + 0.45 * Math.sin(this.time * 38) : 1;
    const fading = p.fadeT > 0 ? 0.5 + 0.5 * Math.sin(this.time * 12) : 1;
    const bodyAlpha = (p.hidden ? 0.5 : 1) * flicker * (p.status === 'alive' ? 1 : Math.max(0, 1 - p.statusT * 1.2));
    this.body.tint = tint;
    this.fin.tint = tint;
    this.inner.alpha = bodyAlpha;

    this.fin.position.set(-9, 1);
    this.fin.rotation = Math.sin(this.time * (5 + speed * 0.04)) * 0.35;

    // Eyes: blink, widen when afraid, look ahead.
    this.blink -= dt;
    if (this.blink < -0.12) this.blink = 2.2 + Math.random() * 3.2;
    const lid = this.blink < 0 ? 0.12 : 1;
    const wide = 1 + clamp(p.danger, 0, 1) * 0.3;
    const lookX = clamp(Math.abs(p.vx) / 150, 0, 1) * 1.2;
    const lookY = clamp(p.vy / 400, -1, 1) * 1.2;
    this.eyeA.position.set(4.5 + lookX, -2 + lookY);
    this.eyeB.position.set(9 + lookX, -1.5 + lookY);
    this.eyeA.scale.set(inv * wide, inv * wide * lid);
    this.eyeB.scale.set(inv * wide * 0.9, inv * wide * 0.9 * lid);

    // Antenna bulb: the visible seat of the glow.
    this.bulb.position.set(-1, -13 + Math.sin(this.time * 3.1) * 0.8);
    const bulbSize = 5 + p.glow * 7 + Math.sin(this.time * 6) * 0.6 * p.glow;
    this.bulb.scale.set(bulbSize / 24);
    this.bulb.tint = mixColor(0xcfe6f2, LIGHT.creatureCore, warmth);
    this.bulb.alpha = (0.45 + 0.55 * warmth) * fading;

    // Tail: follow-the-leader chain with a travelling wave.
    let lx = this.x - this.face * 9;
    let ly = this.y + 2 + crouch * 6;
    const wave = 0.6 + clamp(speed / 160, 0, 1) * 1.6;
    for (let i = 0; i < TAIL; i++) {
      let dx = this.tx[i] - lx;
      let dy = this.ty[i] - ly;
      // Tail hangs back and slightly down at rest.
      dx -= this.face * 14 * dt;
      dy += (p.swim ? 0 : 8) * dt;
      const d = Math.hypot(dx, dy) || 1;
      const seg = 3.6;
      this.tx[i] = lx + (dx / d) * seg;
      this.ty[i] = ly + (dy / d) * seg;
      const wig = Math.sin(this.time * (6 + speed * 0.03) - i * 0.9) * wave * (i / TAIL);
      const s = this.tail[i];
      s.position.set(this.tx[i], this.ty[i] + wig);
      const size = 9 - i * 1.15;
      s.scale.set(size / 22);
      s.tint = tint;
      s.alpha = bodyAlpha * (0.95 - i * 0.1);
      lx = this.tx[i];
      ly = this.ty[i];
    }

    // Halo: additive bloom around the creature.
    const radius = w.lightRadius;
    this.halo.position.set(this.x, this.y);
    this.halo.scale.set((radius * 1.5) / 128);
    this.halo.tint = mixColor(0x7fa8c8, LIGHT.creatureWarm, clamp(p.glow + 0.15, 0, 1));
    this.halo.alpha = (0.1 + 0.34 * p.glow + 0.05 * Math.sin(this.time * 4.2) * p.glow) * fading * (p.status === 'alive' ? 1 : Math.max(0, 1 - p.statusT));
  }
}
