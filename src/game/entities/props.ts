import { P } from '../core/constants';
import { approach, clamp } from '../core/util';
import type { World } from '../core/world';
import { hurtPlayer, pulseCombat } from '../systems/combat';

const PLANT_LUMEN = 40;
const PLANT_REGROW = 10;
const FIREFLY_LUMEN = 12;
const GEYSER_WARN = 0.9;
const GEYSER_ON = 1.1;
const GATE_OPEN_TIME = 0.6;

/** Restores everything a respawn should restore. Opened gates, broken walls and shells stay. */
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
}

function addLumen(w: World, amount: number): void {
  w.player.lumen = clamp(w.player.lumen + amount, 0, w.load.lumenMax);
}

/** Environmental props: currents, platforms, geysers, gates, stones, pickups, shrines, kin. */
export function updateProps(w: World, dt: number): void {
  const p = w.player;
  const alive = p.status === 'alive';
  const radius = w.lightRadius;
  const glowing = p.glowOn && alive;

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

  for (let i = 0; i < w.platforms.length; i++) {
    const pl = w.platforms[i];
    if (pl.period) {
      // Moving platforms glide back and forth on a cosine so they pause at each end.
      const k = 0.5 - 0.5 * Math.cos(((w.clock % pl.period) / pl.period) * Math.PI * 2);
      const nx = pl.x0 + (pl.dx ?? 0) * k;
      const ny = pl.y0 + (pl.dy ?? 0) * k;
      pl.mvx = (nx - pl.x) / dt;
      pl.mvy = (ny - pl.y) / dt;
      if (p.onPlatform === pl) p.y += ny - pl.y;
      pl.x = nx;
      pl.y = ny;
    }
    if (pl.kind === 'moonglass') {
      pl.litT = Math.max(0, pl.litT - dt);
      let lit = pl.litT > 0;
      if (!lit && glowing) {
        const nx = clamp(p.x, pl.x, pl.x + pl.w);
        const dx = nx - p.x;
        const dy = pl.y - p.y;
        lit = dx * dx + dy * dy < radius * radius;
      }
      pl.lit = approach(pl.lit, lit ? 1 : 0, dt * (lit ? 7 : 1.3));
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
          pl.fallen = 2.6;
          pl.timer = -1;
          w.emit('crumble', pl.x + pl.w / 2, pl.y, 0);
        }
      }
    }
  }

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
        p.jumpsLeft = 1;
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

  for (let i = 0; i < w.gates.length; i++) {
    const g = w.gates[i];
    if (g.kind === 'arena') {
      g.prog = approach(g.prog, g.open ? 1 : 0, dt * 5);
    } else if (g.kind === 'tide') {
      const open = (g.openAbove !== undefined && w.waterY <= g.openAbove) || (g.openBelow !== undefined && w.waterY >= g.openBelow);
      if (open !== g.open) {
        g.open = open;
        if (open) w.emit('gateOpen', g.x, g.y - g.h / 2, 1);
      }
      g.prog = approach(g.prog, open ? 1 : 0, dt * 1.5);
    } else if (!g.open) {
      // A door answers light held beside it, anywhere along its height.
      const near = glowing && Math.abs(p.x - g.x) < 130 && p.y < g.y + 20 && p.y > g.y - g.h - 20;
      g.prog = clamp(g.prog + (near ? dt / GATE_OPEN_TIME : -dt * 0.6), 0, 1);
      if (g.prog >= 1) {
        g.open = true;
        w.emit('gateOpen', g.x, g.y - g.h / 2, 0);
      }
    }
  }

  for (let i = 0; i < w.stones.length; i++) {
    const s = w.stones[i];
    if (s.mode === 'hang') {
      if (alive && Math.abs(p.x - s.x) < 50 && p.y > s.y) {
        s.mode = 'warn';
        s.t = 0.55 * w.warnScale;
        w.emit('stoneWarn', s.x, s.y, 0);
      }
    } else if (s.mode === 'warn') {
      s.t -= dt;
      if (s.t <= 0) s.mode = 'fall';
    } else if (s.mode === 'fall') {
      s.vy = Math.min(620, s.vy + 1100 * dt);
      s.cy += s.vy * dt;
      if (alive && Math.abs(p.x - s.x) < 15 && Math.abs(p.y - s.cy) < 16) hurtPlayer(w, 1, s.x, s.cy - 10);
      if (s.cy >= s.restY) {
        s.cy = s.restY;
        s.mode = 'rest';
        w.emit('stoneLand', s.x, s.restY, 0);
      }
    }
  }

  if (!alive) return;

  p.inPool = false;
  for (let i = 0; i < w.level.pools.length; i++) {
    const pool = w.level.pools[i];
    const dx = p.x - pool.x;
    const dy = p.y - pool.y;
    if (dx * dx + dy * dy < pool.r * pool.r) {
      p.inPool = true;
      break;
    }
  }

  for (let i = 0; i < w.level.urchins.length; i++) {
    const u = w.level.urchins[i];
    const dx = p.x - u.x;
    const dy = p.y - u.y;
    const r = u.r + P.halfW - 3;
    if (dx * dx + dy * dy < r * r) hurtPlayer(w, 1, u.x, u.y);
  }

  for (let i = 0; i < w.plants.length; i++) {
    const pl = w.plants[i];
    if (pl.cd > 0) {
      pl.cd -= dt;
      continue;
    }
    const dx = p.x - pl.x;
    const dy = p.y - (pl.y - 10);
    if (dx * dx + dy * dy < 24 * 24 && p.lumen < w.load.lumenMax - 1) {
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

  // Shrines: a lost ability returns, or the creature grows a little.
  for (let i = 0; i < w.grants.length; i++) {
    const g = w.grants[i];
    if (g.taken || (g.after !== undefined && !w.defeated.has(g.after))) continue;
    const dx = p.x - g.x;
    const dy = p.y - g.y;
    if (dx * dx + dy * dy < 30 * 30) {
      g.taken = true;
      if (g.ability) w.load.abilities.add(g.ability);
      if (g.upgrade === 'health') {
        w.load.hpMax++;
        p.hp = w.load.hpMax;
      } else if (g.upgrade === 'lumen') {
        w.load.lumenMax += 25;
        p.lumen = w.load.lumenMax;
      } else if (g.upgrade === 'essence') w.load.essenceMax++;
      else if (g.upgrade === 'pulse') w.load.pulseLevel++;
      w.emit('grant', g.x, g.y, i);
    }
  }

  for (let i = 0; i < w.level.secrets.length; i++) {
    const z = w.level.secrets[i];
    if (w.secretsFound.has(z.id)) continue;
    if (p.x > z.x && p.x < z.x + z.w && p.y > z.y && p.y < z.y + z.h) {
      w.secretsFound.add(z.id);
      w.emit('secret', p.x, p.y, 0);
    }
  }

  for (let i = 0; i < w.kin.length; i++) {
    const k = w.kin[i];
    if (k.gone) continue;
    if (!k.awake) {
      const dx = p.x - k.x;
      const dy = p.y - k.y;
      if (glowing && dx * dx + dy * dy < 140 * 140) wakeKin(w, i);
      continue;
    }
    k.life += dt;
    if (k.flee) {
      k.vx = approach(k.vx, 150, 200 * dt);
      k.cx += k.vx * dt;
      k.cy += Math.sin(k.life * 3.1) * 22 * dt - 8 * dt;
      if (k.life > 6) k.gone = true;
    } else {
      const tx = p.x - p.facing * (30 + (k.slot % 7) * 22);
      const ty = p.y - 18 - (k.slot % 4) * 15 + Math.sin(k.life * 2.2 + k.slot) * 7;
      k.vx += ((tx - k.cx) * 7 - k.vx * 4) * dt;
      k.vy += ((ty - k.cy) * 7 - k.vy * 4) * dt;
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

/** What a Lumen Pulse does to the world around it. */
export function pulseProps(w: World, x: number, y: number): void {
  pulseCombat(w, x, y);
  const reach = 300 * (1 + 0.3 * w.load.pulseLevel);
  const r2 = reach * reach;
  for (const pl of w.platforms) {
    if (pl.kind !== 'moonglass') continue;
    const nx = clamp(x, pl.x, pl.x + pl.w);
    if ((nx - x) * (nx - x) + (pl.y - y) * (pl.y - y) < r2) pl.litT = P.pulseReveal;
  }
  for (const s of w.shells) if (!s.revealed && (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y) < r2) s.revealed = true;
  for (const g of w.gates) {
    if (g.kind === 'bloom' && !g.open && Math.abs(g.x - x) < 170 && y < g.y + 20 && y > g.y - g.h - 20) {
      g.open = true;
      g.prog = 1;
      w.emit('gateOpen', g.x, g.y - g.h / 2, 0);
    }
  }
  for (let i = 0; i < w.kin.length; i++) {
    const k = w.kin[i];
    if (!k.awake && (k.x - x) * (k.x - x) + (k.y - y) * (k.y - y) < 220 * 220) wakeKin(w, i);
  }
}
