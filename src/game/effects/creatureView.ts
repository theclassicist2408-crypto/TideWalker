import { Container, Graphics, type Sprite } from 'pixi.js';
import { LIGHT } from '../../assets/data/palettes';
import { P } from '../core/constants';
import { clamp, damp, lerp } from '../core/util';
import type { World } from '../core/world';
import { mixColor, type Gfx } from './gfx';

const SCARF = 6;
const TRAIL = 12;
/** Distance from the hand to the sword's tip, and where the visible edge starts. */
const BLADE = 30;
const BLADE_ROOT = 9;
/** Drawn size relative to the collision box: a little larger so the hero reads at phone size. */
const HERO_SCALE = 1.15;

/** Trail colour per sword: what the edge leaves in the air. */
const TRAIL_TINT: Record<string, number> = {
  tide: 0xbff4ff,
  ember: 0xffb070,
  storm: 0xd8e4ff,
  coral: 0xffb0cc,
  void: 0xc890ff,
  crown: 0xfff0b8,
};

interface Swing {
  /** Seconds since the swing began; negative when idle. */
  t: number;
  dur: number;
  a0: number;
  a1: number;
  big: boolean;
}

const easeOut = (k: number): number => 1 - (1 - k) * (1 - k) * (1 - k);

/**
 * The Tideborn: a small knight in a shell helm and tide-blue mantle, sword in hand. Every pose is
 * procedural: legs cycle with distance travelled, the scarf trails on a follow-the-leader chain,
 * and the sword arm sweeps through real arcs that leave a fading trail of light.
 */
export class CreatureView {
  readonly root = new Container();
  readonly halo: Sprite;
  /** Additive layer for the blade trail; the renderer puts it with the other glows. */
  readonly trail = new Graphics();
  private readonly inner = new Container();
  private readonly cloak: Sprite;
  private readonly helm: Sprite;
  private readonly footA: Sprite;
  private readonly footB: Sprite;
  private readonly hand: Sprite;
  private readonly sword: Sprite;
  private readonly swordGlow: Sprite;
  private readonly scarf: Sprite[] = [];
  private readonly sxs = new Float32Array(SCARF);
  private readonly sys = new Float32Array(SCARF);
  // Trail samples: hand and tip positions in world space, with their age.
  private readonly tbx = new Float32Array(TRAIL);
  private readonly tby = new Float32Array(TRAIL);
  private readonly ttx = new Float32Array(TRAIL);
  private readonly tty = new Float32Array(TRAIL);
  private readonly tage = new Float32Array(TRAIL).fill(9);
  private thead = 0;
  private readonly swing: Swing = { t: -1, dur: 0.2, a0: 0, a1: 0, big: false };
  private angle = 2.3;
  private sx = 1;
  private sy = 1;
  private svx = 0;
  private svy = 0;
  private face = 1;
  private stride = 0;
  private time = 0;
  private swordId = 'tide';
  x = 0;
  y = 0;

  constructor(private readonly gfx: Gfx) {
    this.halo = gfx.sprite('soft');
    this.halo.blendMode = 'add';
    this.trail.blendMode = 'add';
    for (let i = 0; i < SCARF; i++) {
      const seg = gfx.sprite('dot');
      this.scarf.push(seg);
      this.root.addChild(seg);
    }
    this.footB = gfx.sprite('heroFoot');
    this.cloak = gfx.sprite('heroCloak');
    this.footA = gfx.sprite('heroFoot');
    this.helm = gfx.sprite('heroHelm');
    this.sword = gfx.sprite('sword_tide', 0.5, 40 / 44);
    this.swordGlow = gfx.sprite('soft');
    this.swordGlow.blendMode = 'add';
    this.hand = gfx.sprite('heroHand');
    this.inner.addChild(this.footB, this.cloak, this.footA, this.helm, this.sword, this.swordGlow, this.hand);
    this.root.addChild(this.inner);
  }

  /** Kick the squash-and-stretch spring. */
  squash(x: number, y: number): void {
    this.sx = x;
    this.sy = y;
  }

  /** Which sword is drawn in hand (see `sword_*` in the atlas). */
  setSword(id: string): void {
    if (id === this.swordId) return;
    this.swordId = id;
    this.sword.texture = this.gfx.tex(`sword_${id}`);
  }

