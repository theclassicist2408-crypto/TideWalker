import { P, REWARDS } from '../core/constants';
import { clamp } from '../core/util';
import type { World } from '../core/world';
import { hitBoss, startBoss } from '../entities/bosses';
import { hitEnemy, wakeWave } from '../entities/enemies';

/** Wounds the Tideborn unless something protects it. Returns whether the blow landed. */
export function hurtPlayer(w: World, dmg: number, fromX: number, fromY: number): boolean {
  const p = w.player;
  if (p.status !== 'alive' || p.invuln > 0 || w.mode === 'drift' || w.mode === 'title') return false;
  if (p.shield > 0) {
    // Coral Shield: takes this blow and shatters.
    p.shield = 0;
    p.invuln = 0.6;
    w.emit('clang', p.x, p.y, 1);
    return false;
  }
  p.hp -= dmg;
  w.hitsTaken++;
  p.invuln = P.invuln;
  p.lockT = 0.18;
  const dir = p.x >= fromX ? 1 : -1;
  p.vx = dir * P.knockX;
  p.vy = -P.knockY * (fromY > p.y + 30 ? 1.2 : 1);
  p.dashT = 0;
  p.hookT = 0;
  p.healT = 0;
  p.chargeT = 0;
  p.slamming = false;
  p.onGround = false;
  w.hitstop = P.hitstop * 2;
  w.emit('hurt', p.x, p.y, dmg);
  if (p.hp <= 0) w.kill();
  return true;
}

function overlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, br: number): boolean {
  const nx = clamp(bx, ax, ax + aw);
  const ny = clamp(by, ay, ay + ah);
  return (nx - bx) * (nx - bx) + (ny - by) * (ny - by) <= br * br;
}

/** Applies the active slash to everything it touches. Each swing hits a target once. */
export function resolveSlash(w: World): void {
  const p = w.player;
  const reach = p.charged ? P.chargeReach : P.slashReach;
  const tall = p.charged ? P.slashHeight * 1.5 : P.slashHeight;
  let x: number;
  let y: number;
  let bw: number;
  let bh: number;
  if (p.slashDir === 'up') {
    x = p.x - 24;
    y = p.y - reach;
    bw = 48;
    bh = reach;
  } else if (p.slashDir === 'down') {
    x = p.x - 22;
    y = p.y;
    bw = 44;
    bh = reach;
  } else {
    x = p.facing > 0 ? p.x - 6 : p.x - reach;
    y = p.y - tall / 2;
    bw = reach + 6;
    bh = tall;
  }
  const dmg = (p.charged ? P.chargeDamage : P.slashDamage) * (p.crownT > 0 ? 1.25 : 1);
  let landed = false;
  let bounced = false;

  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i];
    if (!e.alive || !e.active || e.lastHit === p.slashId || e.mode === 'hidden') continue;
    if (!overlap(x, y, bw, bh, e.x, e.y, 14)) continue;
    e.lastHit = p.slashId;
    const result = hitEnemy(w, e, dmg, p.x, p.slashDir, p.charged);
    if (result === 'blocked') {
      p.vx = -p.facing * 180;
      w.emit('clang', e.x, e.y, 0);
    } else {
      landed = true;
      if (p.emberT > 0) e.burn = 3;
    }
    bounced = true;
  }
  const b = w.boss;
  if (b && b.mode !== 'dead' && b.mode !== 'intro' && b.lastHit !== p.slashId && overlap(x, y, bw, bh, b.x, b.y, b.def.r)) {
    b.lastHit = p.slashId;
    hitBoss(w, dmg, p.emberT > 0);
    landed = true;
    bounced = true;
  }
  for (let i = 0; i < w.projectiles.length; i++) {
    const s = w.projectiles[i];
    if (s.alive && s.hostile && s.kind === 'orb' && overlap(x, y, bw, bh, s.x, s.y, s.r)) {
      s.alive = false;
      w.emit('hit', s.x, s.y, 0);
    }
  }
  if (p.charged) breakBlocks(w, x - 8, y, bw + 16, bh);
  if (p.slashDir === 'down') {
    for (const u of w.level.urchins) if (overlap(x, y, bw, bh, u.x, u.y, u.r)) bounced = true;
    for (const s of w.level.spikes) if (x < s.x + s.w && x + bw > s.x && y < s.y + s.h && y + bh > s.y) bounced = true;
  }

  if (landed) {
    p.essence = Math.min(w.load.essenceMax, p.essence + P.essencePerHit * (p.charged ? 2 : 1));
    w.hitstop = Math.max(w.hitstop, P.hitstop);
    if (p.slashDir === 'side' && !p.charged) p.vx -= p.facing * 50;
  }
  if (p.slashDir === 'down' && bounced && p.vy > -P.pogoVel) {
    // Downward strike: bounce off whatever was struck and get the air moves back.
    p.vy = -P.pogoVel;
    p.jumpsLeft = 1;
    p.airDashed = false;
    p.jumping = false;
    w.emit('pogo', p.x, p.y + P.halfH, 0);
  }
}

