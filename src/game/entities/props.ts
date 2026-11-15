import { P } from '../core/constants';
import { approach, clamp } from '../core/util';
import type { World } from '../core/world';
import { addLumen, drainLumen } from '../systems/lumen';
import { pulseFish } from './fish';

const PLANT_LUMEN = 36;
const PLANT_REGROW = 14;
const FIREFLY_LUMEN = 10;
const GEYSER_WARN = 0.9;
const GEYSER_ON = 1.1;
const GATE_OPEN_TIME = 0.8;

/** Restores everything that a respawn should restore. Opened gates and collected shells stay. */
export function resetProps(w: World): void {
  for (const pl of w.platforms) {
    pl.lit = 0;
    pl.litT = 0;
    pl.solid = pl.kind !== 'moonglass';
    pl.timer = -1;
    pl.fallen = 0;
  }
  for (const pl of w.plants) pl.cd = 0;
  for (const f of w.fireflies) f.taken = false;
  for (const s of w.stones) {
    s.cy = s.y;
    s.vy = 0;
    s.mode = 'hang';
    s.t = 0;
  }
  for (const k of w.kin) {
    if (k.flee && k.awake) continue;
    if (!k.awake) {
      k.cx = k.x;
      k.cy = k.y;
    }
  }
}

function sting(w: World, fromX: number, fromY: number, amount: number): void {
  const p = w.player;
  if (p.invuln > 0) return;
  drainLumen(w, amount);
  p.invuln = 1;
  const dx = p.x - fromX;
  const dy = p.y - fromY;
  const d = Math.hypot(dx, dy) || 1;
  p.vx = (dx / d) * 190;
  p.vy = (dy / d) * 150 - 90;
  p.dashT = 0;
  w.emit('sting', p.x, p.y, amount);
}

