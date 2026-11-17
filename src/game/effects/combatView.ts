import { Container, Graphics, type Sprite } from 'pixi.js';
import { LIGHT, type Palette } from '../../assets/data/palettes';
import { clamp, lerp } from '../core/util';
import type { World } from '../core/world';
import { ENEMY } from '../entities/enemies';
import { mixColor, type Gfx } from './gfx';
import type { Lightmap } from './lightmap';

const MAX_SHOTS = 96;

/** Everything hostile: foes, guardians, their shots and warnings, plus blocks, spikes and shrines. */
export class CombatLayer {
  readonly back = new Container();
  readonly mid = new Container();
  readonly glow = new Container();
  readonly zones = new Graphics();
  private readonly solids = new Graphics();
  private readonly foes: { body: Sprite; eye: Sprite }[] = [];
  private readonly shots: Sprite[] = [];
  private readonly shrines: { stone: Sprite; light: Sprite }[] = [];
  private boss: Sprite;
  private aura: Sprite;
  private world: World | null = null;
  private broken = -1;
  /** Strongest off-screen or wound-up threat this frame, and which side it is on. */
  threat = 0;
  threatSide = 0;

  constructor(private readonly gfx: Gfx) {
    this.back.addChild(this.solids);
    this.aura = gfx.sprite('soft');
    this.aura.blendMode = 'add';
    this.aura.visible = false;
    this.boss = gfx.sprite('boss0');
    this.boss.visible = false;
    this.mid.addChild(this.boss);
    this.glow.addChild(this.aura);
    for (let i = 0; i < MAX_SHOTS; i++) {
      const s = gfx.sprite('soft');
      s.blendMode = 'add';
      s.visible = false;
      this.shots.push(s);
      this.glow.addChild(s);
    }
  }

  private drawSolids(w: World, pal: Palette): void {
    const g = this.solids;
    g.clear();
    for (const b of w.blocks) {
      if (b.broken) continue;
      const cracked = b.kind === 'cracked';
      g.rect(b.x, b.y, b.w, b.h).fill(cracked ? mixColor(pal.ground, 0xd8b0a0, 0.35) : pal.ground);
      g.rect(b.x, b.y, b.w, 5).fill(mixColor(pal.ground, pal.rim, 0.45));
      g.rect(b.x, b.y, b.w, b.h).stroke({ width: 1.6, color: pal.rim, alpha: 0.55 });
      if (cracked) {
        // Fracture lines: this wall can be broken by a heavy blow.
        for (let y = b.y + 14; y < b.y + b.h - 8; y += 26) {
          g.moveTo(b.x + 3, y).lineTo(b.x + b.w * 0.5, y + 9).lineTo(b.x + b.w - 3, y - 2);
        }
        g.stroke({ width: 1.4, color: 0xffe0c8, alpha: 0.7 });
      }
    }
    for (const s of w.level.spikes) {
      for (let x = s.x; x < s.x + s.w - 1; x += 10) {
        g.poly([x, s.y + s.h, x + 5, s.y - 4, x + 10, s.y + s.h]).fill(0x7a5298);
        g.poly([x + 3, s.y + s.h, x + 5, s.y - 4, x + 6, s.y + s.h]).fill(0xe8c8f4);
      }
    }
  }

  setWorld(w: World, pal: Palette): void {
    this.world = w;
    this.broken = -1;
    for (const s of this.shrines) {
      s.stone.destroy();
      s.light.destroy();
    }
    this.shrines.length = 0;
    for (const g of w.grants) {
      const stone = this.gfx.sprite('shrine', 0.5, 1);
      stone.position.set(g.x, g.y + 18);
      const light = this.gfx.sprite('soft');
      light.blendMode = 'add';
      light.tint = LIGHT.lantern;
      light.position.set(g.x, g.y - 12);
      this.back.addChild(stone);
      this.glow.addChild(light);
      this.shrines.push({ stone, light });
    }
    this.drawSolids(w, pal);
  }