function breakBlocks(w: World, x: number, y: number, bw: number, bh: number): void {
  for (const b of w.blocks) {
    if (b.broken || b.kind !== 'cracked') continue;
    if (x < b.x + b.w && x + bw > b.x && y < b.y + b.h && y + bh > b.y) {
      b.broken = true;
      w.emit('break', b.x + b.w / 2, b.y + b.h / 2, 0);
    }
  }
}

/** A Lumen Pulse: stuns, clears shots, wounds a little, lights hidden things. */
export function pulseCombat(w: World, x: number, y: number): void {
  const r = P.pulseRadius * (1 + 0.3 * w.load.pulseLevel);
  for (const e of w.enemies) {
    if (!e.alive || !e.active) continue;
    if ((e.x - x) * (e.x - x) + (e.y - y) * (e.y - y) > r * r) continue;
    hitEnemy(w, e, P.pulseDamage * (1 + w.load.pulseLevel), x, 'pulse', true);
    if (e.alive) {
      e.mode = 'stun';
      e.t = P.pulseStun;
    }
  }
  const b = w.boss;
  if (b && b.mode !== 'dead' && b.mode !== 'intro' && Math.hypot(b.x - x, b.y - y) < r + b.def.r) hitBoss(w, P.pulseDamage * (1 + w.load.pulseLevel), false);
  for (const s of w.projectiles) if (s.alive && s.hostile && Math.hypot(s.x - x, s.y - y) < r) s.alive = false;
}

/** Tidebreaker landing: a shockwave along the ground. */
export function tidebreakerLand(w: World): void {
  const p = w.player;
  const id = w.nextSlashId();
  w.emit('zoneHit', p.x, p.y + P.halfH, 2);
  for (const e of w.enemies) {
    if (!e.alive || !e.active || Math.abs(e.x - p.x) > 120 || Math.abs(e.y - p.y) > 60) continue;
    e.lastHit = id;
    hitEnemy(w, e, 18, p.x, 'down', true);
    if (e.alive) {
      e.mode = 'stun';
      e.t = 1;
    }
  }
  const b = w.boss;
  if (b && b.mode !== 'dead' && b.mode !== 'intro' && Math.abs(b.x - p.x) < 120 + b.def.r && Math.abs(b.y - p.y) < 70 + b.def.r) hitBoss(w, 18, false);
  breakBlocks(w, p.x - 130, p.y - 60, 260, 160);
  p.invuln = Math.max(p.invuln, 0.3);
}