/** Environmental props: currents, moonglass, crumbling ledges, geysers, gates, stones, pickups, kin. */
export function updateProps(w: World, dt: number): void {
  const p = w.player;
  const alive = p.status === 'alive';
  const radius = w.lightRadius;
  const glowing = p.glowOn && alive;

  // Currents follow the tide.
  for (let i = 0; i < w.currents.length; i++) {
    const c = w.currents[i];
    let target = 1;
    if (c.mode === 'rising') target = w.tide.trend > 0 ? 1 : 0;
    else if (c.mode === 'falling') target = w.tide.trend < 0 ? 1 : 0;
    else if (c.mode === 'flip') target = w.tide.trend < 0 ? -1 : 1;
    else if (c.mode === 'beat') {
      const period = c.period ?? 6;
      const t = (w.clock + (c.phase ?? 0)) % period;
      target = t < period * (c.duty ?? 0.5) ? 1 : 0;
    }
    c.power = approach(c.power, target, dt * 1.6);
  }

  // Moonglass ledges exist only in light; crumbling ledges fall and reform.
  for (let i = 0; i < w.platforms.length; i++) {
    const pl = w.platforms[i];
    if (pl.kind === 'moonglass') {
      pl.litT = Math.max(0, pl.litT - dt);
      let lit = pl.litT > 0;
      if (!lit && glowing) {
        const nx = clamp(p.x, pl.x, pl.x + pl.w);
        const dx = nx - p.x;
        const dy = pl.y - p.y;
        lit = dx * dx + dy * dy < radius * radius;
      }
      pl.lit = approach(pl.lit, lit ? 1 : 0, dt * (lit ? 6 : 1.3));
      pl.solid = pl.lit > 0.35;
    } else if (pl.kind === 'crumble') {
      if (pl.fallen > 0) {
        pl.fallen -= dt;
        if (pl.fallen <= 0) {
          pl.solid = true;
          pl.timer = -1;
        }
      } else if (pl.timer >= 0) {
        pl.timer -= dt;
        if (pl.timer <= 0) {
          pl.solid = false;
          pl.fallen = 3.5;
          pl.timer = -1;
          w.emit('crumble', pl.x + pl.w / 2, pl.y, 0);
        }
      }
    }
  }

  // Geysers: a warning hiss of bubbles, then a column that throws the creature upward.
  for (let i = 0; i < w.geysers.length; i++) {
    const g = w.geysers[i];
    const t = (w.clock + g.phase) % g.period;
    if (t < GEYSER_ON) {
      if (g.phaseNow !== 2) {
        g.phaseNow = 2;
        g.fired = false;
        w.emit('geyser', g.x, g.y, g.power);
      }
      if (alive && Math.abs(p.x - g.x) < 17 && p.y < g.y + 6 && p.y > g.y - 150) {
        if (p.vy > -g.power) p.vy = -g.power;
        p.onGround = false;
        p.jumping = false;
        p.airDashed = false;
        if (!g.fired) {
          g.fired = true;
          w.emit('jump', p.x, p.y, 1);
        }
      }
    } else if (t > g.period - GEYSER_WARN) {
      if (g.phaseNow === 0) w.emit('geyserWarn', g.x, g.y, 0);
      g.phaseNow = Math.max(0.01, 1 - (g.period - t) / GEYSER_WARN);
    } else {
      g.phaseNow = 0;
    }
  }

  // Gates.
  for (let i = 0; i < w.gates.length; i++) {
    const g = w.gates[i];
    if (g.kind === 'tide') {
      const open = (g.openAbove !== undefined && w.waterY <= g.openAbove) || (g.openBelow !== undefined && w.waterY >= g.openBelow);
      if (open !== g.open) {
        g.open = open;
        if (open) w.emit('gateOpen', g.x, g.y - g.h / 2, 1);
      }
      g.prog = approach(g.prog, open ? 1 : 0, dt * 1.5);
    } else if (!g.open) {
      const dx = p.x - g.x;
      const dy = p.y - (g.y - g.h / 2);
      const near = glowing && dx * dx + dy * dy < 118 * 118;
      g.prog = clamp(g.prog + (near ? dt / GATE_OPEN_TIME : -dt * 0.6), 0, 1);
      if (g.prog >= 1) {
        g.open = true;
        w.emit('gateOpen', g.x, g.y - g.h / 2, 0);
      }
    }
  }

  // Loose stones in the ruins.
  for (let i = 0; i < w.stones.length; i++) {
    const s = w.stones[i];
    if (s.mode === 'hang') {
      if (alive && Math.abs(p.x - s.x) < 44 && p.y > s.y) {
        s.mode = 'warn';
        s.t = 0.65;
        w.emit('stoneWarn', s.x, s.y, 0);
      }
    } else if (s.mode === 'warn') {
      s.t -= dt;
      if (s.t <= 0) s.mode = 'fall';
    } else if (s.mode === 'fall') {
      s.vy = Math.min(520, s.vy + 900 * dt);
      s.cy += s.vy * dt;
      if (alive && Math.abs(p.x - s.x) < 15 && Math.abs(p.y - s.cy) < 16) sting(w, s.x, s.cy - 10, w.diff.sting);
      if (s.cy >= s.restY) {
        s.cy = s.restY;
        s.mode = 'rest';
        w.emit('stoneLand', s.x, s.restY, 0);
      }
    }
  }

  if (!alive) return;

  // Urchins sting.
  for (let i = 0; i < w.level.urchins.length; i++) {
    const u = w.level.urchins[i];
    const dx = p.x - u.x;
    const dy = p.y - u.y;
    const r = u.r + P.halfW - 2;
    if (dx * dx + dy * dy < r * r) sting(w, u.x, u.y, w.diff.sting);
  }

  // Glow plants and fireflies restore Lumen.
  for (let i = 0; i < w.plants.length; i++) {
    const pl = w.plants[i];
    if (pl.cd > 0) {
      pl.cd -= dt;
      continue;
    }
    const dx = p.x - pl.x;
    const dy = p.y - (pl.y - 10);
    if (dx * dx + dy * dy < 24 * 24 && p.lumen < w.diff.lumenMax - 1) {
      pl.cd = PLANT_REGROW;
      addLumen(w, PLANT_LUMEN);
      w.emit('plant', pl.x, pl.y - 12, PLANT_LUMEN);
    }
  }
  for (let i = 0; i < w.fireflies.length; i++) {
    const f = w.fireflies[i];
    if (f.taken) continue;
    const dx = p.x - f.x;
    const dy = p.y - f.y;
    if (dx * dx + dy * dy < 20 * 20) {
      f.taken = true;
      addLumen(w, FIREFLY_LUMEN);
      w.emit('pickup', f.x, f.y, FIREFLY_LUMEN);
    }
  }

  // Memory Shells: hidden ones must be lit before they can be gathered.
  for (let i = 0; i < w.shells.length; i++) {
    const s = w.shells[i];
    if (s.taken) continue;
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    const d2 = dx * dx + dy * dy;
    if (!s.revealed && glowing && d2 < radius * radius) s.revealed = true;
    if (s.revealed && d2 < 24 * 24) {
      s.taken = true;
      w.emit('shell', s.x, s.y, i);
    }
  }

  // Optional routes.
  for (let i = 0; i < w.level.secrets.length; i++) {
    const z = w.level.secrets[i];
    if (w.secretsFound.has(z.id)) continue;
    if (p.x > z.x && p.x < z.x + z.w && p.y > z.y && p.y < z.y + z.h) {
      w.secretsFound.add(z.id);
      w.emit('secret', p.x, p.y, 0);
    }
  }

  // Kin: other small lights that answer the creature's glow.
  for (let i = 0; i < w.kin.length; i++) {
    const k = w.kin[i];
    if (k.gone) continue;
    if (!k.awake) {
      const dx = p.x - k.x;
      const dy = p.y - k.y;
      if (glowing && dx * dx + dy * dy < 130 * 130) wakeKin(w, i);
      continue;
    }
    k.life += dt;
    if (k.flee) {
      k.vx = approach(k.vx, 130, 160 * dt);
      k.cx += k.vx * dt;
      k.cy += Math.sin(k.life * 3.1) * 22 * dt - 8 * dt;
      if (k.life > 6) k.gone = true;
    } else {
      const tx = p.x - p.facing * (26 + (k.slot % 6) * 15);
      const ty = p.y - 20 - (k.slot % 4) * 11 + Math.sin(k.life * 2.2 + k.slot) * 6;
      k.vx += ((tx - k.cx) * 5 - k.vx * 3.2) * dt;
      k.vy += ((ty - k.cy) * 5 - k.vy * 3.2) * dt;
      k.cx += k.vx * dt;
      k.cy += k.vy * dt;
    }
  }
}

