import { Container, type Sprite } from 'pixi.js';
import { LIGHT, type Palette } from '../../assets/data/palettes';
import { clamp } from '../core/util';
import type { GateDef } from '../core/types';
import type { World } from '../core/world';
import { mixColor, type Gfx } from './gfx';
import type { Lightmap } from './lightmap';
import type { ParticleLayer } from './particles';
import { WaterView } from './terrainView';

/**
 * Sprites for every prop in a level. Built once per level (and again when Drift Mode streams in
 * a new chunk); updated every frame with simple culling.
 */
/** Which painted frame stands for each kind of gate. */
const gateFrame = (kind: GateDef['kind']): string => (kind === 'bloom' ? 'bloom' : kind === 'arena' ? 'ward' : 'driftwood');

export class EntityLayer {
  readonly back = new Container();
  readonly mid = new Container();
  readonly glow = new Container();
  readonly front = new Container();
  private platforms: Sprite[] = [];
  private kelp: { s: Sprite; x: number; phase: number; zone: number }[] = [];
  private pools: Sprite[] = [];
  private plantStalks: Sprite[] = [];
  private plantBulbs: Sprite[] = [];
  private fireflies: Sprite[] = [];
  private urchins: Sprite[] = [];
  private geysers: Sprite[] = [];
  private gates: Sprite[] = [];
  private stones: Sprite[] = [];
  private shells: Sprite[] = [];
  private shellGlints: Sprite[] = [];
  private lanterns: Sprite[] = [];
  private flames: Sprite[] = [];
  private kin: Sprite[] = [];
  private kinHalo: Sprite[] = [];
  private beacon: Sprite | null = null;
  private world: World | null = null;
  private count = -1;
  private emitT = 0;

  constructor(private readonly gfx: Gfx) {}

  /** Rebuilds if the world's entity lists changed (new level or a new World of the same level). */
  sync(w: World): void {
    if (w === this.world && w.platforms.length + w.shells.length === this.count) return;
    this.world = w;
    this.count = w.platforms.length + w.shells.length;
    this.build(w);
  }