  update(w: World, pal: Palette, alpha: number, t: number, left: number, right: number, top: number, bottom: number, lights: Lightmap): void {
    const gfx = this.gfx;
    const inv = gfx.inv;
    const p = w.player;
    if (w !== this.world) this.setWorld(w, pal);
    let broken = 0;
    for (const b of w.blocks) if (b.broken) broken++;
    if (broken !== this.broken) {
      this.broken = broken;
      this.drawSolids(w, pal);
    }
    this.threat = 0;
    this.threatSide = 0;

    for (let i = 0; i < this.shrines.length; i++) {
      const g = w.grants[i];
      const s = this.shrines[i];
      const ready = !g.taken && (g.after === undefined || w.defeated.has(g.after));
      s.stone.alpha = g.taken ? 0.45 : 1;
      s.light.visible = !g.taken;
      s.light.scale.set((ready ? 60 + Math.sin(t * 3) * 8 : 22) / 128);
      s.light.alpha = ready ? 0.8 : 0.25;
      if (ready && g.x > left - 100 && g.x < right + 100) lights.add(g.x, g.y - 10, 110, LIGHT.lantern, 0.8);
    }

    // Foes: one sprite pair each, created on demand (guardians summon more).
    while (this.foes.length < w.enemies.length) {
      const body = gfx.sprite('e_skitter');
      const eye = gfx.sprite('dot');
      eye.blendMode = 'add';
      eye.tint = LIGHT.dangerEye;
      this.mid.addChild(body);
      this.glow.addChild(eye);
      this.foes.push({ body, eye });
    }
    for (let i = 0; i < this.foes.length; i++) {
      const v = this.foes[i];
      const e = w.enemies[i];
      const on = e !== undefined && e.alive && e.active && e.x > left - 60 && e.x < right + 60;
      v.body.visible = on;
      v.eye.visible = on;
      if (e && e.alive && e.active) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        const th = clamp(1 - d / 380, 0, 1) * (e.mode === 'windup' || e.mode === 'attack' ? 1 : 0.5);
        if (th > this.threat && (!on || e.mode === 'windup')) {
          this.threat = th;
          this.threatSide = e.x < p.x ? -1 : 1;
        }
      }
      if (!on) continue;
      const s = ENEMY[e.kind];
      const x = lerp(e.prevX, e.x, alpha);
      const y = lerp(e.prevY, e.y, alpha);
      const wind = e.mode === 'windup';
      const shake = wind ? Math.sin(t * 70 + i) * 1.6 : 0;
      v.body.texture = gfx.tex(`e_${e.kind}`);
      v.body.position.set(x + shake, y + (e.kind === 'gloomwing' || e.kind === 'stormjelly' ? Math.sin(t * 6 + i) * 2 : 0));
      const size = (s.r / 13) * (e.elite ? 1.3 : 1) * (wind ? 1.08 : 1);
      // A struck foe squashes away from the blow for a moment.
      const hitK = clamp(e.flash / 0.12, 0, 1);
      v.body.scale.set(inv * size * (e.facing >= 0 ? 1 : -1) * (1 + 0.35 * hitK), inv * size * (e.mode === 'stun' ? 0.85 : 1) * (1 - 0.25 * hitK));
      // Hidden things are almost invisible: a mound for the burrower, a shimmer for the voidling.
      const lit = clamp(1.3 - d2(e.x - p.x, e.y - p.y) / (w.lightRadius * 1.2), 0, 1);
      let a = Math.min(1, e.spawnT * 2);
      if (e.mode === 'hidden') a *= 0.28;
      if (e.kind === 'voidling' && e.mode === 'idle') a *= 0.1 + 0.6 * lit;
      if (w.level.rules.fog) a *= 0.25 + 0.75 * clamp(1.4 - d2(e.x - p.x, e.y - p.y) / 150, 0, 1);
      v.body.alpha = a;
      v.body.tint = e.flash > 0 ? 0xffffff : e.burn > 0 ? 0xffb070 : e.elite ? 0xffc8e8 : e.mode === 'stun' ? 0x9fb8ff : 0xe8e0ff;
      v.eye.position.set(x + e.facing * s.r * 0.4, y - s.r * 0.2);
      v.eye.scale.set((wind ? 26 + Math.sin(t * 40) * 6 : 10) / 32);
      v.eye.alpha = a * (wind ? 1 : e.mode === 'attack' ? 0.9 : 0.35);
      if (wind) lights.add(x, y, 50, LIGHT.danger, 0.45);
    }