function wakeKin(w: World, index: number): void {
  const k = w.kin[index];
  if (k.awake) return;
  k.awake = true;
  k.life = 0;
  w.kinAwake++;
  w.emit('kin', k.x, k.y, w.kinAwake);
}

/** Effects of a Lumen Pulse on the environment. */
export function pulseProps(w: World, x: number, y: number): void {
  pulseFish(w, x, y);
  const r2 = P.pulseRadius * P.pulseRadius;
  for (const pl of w.platforms) {
    if (pl.kind !== 'moonglass') continue;
    const nx = clamp(x, pl.x, pl.x + pl.w);
    if ((nx - x) * (nx - x) + (pl.y - y) * (pl.y - y) < r2) pl.litT = P.pulseReveal;
  }
  for (const s of w.shells) {
    if (!s.revealed && (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y) < r2) s.revealed = true;
  }
  for (const g of w.gates) {
    if (g.kind === 'bloom' && !g.open && (g.x - x) * (g.x - x) + (g.y - g.h / 2 - y) * (g.y - g.h / 2 - y) < 150 * 150) {
      g.open = true;
      g.prog = 1;
      w.emit('gateOpen', g.x, g.y - g.h / 2, 0);
    }
  }
  for (let i = 0; i < w.kin.length; i++) {
    const k = w.kin[i];
    if (!k.awake && (k.x - x) * (k.x - x) + (k.y - y) * (k.y - y) < 210 * 210) wakeKin(w, i);
  }
}