/** Uses the equipped boss gift. Every gift costs Lumen and has a cooldown. */
export function useReward(w: World): void {
  const p = w.player;
  const id = w.load.equipped;
  if (!id || !w.load.rewards.has(id)) return;
  const def = REWARDS[id];
  const calm = w.mode === 'drift' || w.mode === 'title';
  const fail = (): void => w.emit('abilityFail', p.x, p.y, 0);
  if (p.abilityCd > 0 || (!calm && p.lumen < def.cost)) return fail();

  switch (id) {
    case 'tidebreaker':
      if (p.swim) return fail();
      if (p.onGround) tidebreakerLand(w);
      else {
        p.slamming = true;
        p.vy = 900;
        p.vx = 0;
        p.dashT = 0;
      }
      break;
    case 'veil':
      p.veilT = 5;
      break;
    case 'vinehook': {
      // Nearest foe ahead, else the first wall ahead.
      let best = 230;
      let tx = 0;
      let ty = 0;
      let found = false;
      for (const e of w.enemies) {
        if (!e.alive || !e.active) continue;
        const dx = (e.x - p.x) * p.facing;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (dx > 20 && d < best) {
          best = d;
          tx = e.x - p.facing * 20;
          ty = e.y;
          found = true;
        }
      }
      if (!found && w.boss && w.boss.mode !== 'dead') {
        const dx = (w.boss.x - p.x) * p.facing;
        if (dx > 20 && dx < 230) {
          tx = w.boss.x - p.facing * (w.boss.def.r + 12);
          ty = w.boss.y;
          found = true;
        }
      }
      if (!found) {
        for (let d = 30; d <= 220 && !found; d += 10) {
          const x = p.x + p.facing * d;
          const y = p.y - d * 0.35;
          let solid = w.ground.at(x) < y + P.halfH;
          for (const b of w.blocks) if (!b.broken && x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) solid = true;
          if (solid) {
            tx = x - p.facing * 12;
            ty = y;
            found = true;
          }
        }
      }
      if (!found) return fail();
      p.hookX = tx;
      p.hookY = ty;
      p.hookT = 0.5;
      p.swim = false;
      p.onGround = false;
      break;
    }
    case 'echo': {
      w.spawnProjectile(p.x + p.facing * 14, p.y - 2, p.facing * 540, 0, 16, 0.75, false, 'echo', 0, 16);
      for (const pl of w.platforms) {
        if (pl.kind === 'moonglass' && (pl.x + pl.w / 2 - p.x) * p.facing > -20 && Math.abs(pl.x - p.x) < 440 && Math.abs(pl.y - p.y) < 140) pl.litT = 4;
      }
      for (const s of w.shells) if (!s.revealed && Math.abs(s.x - p.x) < 440 && Math.abs(s.y - p.y) < 160) s.revealed = true;
      break;
    }
    case 'stormstep': {
      // Blink forward, stopping short of solid ground.
      let dist = 0;
      for (let d = 10; d <= 140; d += 10) {
        const x = p.x + p.facing * d;
        let solid = w.ground.at(x) < p.y + P.halfH - 4 || w.ceil.at(x) > p.y - P.halfH || x < w.minX || x > w.level.width - 10;
        for (const b of w.blocks) if (!b.broken && x > b.x - 9 && x < b.x + b.w + 9 && p.y > b.y - 9 && p.y < b.y + b.h + 9) solid = true;
        for (const g of w.gates) if (!g.open && Math.abs(g.x - x) < 14 && p.y > g.y - g.h && p.y < g.y) solid = true;
        if (solid) break;
        dist = d;
      }
      if (dist < 30) return fail();
      p.x += p.facing * dist;
      p.prevX = p.x;
      p.invuln = Math.max(p.invuln, 0.4);
      p.vy = Math.min(p.vy, 0);
      break;
    }
    case 'shield':
      p.shield = 12;
      break;
    case 'ember':
      p.emberT = 6;
      break;
    case 'bloom':
      p.bloomT = 2.2;
      break;
    case 'void':
      for (const e of w.enemies) {
        if (!e.alive || !e.active) continue;
        const dx = p.x - e.x;
        if (Math.abs(dx) > 230 || Math.abs(e.y - p.y) > 150) continue;
        e.vx = Math.sign(dx) * 420;
        e.mode = 'stun';
        e.t = 0.55;
      }
      break;
    case 'crown':
      p.crownT = 6;
      break;
  }
  if (!calm) p.lumen -= def.cost;
  p.abilityCd = def.cooldown;
  w.emit('ability', p.x, p.y, 0);
}