  /**
   * Starts a swing. `kind` is the strike: 0 cut, 1 up, 2 down, 3 back-cut, 4 combo finisher.
   * The cut falls from high behind to low in front; the back-cut sweeps back up; the finisher is
   * a full overhead arc with a longer, brighter blade.
   */
  startSwing(kind: number, big: boolean): void {
    const s = this.swing;
    s.t = 0;
    s.big = big || kind === 4;
    s.dur = big ? 0.26 : kind === 4 ? 0.24 : 0.16;
    if (kind === 1) {
      s.a0 = 1.5;
      s.a1 = -1.7;
    } else if (kind === 2) {
      s.a0 = 1.2;
      s.a1 = 4.1;
    } else if (big) {
      s.a0 = -2.3;
      s.a1 = 2.9;
    } else if (kind === 4) {
      s.a0 = -3.0;
      s.a1 = 3.3;
      this.sx = 1.25;
      this.sy = 0.85;
    } else if (kind === 3) {
      s.a0 = 2.5;
      s.a1 = -1.1;
      this.sx = 1.1;
    } else {
      s.a0 = -1.5;
      s.a1 = 2.6;
      this.sx = 1.12;
    }
  }

  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    for (let i = 0; i < SCARF; i++) {
      this.sxs[i] = x - i * 3;
      this.sys[i] = y - 6;
    }
    this.tage.fill(9);
    this.swing.t = -1;
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

    // Squash and stretch: damped spring back to rest.
    this.svx += ((1 - this.sx) * 190 - this.svx * 15) * dt;
    this.svy += ((1 - this.sy) * 190 - this.svy * 15) * dt;
    this.sx += this.svx * dt;
    this.sy += this.svy * dt;

    const grounded = p.onGround && !p.swim;
    const running = grounded && Math.abs(p.vx) > 14;
    if (running) this.stride += Math.abs(p.vx) * dt * 0.11;
    if (running) y -= Math.abs(Math.sin(this.stride)) * 1.6;
    const crouch = p.healT > 0 ? 1 : 0;
    const breath = grounded && !running ? Math.sin(this.time * 2.4) * 0.6 : 0;

    // Turn quickly but not instantly, so a change of direction reads as a turn.
    const want = p.facing >= 0 ? 1 : -1;
    this.face += (want - this.face) * damp(30, dt);
    const f = this.face >= 0 ? 1 : -1;
    const flip = Math.max(0.3, Math.abs(this.face));

    this.x = x;
    this.y = y;
    const lean = p.dashT > 0 ? 0.32 : running ? clamp(Math.abs(p.vx) / 900, 0, 0.18) : 0;
    const swimTilt = p.swim ? clamp(Math.atan2(p.vy, Math.abs(p.vx) + 40), -0.9, 0.9) : 0;
    // Lifted so the scaled feet still meet the ground at the collision box's base.
    this.inner.position.set(x, y + crouch * 3 - (HERO_SCALE - 1) * 8);
    this.inner.rotation = (lean + swimTilt) * f;
    this.inner.scale.set(this.sx * f * flip * HERO_SCALE, this.sy * HERO_SCALE);

    // Legs: a long two-step stride when running (feet lift and swing, toes tilt), tucked on
    // the way up, reaching down on the way down, braced against a wall, kneeling to heal.
    const fa = this.footA;
    const fb = this.footB;
    if (running) {
      const sn = Math.sin(this.stride);
      const cs = Math.cos(this.stride);
      const reach = 5.5;
      fa.position.set(1 + sn * reach, 8 - Math.max(0, cs) * 3.6);
      fb.position.set(-1 - sn * reach, 8 - Math.max(0, -cs) * 3.6);
      fa.rotation = -sn * 0.45;
      fb.rotation = sn * 0.45;
    } else if (p.sliding) {
      fa.position.set(5, 3);
      fb.position.set(4, 8);
      fa.rotation = fb.rotation = -1.2;
    } else if (!grounded && !p.swim) {
      const rising = p.vy < -60;
      const k = clamp(p.vy / 600, -1, 1);
      fa.position.set(rising ? 3 : 2, rising ? 4 : 8 + k * 1.5);
      fb.position.set(rising ? -2 : -3, rising ? 6 : 7 + k * 1.5);
      fa.rotation = rising ? -0.5 : 0.25;
      fb.rotation = rising ? 0.5 : -0.25;
    } else if (p.swim) {
      const kick = Math.sin(this.time * 9) * 3;
      fa.position.set(-5 + kick * 0.3, 5 + kick);
      fb.position.set(-6 - kick * 0.3, 6 - kick);
      fa.rotation = fb.rotation = 0;
    } else {
      fa.position.set(3, 8 + crouch * 0.5);
      fb.position.set(crouch > 0 ? -5 : -2.5, 8);
      fa.rotation = 0;
      fb.rotation = crouch > 0 ? 0.8 : 0;
    }
    // Cloak: streams back with speed, lifts when falling, spreads wide in a glide.
    const stream = clamp(Math.abs(p.vx) / 500, 0, 0.35);
    const lift = !grounded && p.vy > 80 ? clamp(p.vy / 900, 0, 0.25) : 0;
    this.cloak.position.set(-stream * 3, -1 + breath * 0.5 + crouch * 2 - lift * 4);
    this.cloak.rotation = -clamp(p.vy / 1600, -0.1, 0.15) - stream * 0.5 + (running ? Math.sin(this.stride * 2) * 0.04 : 0);
    this.cloak.scale.set(inv * (p.gliding ? 1.5 : 1 + stream * 0.3), inv * (p.gliding ? 0.8 : 1 - lift * 0.3));
    // Helm: looks where it is going; glances about when standing still.
    const look = grounded && !running && p.healT <= 0 ? Math.sin(this.time * 0.7) * Math.max(0, Math.sin(this.time * 0.23)) * 0.12 : 0;
    this.helm.position.set(1 + stream * 2, -12 + breath + crouch * 3);
    this.helm.rotation = look + (running ? 0.08 : 0) + (p.vy < -200 && !grounded ? -0.1 : 0) + (p.vy > 300 ? 0.12 : 0);