  private build(w: World): void {
    const gfx = this.gfx;
    for (const c of [this.back, this.mid, this.glow, this.front]) c.removeChildren().forEach((ch) => ch.destroy());
    const add = (list: Sprite[], s: Sprite, layer: Container): Sprite => {
      list.push(s);
      layer.addChild(s);
      return s;
    };
    this.platforms = [];
    this.kelp = [];
    this.pools = [];
    this.plantStalks = [];
    this.plantBulbs = [];
    this.fireflies = [];
    this.urchins = [];
    this.geysers = [];
    this.gates = [];
    this.stones = [];
    this.shells = [];
    this.shellGlints = [];
    this.lanterns = [];
    this.flames = [];
    this.kin = [];
    this.kinHalo = [];

    for (const p of w.level.pools) {
      const s = add(this.pools, gfx.sprite('soft'), this.glow);
      s.blendMode = 'add';
      s.position.set(p.x, p.y);
      s.tint = LIGHT.pool;
    }
    w.level.kelp.forEach((k, zone) => {
      const n = Math.max(3, Math.round(k.w / 9));
      for (let i = 0; i < n; i++) {
        const s = gfx.sprite('kelpBlade', 0.5, 1);
        const x = k.x + ((i + 0.5) / n) * k.w + Math.sin(i * 12.9) * 3;
        s.position.set(x, k.y + 3);
        const tall = k.h * (0.75 + 0.35 * Math.abs(Math.sin(i * 7.3)));
        s.scale.set(gfx.inv * (0.9 + 0.5 * Math.abs(Math.cos(i * 3.1))), (tall / 96) * gfx.inv);
        s.alpha = 0.92;
        // Half the fronds stand in front of the creature so it truly hides inside.
        (i % 2 === 0 ? this.back : this.front).addChild(s);
        this.kelp.push({ s, x, phase: i * 1.7 + k.x * 0.01, zone });
      }
    });
    for (const p of w.platforms) {
      const name = p.kind === 'moonglass' ? 'moonglass' : p.kind === 'crumble' ? 'crumble' : 'rock';
      const s = add(this.platforms, gfx.sprite(name, 0, 0), this.mid);
      const size = gfx.size(name);
      s.position.set(p.x - 2, p.y - 3);
      s.scale.set(((p.w + 4) / size.w) * gfx.inv, gfx.inv);
      if (p.kind === 'moonglass') s.blendMode = 'add';
    }
    for (const p of w.plants) {
      const st = add(this.plantStalks, gfx.sprite('plantStalk', 0.5, 1), this.back);
      st.position.set(p.x, p.y + 2);
      const b = add(this.plantBulbs, gfx.sprite('plantBulbs', 0.5, 1), this.glow);
      b.position.set(p.x, p.y + 2);
      b.blendMode = 'add';
      b.tint = LIGHT.plant;
    }
    for (const f of w.fireflies) {
      const s = add(this.fireflies, gfx.sprite('dot'), this.glow);
      s.blendMode = 'add';
      s.tint = LIGHT.firefly;
      s.position.set(f.x, f.y);
    }
    for (const u of w.level.urchins) {
      const s = add(this.urchins, gfx.sprite('urchin'), this.mid);
      s.position.set(u.x, u.y);
      s.scale.set((u.r / 9) * gfx.inv);
    }
    for (const g of w.geysers) {
      const s = add(this.geysers, gfx.sprite('pebble', 0.5, 1), this.mid);
      s.position.set(g.x, g.y + 3);
      s.tint = 0xcfe0ff;
    }
    for (const g of w.gates) {
      const s = add(this.gates, gfx.sprite(gateFrame(g.kind), 0.5, 1), this.mid);
      s.position.set(g.x, g.y + 2);
    }
    for (const st of w.stones) {
      const s = add(this.stones, gfx.sprite('stone'), this.mid);
      s.position.set(st.x, st.y);
    }
    for (const sh of w.shells) {
      const s = add(this.shells, gfx.sprite('shell'), this.mid);
      s.position.set(sh.x, sh.y);
      const gl = add(this.shellGlints, gfx.sprite('spark'), this.glow);
      gl.blendMode = 'add';
      gl.tint = LIGHT.shell;
      gl.position.set(sh.x + 4, sh.y - 5);
    }
    for (const c of w.checkpoints) {
      const s = add(this.lanterns, gfx.sprite('lantern', 0.5, 1), this.back);
      s.position.set(c.x, c.y + 11);
      const f = add(this.flames, gfx.sprite('soft'), this.glow);
      f.blendMode = 'add';
      f.tint = LIGHT.lantern;
      f.position.set(c.x, c.y - 28);
    }
    for (const k of w.kin) {
      const h = add(this.kinHalo, gfx.sprite('soft'), this.glow);
      h.blendMode = 'add';
      h.tint = LIGHT.kin;
      const s = add(this.kin, gfx.sprite('body'), this.mid);
      s.position.set(k.x, k.y);
      s.scale.set(gfx.inv * 0.62);
    }
    this.beacon = null;
    if (w.mode !== 'drift' && w.mode !== 'title') {
      const b = gfx.sprite('soft', 0.5, 0.92);
      b.blendMode = 'add';
      b.tint = LIGHT.lantern;
      b.position.set(w.level.goalX + 30, w.ground.at(w.level.goalX + 30));
      b.scale.set(0.9, 4.2);
      b.alpha = 0.38;
      this.glow.addChild(b);
      this.beacon = b;
    }
  }