/** Arena fights: gates close, waves arrive, gates open when the last foe falls. */
export function updateArenas(w: World, dt: number): void {
  const p = w.player;
  for (let i = 0; i < w.arenas.length; i++) {
    const a = w.arenas[i];
    if (a.state === 'done') continue;
    if (a.state === 'idle') {
      if (p.x > a.x0 + 46 && p.x < a.x1 - 46 && p.y < a.y + 40 && p.y > a.y - 420) {
        a.state = 'active';
        a.waveNow = 0;
        a.timer = a.survive ?? 0;
        if (a.lock) setGates(w, i, false);
        if (a.boss || a.miniboss) startBoss(w, i);
        wakeWave(w, i, 0);
        w.emit('arenaStart', (a.x0 + a.x1) / 2, a.y - 80, a.boss ? 2 : a.miniboss ? 1 : 0);
      }
      continue;
    }
    // An optional guardian is left behind if the creature simply runs on.
    if (!a.lock && (p.x < a.x0 - 220 || p.x > a.x1 + 220)) {
      a.state = 'idle';
      a.waveNow = -1;
      continue;
    }
    let alive = 0;
    for (const e of w.enemies) if (e.arena === i && e.alive && e.active) alive++;
    const guardian = w.boss && w.boss.arena === i && w.boss.mode !== 'dead';
    if (a.survive) {
      a.timer -= dt;
      if (alive < 2 && a.timer > 1) {
        // Survival: the next wave arrives as soon as there is room.
        a.waveNow = (a.waveNow + 1) % Math.max(1, a.waves);
        wakeWave(w, i, a.waveNow);
      }
      if (a.timer <= 0) {
        for (const e of w.enemies) if (e.arena === i && e.alive) e.alive = false;
        finishArena(w, i);
      }
    } else if (alive === 0 && !guardian) {
      if (a.waveNow + 1 < a.waves) {
        a.waveNow++;
        wakeWave(w, i, a.waveNow);
      } else {
        finishArena(w, i);
      }
    }
  }
}

function setGates(w: World, arena: number, open: boolean): void {
  for (const g of w.gates) {
    if (g.kind === 'arena' && g.arena === arena && g.open !== open) {
      g.open = open;
      w.emit(open ? 'gateOpen' : 'gateClose', g.x, g.y - g.h / 2, 2);
    }
  }
}

function finishArena(w: World, i: number): void {
  const a = w.arenas[i];
  a.state = 'done';
  setGates(w, i, true);
  for (const z of w.zones) z.alive = false;
  for (const s of w.projectiles) if (s.hostile) s.alive = false;
  w.floodTarget = 0;
  w.emit('arenaClear', (a.x0 + a.x1) / 2, a.y - 60, a.boss ? 2 : a.miniboss ? 1 : 0);
}