    // Sword arm: a rest pose for every state, overridden by an active swing.
    let rest: number;
    if (p.healT > 0) rest = Math.PI;
    else if (p.chargeT > 0.12) rest = -2.1 + Math.sin(this.time * 50) * 0.04;
    else if (p.sliding) rest = -0.5;
    else if (p.dashT > 0) rest = 1.75;
    else if (p.swim) rest = 1.6;
    else if (!grounded) rest = p.vy < 0 ? 0.55 : 1.1;
    else if (running) rest = -2.05 + Math.sin(this.stride) * 0.18;
    else rest = 1.4 + breath * 0.05;

    const sw = this.swing;
    let swinging = false;
    if (sw.t >= 0) {
      sw.t += dt;
      const k = sw.t / sw.dur;
      if (k < 1) {
        this.angle = lerp(sw.a0, sw.a1, easeOut(k));
        swinging = true;
      } else {
        sw.t = -1;
      }
    }
    if (!swinging) this.angle += (rest - this.angle) * damp(14, dt);

    const shoulderX = 2.5;
    const shoulderY = -3 + crouch * 2;
    const reach = swinging ? 6 : 4;
    const dx = Math.sin(this.angle);
    const dy = -Math.cos(this.angle);
    const hx = shoulderX + dx * reach;
    const hy = shoulderY + dy * reach;
    this.hand.position.set(hx, hy);
    this.sword.position.set(hx, hy);
    this.sword.rotation = this.angle;
    const bigBlade = sw.big && swinging ? 1.15 : 1;
    this.sword.scale.set(inv, inv * bigBlade);

    // Charging: light gathers along the blade, brightest when the strike is ready.
    const ready = p.chargeT >= P.chargeTime;
    const charge = clamp(p.chargeT / P.chargeTime, 0, 1);
    this.swordGlow.visible = p.chargeT > 0.12 || p.emberT > 0;
    this.swordGlow.position.set(hx + dx * BLADE * 0.6, hy + dy * BLADE * 0.6);
    this.swordGlow.scale.set(((ready ? 46 : 20 + charge * 20) + Math.sin(this.time * 30) * 3) / 128);
    this.swordGlow.tint = p.emberT > 0 ? 0xffa060 : LIGHT.creatureWarm;
    this.swordGlow.alpha = ready ? 0.9 : 0.4 + charge * 0.3;
    this.sword.tint = p.emberT > 0 ? 0xffc890 : ready ? 0xfff4d0 : 0xffffff;

    // Whole-body light: warmer with more Lumen, flickering while invulnerable.
    const frac = clamp(p.lumen / w.load.lumenMax, 0, 1);
    const warmth = clamp(p.glow * 0.85 + frac * 0.3, 0, 1);
    const flicker = p.invuln > 0 ? 0.55 + 0.45 * Math.sin(this.time * 38) : 1;
    const fading = p.veilT > 0 ? 0.45 : 1;
    const bodyAlpha = (p.veilT > 0 ? 0.6 : 1) * flicker * (p.status === 'alive' ? 1 : Math.max(0, 1 - p.statusT * 1.2));
    this.inner.alpha = bodyAlpha;
    const hurt = p.invuln > P.invuln - 0.15;
    const tint = hurt ? 0xffb0c8 : 0xffffff;
    this.cloak.tint = tint;
    this.helm.tint = tint;