  update(w: World, pal: Palette, t: number, dt: number, left: number, right: number, lights: Lightmap, motes: ParticleLayer, bubbles: ParticleLayer, calm: number): void {
    const inv = this.gfx.inv;
    const p = w.player;
    const vis = (x: number, m = 80): boolean => x > left - m && x < right + m;
    const sway = 0.2 + 0.8 * calm;
    this.emitT += dt;
    const tick = this.emitT > 0.09;
    if (tick) this.emitT = 0;

    for (let i = 0; i < this.pools.length; i++) {
      const d = w.level.pools[i];
      const s = this.pools[i];
      s.visible = vis(d.x, d.r + 60);
      if (!s.visible) continue;
      const breathe = 1 + Math.sin(t * 1.3 + i) * 0.06;
      s.scale.set(((d.r * 3.2) / 128) * breathe, ((d.r * 1.5) / 128) * breathe);
      s.alpha = 0.42 + 0.08 * Math.sin(t * 2.1 + i * 2);
      lights.add(d.x, d.y - 6, d.r * 2.2, LIGHT.pool, 0.75);
      if (tick && Math.random() < 0.25) {
        motes.spawn({ x: d.x + (Math.random() - 0.5) * d.r * 1.6, y: d.y - Math.random() * 10, vy: -14 - Math.random() * 14, ttl: 1.6, s0: 3, s1: 1, alpha: 0.7, tint: LIGHT.pool });
      }
    }

    for (let i = 0; i < this.kelp.length; i++) {
      const k = this.kelp[i];
      k.s.visible = vis(k.x, 40);
      if (!k.s.visible) continue;
      const zone = w.level.kelp[k.zone];
      const inside = p.x > zone.x - 8 && p.x < zone.x + zone.w + 8 && Math.abs(p.x - k.x) < 16 && p.y > zone.y - zone.h;
      const brush = inside ? clamp(p.vx / 160, -1, 1) * 0.35 : 0;
      k.s.rotation = (Math.sin(t * 1.25 + k.phase) * 0.11 + Math.sin(t * 0.6 + k.phase * 1.7) * 0.05) * sway + brush;
    }

    for (let i = 0; i < this.platforms.length; i++) {
      const d = w.platforms[i];
      const s = this.platforms[i];
      s.visible = vis(d.x + d.w / 2, d.w / 2 + 40);
      if (!s.visible) continue;
      if (d.kind === 'moonglass') {
        // Unlit: the faintest outline, so careful eyes can still find the route.
        s.alpha = 0.07 + d.lit * 0.9 + (d.lit > 0 ? 0.06 * Math.sin(t * 9 + i) : 0);
        if (d.lit > 0.2) lights.add(d.x + d.w / 2, d.y, d.w * 0.9 + 30, LIGHT.moonglass, 0.5 * d.lit);
      } else if (d.kind === 'crumble') {
        const shaking = d.timer >= 0;
        s.position.set(d.x - 2 + (shaking ? Math.sin(t * 70) * 1.4 : 0), d.y - 3);
        s.alpha = d.fallen > 0 ? clamp(1 - (3.5 - d.fallen) * 3, 0, 1) + clamp(1 - d.fallen * 2.5, 0, 1) * 0.5 : 1;
      }
    }

    for (let i = 0; i < this.plantBulbs.length; i++) {
      const d = w.plants[i];
      const b = this.plantBulbs[i];
      const on = vis(d.x);
      b.visible = on;
      this.plantStalks[i].visible = on;
      if (!on) continue;
      const ready = d.cd <= 0;
      const swayA = Math.sin(t * 1.4 + i * 2.3) * 0.06 * sway;
      b.rotation = swayA;
      this.plantStalks[i].rotation = swayA;
      b.alpha = ready ? 0.85 + 0.15 * Math.sin(t * 2.4 + i) : 0.12 + 0.2 * clamp(1 - d.cd / 14, 0, 1);
      if (ready) lights.add(d.x, d.y - 22, 62, LIGHT.plant, 0.6);
    }

    for (let i = 0; i < this.fireflies.length; i++) {
      const d = w.fireflies[i];
      const s = this.fireflies[i];
      s.visible = !d.taken && vis(d.x);
      if (!s.visible) continue;
      const ox = Math.sin(t * 1.1 + i * 1.9) * 7 + Math.sin(t * 2.7 + i) * 2.5;
      const oy = Math.cos(t * 1.3 + i * 2.6) * 5;
      s.position.set(d.x + ox, d.y + oy);
      const tw = 0.6 + 0.4 * Math.sin(t * 5 + i * 3.3);
      s.scale.set((5 + tw * 2.5) / 16);
      s.alpha = 0.6 + 0.4 * tw;
      lights.add(d.x + ox, d.y + oy, 30, LIGHT.firefly, 0.45);
    }

    for (let i = 0; i < this.urchins.length; i++) {
      const d = w.level.urchins[i];
      const s = this.urchins[i];
      s.visible = vis(d.x);
      if (s.visible) s.rotation = Math.sin(t * 0.8 + i) * 0.12;
    }

    for (let i = 0; i < this.geysers.length; i++) {
      const d = w.geysers[i];
      this.geysers[i].visible = vis(d.x);
      if (!vis(d.x, 20) || !tick) continue;
      if (d.phaseNow === 2) {
        for (let k = 0; k < 3; k++) {
          motes.spawn({ x: d.x + (Math.random() - 0.5) * 14, y: d.y - 4, vx: (Math.random() - 0.5) * 40, vy: -d.power * (0.45 + Math.random() * 0.4), gravity: 600, ttl: 0.55, s0: 9, s1: 3, alpha: 0.7, tint: 0xd8f0ff });
        }
      } else if (d.phaseNow > 0) {
        bubbles.spawn({ frame: 'bubble', x: d.x + (Math.random() - 0.5) * 16, y: d.y - 2, vy: -30 - 80 * d.phaseNow, ttl: 0.7, s0: 5, s1: 8, alpha: 0.5 + 0.4 * d.phaseNow });
      }
    }

    for (let i = 0; i < this.gates.length; i++) {
      const d = w.gates[i];
      const s = this.gates[i];
      s.visible = vis(d.x);
      if (!s.visible) continue;
      const open = d.kind === 'tide' ? d.prog : d.open ? 1 : 0;
      const size = this.gfx.size(gateFrame(d.kind));
      if (d.kind === 'arena') {
        // A ward is light: it is there while the fight lasts and gone when it ends, with a shimmer.
        s.visible = !d.open;
        if (!s.visible) continue;
        s.scale.set(inv * (1 + Math.sin(t * 9 + d.x) * 0.08), (d.h / size.h) * inv);
        s.alpha = 0.75 + Math.sin(t * 5) * 0.2;
        s.tint = 0xffffff;
        lights.add(d.x, d.y - 60, 70, LIGHT.danger, 0.35);
        continue;
      }
      const grow = d.kind === 'bloom' && !d.open ? 1 + d.prog * 0.12 : 1;
      s.scale.set(inv * (1 - open * 0.75) * grow, (d.h / size.h) * inv * (1 - open * 0.86));
      s.alpha = 1 - open * 0.55;
      s.tint = d.kind === 'bloom' ? mixColor(0xffffff, 0xffe0c0, d.prog) : 0xffffff;
      if (d.kind === 'bloom' && d.prog > 0.02 && !d.open) lights.add(d.x, d.y - d.h / 2, 60, LIGHT.shell, d.prog * 0.6);
    }

    for (let i = 0; i < this.stones.length; i++) {
      const d = w.stones[i];
      const s = this.stones[i];
      s.visible = vis(d.x);
      if (!s.visible) continue;
      const wobble = d.mode === 'warn' ? Math.sin(t * 55) * 1.6 : 0;
      s.position.set(d.x + wobble, d.cy);
      s.rotation = d.mode === 'fall' ? s.rotation + dt * 3 : d.mode === 'rest' ? 0.3 : wobble * 0.05;
      if (d.mode === 'warn' && tick) motes.spawn({ x: d.x + (Math.random() - 0.5) * 16, y: d.y + 10, vy: 40, gravity: 200, ttl: 0.5, s0: 2.5, s1: 1, alpha: 0.6, tint: 0xcabfff });
    }

    for (let i = 0; i < this.shells.length; i++) {
      const d = w.shells[i];
      const s = this.shells[i];
      const g = this.shellGlints[i];
      const on = !d.taken && vis(d.x);
      s.visible = on;
      g.visible = on;
      if (!on) continue;
      const shown = d.revealed ? 1 : 0.0;
      s.alpha += ((d.owned ? 0.45 : 1) * shown - s.alpha) * Math.min(1, dt * 4);
      s.position.set(d.x, d.y + Math.sin(t * 1.6 + i) * 2);
      s.rotation = Math.sin(t * 0.9 + i) * 0.12;
      // Hidden shells give themselves away with a rare, faint glint.
      const glint = d.revealed ? 0.5 + 0.5 * Math.sin(t * 3 + i) : Math.max(0, Math.sin(t * 0.9 + i * 2.1) - 0.93) * 9;
      g.alpha = glint * (d.owned ? 0.4 : 0.9);
      g.scale.set((10 + glint * 8) / 64);
      g.rotation = t * 0.6;
      if (d.revealed) lights.add(d.x, d.y, 40, LIGHT.shell, 0.4);
    }

    for (let i = 0; i < this.lanterns.length; i++) {
      const d = w.checkpoints[i];
      const f = this.flames[i];
      const on = vis(d.x);
      this.lanterns[i].visible = on;
      f.visible = on;
      if (!on) continue;
      const lit = d.lit ? 1 : 0;
      f.alpha += ((lit ? 0.85 + 0.12 * Math.sin(t * 7 + i) : 0.08) - f.alpha) * Math.min(1, dt * 3);
      f.scale.set((lit ? 44 + Math.sin(t * 5 + i) * 3 : 16) / 128);
      if (lit) lights.add(d.x, d.y - 26, 120, LIGHT.lantern, 0.85);
    }

    for (let i = 0; i < this.kin.length; i++) {
      const d = w.kin[i];
      const s = this.kin[i];
      const h = this.kinHalo[i];
      const on = !d.gone && vis(d.cx, 120);
      s.visible = on;
      h.visible = on;
      if (!on) continue;
      const bob = d.awake ? 0 : Math.sin(t * 1.2 + i * 1.3) * 2.5;
      const fade = d.flee ? clamp(1 - (d.life - 3.5) / 2.5, 0, 1) : 1;
      s.position.set(d.cx, d.cy + bob);
      const dir = d.awake ? (d.vx >= 0 ? 1 : -1) : i % 2 === 0 ? 1 : -1;
      s.scale.set(inv * 0.62 * dir, inv * 0.62);
      s.tint = d.awake ? LIGHT.kin : 0x6f8496;
      s.alpha = (d.awake ? 1 : 0.5) * fade;
      h.position.set(d.cx, d.cy + bob);
      h.scale.set((d.awake ? 44 + Math.sin(t * 4 + i) * 4 : 22) / 128);
      h.alpha = (d.awake ? 0.3 : 0.12 + 0.06 * Math.sin(t * 2 + i)) * fade;
      if (d.awake) lights.add(d.cx, d.cy, 46, LIGHT.kin, 0.32 * fade);
      else lights.add(d.cx, d.cy, 26, LIGHT.kin, 0.2);
    }

    if (this.beacon) {
      const bx = w.level.goalX + 30;
      this.beacon.visible = vis(bx, 200);
      if (this.beacon.visible) {
        this.beacon.alpha = 0.34 + 0.08 * Math.sin(t * 1.7);
        lights.add(bx, w.ground.at(bx) - 60, 190, LIGHT.lantern, 0.8);
      }
    }

    // Currents: streaks that show which way the water wants to carry things.
    if (tick) {
      for (let i = 0; i < w.currents.length; i++) {
        const c = w.currents[i];
        if (Math.abs(c.power) < 0.05 || !vis(c.x + c.w / 2, c.w / 2 + 40)) continue;
        if (Math.random() > 0.55) continue;
        const x = c.x + Math.random() * c.w;
        const y = c.y + Math.random() * c.h;
        if (y < WaterView.surface(x, w.waterAt(x), t) + 4) continue;
        const tint = c.safe ? LIGHT.safeCurrent : 0xb8b0e0;
        if (c.radial) {
          const cx = c.x + c.w / 2;
          const cy = c.y + c.h / 2;
          const a = Math.atan2(cy - y, cx - x) + 1.1;
          const sp = Math.abs(c.fx) * 0.12;
          bubbles.spawn({ frame: 'streak', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ttl: 0.9, s0: 5, s1: 5, alpha: 0.45, tint, rotation: a + Math.PI / 2 });
        } else {
          const sp = 0.16 * c.power;
          bubbles.spawn({ frame: 'streak', x, y, vx: c.fx * sp, vy: c.fy * sp, ttl: 1, s0: 5, s1: 5, alpha: c.safe ? 0.7 : 0.4, tint, rotation: Math.atan2(c.fy * c.power, c.fx * c.power) + Math.PI / 2 });
        }
        if (c.safe && Math.random() < 0.3) lights.add(x, y, 50, LIGHT.safeCurrent, 0.3);
      }
    }
    void pal;
  }
}