/** Shots, telegraphed zones, spikes and anything else that hurts on contact. */
export function updateHazards(w: World, dt: number): void {
  const p = w.player;
  for (let i = 0; i < w.projectiles.length; i++) {
    const s = w.projectiles[i];
    if (!s.alive) continue;
    s.life -= dt;
    s.vy += s.gravity * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    const floor = w.ground.at(s.x);
    if (s.kind === 'wave') s.y = floor - s.r;
    else if (s.y + s.r * 0.5 > floor) s.life = 0;
    if (s.life <= 0) {
      s.alive = false;
      continue;
    }
    if (s.hostile) {
      const d = s.r + P.halfW - 3;
      if ((s.x - p.x) * (s.x - p.x) + (s.y - p.y) * (s.y - p.y) < d * d && hurtPlayer(w, s.dmg, s.x, s.y) && s.kind === 'orb') s.alive = false;
    } else {
      if (s.hitId === 0) s.hitId = w.nextSlashId();
      for (const e of w.enemies) {
        if (!e.alive || !e.active || e.lastHit === s.hitId || Math.hypot(e.x - s.x, e.y - s.y) > s.r + 14) continue;
        e.lastHit = s.hitId;
        hitEnemy(w, e, s.dmg, s.x - s.vx, 'pulse', true);
      }
      const b = w.boss;
      if (b && b.mode !== 'dead' && b.mode !== 'intro' && b.lastHit !== s.hitId && Math.hypot(b.x - s.x, b.y - s.y) < s.r + b.def.r) {
        b.lastHit = s.hitId;
        hitBoss(w, s.dmg, false);
      }
    }
  }

  for (let i = 0; i < w.zones.length; i++) {
    const z = w.zones[i];
    if (!z.alive) continue;
    if (z.warn > 0) {
      z.warn -= dt;
      if (z.warn <= 0) w.emit('zoneHit', z.circle ? z.x : z.x + z.w / 2, z.circle ? z.y : z.y + z.h / 2, z.circle ? 1 : 0);
      continue;
    }
    z.dur -= dt;
    if (z.dur <= 0) {
      z.alive = false;
      continue;
    }
    if (z.struck || z.dmg <= 0) continue;
    const inside = z.circle
      ? (p.x - z.x) * (p.x - z.x) + (p.y - z.y) * (p.y - z.y) < (z.w + 5) * (z.w + 5)
      : p.x + 6 > z.x && p.x - 6 < z.x + z.w && p.y + 7 > z.y && p.y - 7 < z.y + z.h;
    if (inside && hurtPlayer(w, z.dmg, z.circle ? z.x : z.x + z.w / 2, z.circle ? z.y : z.y + z.h)) z.struck = true;
  }

  if (p.status !== 'alive') return;
  for (const s of w.level.spikes) {
    if (p.x + 6 > s.x && p.x - 6 < s.x + s.w && p.y + P.halfH > s.y + 3 && p.y - P.halfH < s.y + s.h) {
      if (hurtPlayer(w, 1, p.x, s.y + s.h) && p.status === 'alive') {
        // Spikes set the creature back on the last safe footing rather than juggling it.
        p.x = p.prevX = p.safeX;
        p.y = p.prevY = p.safeY;
        p.vx = p.vy = 0;
      }
      break;
    }
  }
}

/** Level-wide rules: the chasing dark, the clock, hunters drawn by glow. */
export function updateRules(w: World, dt: number): void {
  const p = w.player;
  const r = w.level.rules;
  if (r.chase) {
    const speed = (r.chase / w.diff.mercy) * (w.assist ? 0.85 : 1);
    // It never falls far behind, so a slow start is not a free pass.
    w.chaseX = Math.max(w.chaseX + speed * dt, p.x - 620);
    if (p.x < w.chaseX && p.status === 'alive') w.kill();
  }
  if (r.timeLimit) {
    const before = w.timeLeft;
    w.timeLeft -= dt;
    if (before > 10 && w.timeLeft <= 10) w.emit('timeLow', p.x, p.y, 0);
    if (w.timeLeft <= 0 && p.status === 'alive') w.kill();
  }
  let danger = 0;
  for (const e of w.enemies) {
    if (!e.alive || !e.active) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    const v = (1 - d / 360) * (e.mode === 'windup' || e.mode === 'attack' ? 1 : 0.6);
    if (v > danger) danger = v;
  }
  if (w.boss && w.boss.mode !== 'dead' && w.boss.mode !== 'idleOut') danger = 1;
  if (r.chase) danger = Math.max(danger, clamp(1 - (p.x - w.chaseX) / 420, 0, 1));
  p.danger += (clamp(danger, 0, 1) - p.danger) * Math.min(1, dt * 3);
}