    this.updateTrail(sw, swinging, f, dt);
    this.updateScarf(p.swim, speed, f, warmth, bodyAlpha, crouch, dt);

    const radius = w.lightRadius;
    this.halo.position.set(this.x, this.y - 4);
    this.halo.scale.set((radius * 1.5) / 128);
    this.halo.tint = mixColor(0x7fa8c8, LIGHT.creatureWarm, clamp(p.glow + 0.15, 0, 1));
    this.halo.alpha = (0.1 + 0.34 * p.glow + 0.05 * Math.sin(this.time * 4.2) * p.glow) * fading * (p.status === 'alive' ? 1 : Math.max(0, 1 - p.statusT));
  }

  /** Records where the blade is while it swings and draws the fading ribbon it leaves. */
  private updateTrail(sw: Swing, swinging: boolean, f: number, dt: number): void {
    for (let i = 0; i < TRAIL; i++) this.tage[i] += dt;
    if (swinging) {
      const len = BLADE * (sw.big ? 1.25 : 1);
      const dx = Math.sin(this.angle);
      const dy = -Math.cos(this.angle);
      const i = this.thead;
      this.toWorld(this.hand.x + dx * BLADE_ROOT, this.hand.y + dy * BLADE_ROOT, f, this.tbx, this.tby, i);
      this.toWorld(this.hand.x + dx * len, this.hand.y + dy * len, f, this.ttx, this.tty, i);
      this.tage[i] = 0;
      this.thead = (i + 1) % TRAIL;
    }
    const g = this.trail;
    g.clear();
    const life = 0.16;
    const tint = TRAIL_TINT[this.swordId] ?? LIGHT.blade;
    // Walk the ring from newest to oldest, joining consecutive samples into quads.
    for (let n = 0; n < TRAIL - 1; n++) {
      const a = (this.thead - 1 - n + TRAIL * 2) % TRAIL;
      const b = (a - 1 + TRAIL) % TRAIL;
      const age = this.tage[a];
      if (age > life || this.tage[b] > life + 0.05) break;
      const k = 1 - age / life;
      g.moveTo(this.tbx[a], this.tby[a])
        .lineTo(this.ttx[a], this.tty[a])
        .lineTo(this.ttx[b], this.tty[b])
        .lineTo(this.tbx[b], this.tby[b])
        .closePath()
        .fill({ color: tint, alpha: 0.55 * k * (sw.big ? 1.3 : 1) });
      g.moveTo(this.ttx[a], this.tty[a]).lineTo(this.ttx[b], this.tty[b]).stroke({ width: 1.6, color: 0xffffff, alpha: 0.85 * k });
    }
  }

  /** Maps a point in the hero's local frame to world space, into slot `i` of the given arrays. */
  private toWorld(lx: number, ly: number, f: number, outX: Float32Array, outY: Float32Array, i: number): void {
    const r = this.inner.rotation;
    const fx = lx * f * this.sx * HERO_SCALE;
    const fy = ly * this.sy * HERO_SCALE;
    outX[i] = this.inner.x + fx * Math.cos(r) - fy * Math.sin(r);
    outY[i] = this.inner.y + fx * Math.sin(r) + fy * Math.cos(r);
  }

  /** The scarf: a follow-the-leader chain from the neck, warm while there is Lumen to spare. */
  private updateScarf(swim: boolean, speed: number, f: number, warmth: number, alpha: number, crouch: number, dt: number): void {
    let lx = this.x - f * 3;
    let ly = this.y - 6 + crouch * 3;
    const wave = 0.5 + clamp(speed / 200, 0, 1) * 1.4;
    const tint = mixColor(0x8fb8c8, 0xffc070, warmth);
    for (let i = 0; i < SCARF; i++) {
      let dx = this.sxs[i] - lx;
      let dy = this.sys[i] - ly;
      dx -= f * 16 * dt;
      dy += (swim ? 0 : 10) * dt;
      const d = Math.hypot(dx, dy) || 1;
      const seg = 3.2;
      this.sxs[i] = lx + (dx / d) * seg;
      this.sys[i] = ly + (dy / d) * seg;
      const wig = Math.sin(this.time * (7 + speed * 0.03) - i * 0.9) * wave * (i / SCARF);
      const s = this.scarf[i];
      s.position.set(this.sxs[i], this.sys[i] + wig);
      s.scale.set((6 - i * 0.6) / 22);
      s.tint = tint;
      s.alpha = alpha * (0.95 - i * 0.1);
      lx = this.sxs[i];
      ly = this.sys[i];
    }
  }
}