    // Guardian.
    const b = w.boss;
    const showBoss = b !== null;
    this.boss.visible = showBoss;
    this.aura.visible = showBoss;
    if (b) {
      const x = lerp(b.prevX, b.x, alpha);
      const y = lerp(b.prevY, b.y, alpha);
      const dead = b.mode === 'dead';
      const tele = b.mode === 'tele';
      const size = (b.def.r * 2.6) / 96;
      this.boss.texture = gfx.tex(`boss${b.def.look}`);
      this.boss.position.set(x + (tele ? Math.sin(t * 60) * 2 : 0), y + Math.sin(t * 2.4) * 2);
      const bossHit = clamp(b.flash / 0.12, 0, 1);
      this.boss.scale.set(inv * size * (b.facing >= 0 ? 1 : -1) * (tele ? 1.06 : 1) * (1 + 0.12 * bossHit), inv * size * (b.mode === 'recover' ? 0.9 : 1) * (1 - 0.1 * bossHit));
      this.boss.tint = b.flash > 0 ? 0xffffff : mixColor(b.def.tint, 0xffffff, b.mode === 'recover' ? 0.4 : 0);
      this.boss.alpha = dead ? Math.max(0, 1 - b.t * 0.8) : b.mode === 'intro' ? clamp(1 - b.t / 1.6, 0.15, 1) : 1;
      this.aura.position.set(x, y);
      this.aura.tint = tele ? LIGHT.dangerEye : b.def.tint;
      this.aura.scale.set((b.def.r * (tele ? 7 : 5)) / 128);
      this.aura.alpha = dead ? 0 : tele ? 0.55 + 0.2 * Math.sin(t * 30) : 0.22;
      if (!dead) lights.add(x, y, b.def.r * 4, b.def.tint, 0.5);
      if (!dead && (x < left || x > right)) {
        this.threat = 1;
        this.threatSide = x < p.x ? -1 : 1;
      }
    }

    for (let i = 0; i < MAX_SHOTS; i++) {
      const s = w.projectiles[i];
      const v = this.shots[i];
      v.visible = s.alive;
      if (!s.alive) continue;
      v.position.set(s.x, s.y);
      if (s.kind === 'wave') {
        v.scale.set((s.r * 5) / 128, (s.r * 7) / 128);
        v.tint = LIGHT.dangerEye;
      } else if (s.kind === 'echo') {
        v.scale.set((s.r * 6) / 128, (s.r * 3) / 128);
        v.tint = LIGHT.safeCurrent;
      } else {
        v.scale.set((s.r * 5.4) / 128);
        v.tint = LIGHT.dangerEye;
      }
      v.alpha = 0.95;
      if (s.hostile) lights.add(s.x, s.y, 34, LIGHT.danger, 0.4);
    }

    // Warnings: an outline that fills as the moment approaches, then a flash while it hurts.
    const g = this.zones;
    g.clear();
    for (const z of w.zones) {
      if (!z.alive) continue;
      const live = z.warn <= 0;
      const k = live ? 1 : 1 - z.warn / z.warn0;
      const fill = z.dmg <= 0 ? 0.05 : live ? 0.6 : 0.1 + 0.22 * k;
      const colour = live ? 0xffd0f4 : LIGHT.dangerEye;
      if (z.circle) {
        g.circle(z.x, z.y, z.w).fill({ color: colour, alpha: fill });
        g.circle(z.x, z.y, z.w * (live ? 1 : 0.3 + 0.7 * k)).stroke({ width: 2, color: colour, alpha: 0.9 });
      } else {
        g.rect(z.x, z.y, z.w, z.h).fill({ color: colour, alpha: fill });
        g.rect(z.x, z.y, z.w, z.h).stroke({ width: 1.5, color: colour, alpha: 0.5 + 0.4 * k });
      }
    }
    if (w.level.rules.chase) {
      // The dark that follows: solid behind the line, feathered ahead of it.
      const x = w.chaseX;
      g.rect(left - 40, top - 40, Math.max(0, x - left + 40), bottom - top + 80).fill({ color: 0x05020c, alpha: 0.96 });
      for (let i = 0; i < 5; i++) g.rect(x + i * 14, top - 40, 14, bottom - top + 80).fill({ color: 0x1a0a2a, alpha: 0.7 - i * 0.14 });
      g.moveTo(x, top - 40).lineTo(x + Math.sin(t * 5) * 6, bottom + 40).stroke({ width: 3, color: LIGHT.dangerEye, alpha: 0.8 });
      if (x > left - 60) {
        this.threat = Math.max(this.threat, clamp(1 - (p.x - x) / 400, 0, 1));
        this.threatSide = -1;
      }
    }
  }
}

const d2 = (dx: number, dy: number): number => Math.hypot(dx, dy);
