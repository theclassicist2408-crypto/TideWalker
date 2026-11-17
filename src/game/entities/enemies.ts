import { P } from '../core/constants';
import type { EnemyKind } from '../core/types';
import { approach, clamp } from '../core/util';
import type { EnemyState, SlashDir, World } from '../core/world';
import { hurtPlayer } from '../systems/combat';

interface Stat {
  hp: number;
  speed: number;
  /** Body radius for contact. */
  r: number;
  /** Distance at which it notices the creature. */
  aggro: number;
  move: 'ground' | 'fly' | 'swim' | 'still';
  windup: number;
  rest: number;
}

/** Base numbers at tier 1; health, speed and cadence scale with the area. */
export const ENEMY: Record<EnemyKind, Stat> = {
  skitter: { hp: 30, speed: 55, r: 12, aggro: 190, move: 'ground', windup: 0.4, rest: 0.7 },
  spitter: { hp: 28, speed: 0, r: 12, aggro: 330, move: 'still', windup: 0.5, rest: 1.7 },
  gloomwing: { hp: 22, speed: 80, r: 11, aggro: 210, move: 'fly', windup: 0.48, rest: 1.0 },
  needlefish: { hp: 22, speed: 60, r: 11, aggro: 230, move: 'swim', windup: 0.45, rest: 1.0 },
  burrower: { hp: 34, speed: 120, r: 13, aggro: 260, move: 'ground', windup: 0.65, rest: 1.8 },
  lurker: { hp: 34, speed: 0, r: 13, aggro: 76, move: 'still', windup: 0.42, rest: 1.3 },
  shellback: { hp: 44, speed: 44, r: 14, aggro: 240, move: 'ground', windup: 0.5, rest: 1.1 },
  broodmother: { hp: 80, speed: 0, r: 18, aggro: 380, move: 'still', windup: 0.6, rest: 3.6 },
  mite: { hp: 8, speed: 185, r: 7, aggro: 400, move: 'ground', windup: 0, rest: 0 },
  stormjelly: { hp: 32, speed: 52, r: 13, aggro: 300, move: 'fly', windup: 0.7, rest: 2.2 },
  emberhusk: { hp: 90, speed: 38, r: 17, aggro: 260, move: 'ground', windup: 0.7, rest: 1.3 },
  thornbloom: { hp: 40, speed: 0, r: 13, aggro: 340, move: 'still', windup: 0.5, rest: 1.2 },
  voidling: { hp: 34, speed: 0, r: 12, aggro: 320, move: 'fly', windup: 0.5, rest: 0.9 },
  sentinel: { hp: 100, speed: 70, r: 14, aggro: 320, move: 'ground', windup: 0.45, rest: 0.9 },
};

export const ENEMY_KINDS = Object.keys(ENEMY) as EnemyKind[];

export function spawnEnemy(w: World, kind: EnemyKind, x: number, y: number, x0: number, x1: number, elite: boolean, arena: number, wave: number): EnemyState {
  const s = ENEMY[kind];
  const hp = Math.round(s.hp * (1 + 0.08 * (w.tier - 1)) * w.diff.enemyHp * (elite ? 1.5 : 1));
  const e: EnemyState = {
    kind,
    x,
    y,
    prevX: x,
    prevY: y,
    vx: 0,
    vy: 0,
    homeX: x,
    homeY: y,
    x0,
    x1,
    hp,
    hpMax: hp,
    facing: -1,
    mode: kind === 'burrower' ? 'hidden' : 'idle',
    t: 0.5 + (w.enemies.length % 5) * 0.2,
    a: 0,
    b: 0,
    elite,
    arena,
    wave,
    active: arena < 0,
    alive: true,
    onGround: false,
    flash: 0,
    burn: 0,
    lastHit: 0,
    spawnT: arena < 0 ? 1 : 0,
  };
  w.enemies.push(e);
  return e;
}

/** Puts every foe back where the level placed it (start and respawn). Summoned ones vanish. */
export function resetEnemies(w: World): void {
  w.enemies = w.enemies.filter((e) => e.wave !== -1);
  for (const e of w.enemies) {
    const done = e.arena >= 0 && w.arenas[e.arena]?.state === 'done';
    e.x = e.prevX = e.homeX;
    e.y = e.prevY = e.homeY;
    e.vx = e.vy = 0;
    e.hp = e.hpMax;
    e.alive = !done;
    e.active = e.arena < 0;
    e.mode = e.kind === 'burrower' ? 'hidden' : 'idle';
    e.t = 0.6;
    e.burn = 0;
    e.flash = 0;
    e.spawnT = e.arena < 0 ? 1 : 0;
  }
}

/** Brings an arena wave into play. Foes shimmer in before they can act. */
export function wakeWave(w: World, arena: number, wave: number): void {
  for (const e of w.enemies) {
    if (e.arena !== arena || e.wave !== wave) continue;
    e.alive = true;
    e.active = true;
    e.hp = e.hpMax;
    e.x = e.prevX = e.homeX;
    e.y = e.prevY = e.homeY;
    e.vx = e.vy = 0;
    e.mode = e.kind === 'burrower' ? 'hidden' : 'idle';
    e.t = 0.4;
    e.spawnT = 0;
    w.emit('spawn', e.x, e.y, 0);
  }
}

/**
 * A blow against a foe. Shields turn frontal slashes; armour turns light ones.
 * @returns what happened, so the blade can recoil off a block.
 */
export function hitEnemy(w: World, e: EnemyState, dmg: number, fromX: number, dir: SlashDir | 'pulse', heavy: boolean): 'hit' | 'blocked' | 'killed' {
  const front = (fromX - e.x) * e.facing > 0;
  if (e.kind === 'shellback' && front && dir === 'side' && !heavy && e.mode !== 'rest' && e.mode !== 'stun') return 'blocked';
  if (e.kind === 'thornbloom' && e.mode === 'idle' && !heavy && dir !== 'down') return 'blocked';
  e.hp -= dmg;
  e.flash = 0.12;
  const s = ENEMY[e.kind];
  if (s.move !== 'still' && e.mode !== 'hidden') {
    e.vx = (e.x >= fromX ? 1 : -1) * (heavy ? 260 : 150);
    if (s.move === 'ground') e.vy = -90;
  }
  // A solid hit interrupts a wind-up.
  if (e.mode === 'windup' && (heavy || e.kind === 'spitter' || e.kind === 'gloomwing')) {
    e.mode = 'rest';
    e.t = 0.5;
  }
  if (e.hp <= 0) {
    e.alive = false;
    w.player.lumen = Math.min(w.load.lumenMax, w.player.lumen + 6);
    w.emit('kill', e.x, e.y, s.r);
    return 'killed';
  }
  w.emit('hit', e.x, e.y, dmg);
  return 'hit';
}

function begin(e: EnemyState, w: World, time: number): void {
  e.mode = 'windup';
  e.t = time * w.warnScale;
  w.emit('enemyWindup', e.x, e.y, 0);
}

function shootAt(w: World, e: EnemyState, tx: number, ty: number, flight: number, spread = 0): void {
  const g = 700;
  const vx = (tx - e.x) / flight + spread;
  const vy = (ty - e.y - 0.5 * g * flight * flight) / flight;
  w.spawnProjectile(e.x, e.y - 6, vx, vy, 6, flight + 1.2, true, 'orb', g);
  w.emit('shot', e.x, e.y, 0);
}

/** Regular enemies. Every attack is announced by a wind-up; every kind has a way to be beaten. */
export function updateEnemies(w: World, dt: number): void {
  const p = w.player;
  const pace = w.pace;
  const notice = w.noticeScale;
  const hunted = Boolean(w.level.rules.glowHunted) && p.glowOn;

  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i];
    if (!e.alive || !e.active) continue;
    e.prevX = e.x;
    e.prevY = e.y;
    e.flash = Math.max(0, e.flash - dt);
    if (e.spawnT < 0.5) {
      e.spawnT += dt;
      continue;
    }
    const s = ENEMY[e.kind];
    if (e.burn > 0) {
      e.burn -= dt;
      e.hp -= 5 * dt;
      if (e.hp <= 0) {
        e.alive = false;
        w.emit('kill', e.x, e.y, s.r);
        continue;
      }
    }
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy);
    const sees = p.status === 'alive' && dist < s.aggro * notice;
    const rest = (s.rest / pace) * (e.elite ? 0.75 : 1);
    e.t -= dt;

    if (e.mode === 'stun') {
      e.vx *= 1 - Math.min(1, 5 * dt);
      if (e.t <= 0) {
        e.mode = e.kind === 'burrower' ? 'hidden' : 'idle';
        e.t = 0.35;
      }
    } else {
      switch (e.kind) {
        case 'skitter':
        case 'mite': {
          if (e.mode === 'idle') {
            if (e.kind === 'mite') {
              e.facing = dx >= 0 ? 1 : -1;
              e.vx = approach(e.vx, e.facing * s.speed * pace, 900 * dt);
              if (e.onGround && Math.abs(dx) < 60 && dy < -20) e.vy = -330;
            } else {
              if (e.x <= e.x0 + 4) e.facing = 1;
              else if (e.x >= e.x1 - 4) e.facing = -1;
              e.vx = approach(e.vx, e.facing * s.speed * pace, 400 * dt);
              if (sees && Math.abs(dy) < 70 && e.t <= 0) {
                e.facing = dx >= 0 ? 1 : -1;
                e.vx = 0;
                begin(e, w, s.windup);
              }
            }
          } else if (e.mode === 'windup') {
            e.vx = approach(e.vx, 0, 900 * dt);
            if (e.t <= 0) {
              e.mode = 'attack';
              e.t = 0.55;
              w.emit('enemyAttack', e.x, e.y, 0);
            }
          } else if (e.mode === 'attack') {
            e.vx = e.facing * 320 * pace;
            if (e.t <= 0 || e.x <= e.x0 + 2 || e.x >= e.x1 - 2) {
              e.mode = 'rest';
              e.t = rest;
            }
          } else {
            e.vx = approach(e.vx, 0, 700 * dt);
            if (e.t <= 0) e.mode = 'idle';
          }
          break;
        }
        case 'spitter':
        case 'thornbloom': {
          e.facing = dx >= 0 ? 1 : -1;
          if (e.mode === 'idle') {
            if (sees && e.t <= 0) begin(e, w, s.windup);
          } else if (e.mode === 'windup') {
            if (e.t <= 0) {
              if (e.kind === 'spitter') {
                shootAt(w, e, p.x, p.y, 0.85);
                if (e.elite) {
                  shootAt(w, e, p.x, p.y, 0.85, 70);
                  shootAt(w, e, p.x, p.y, 0.85, -70);
                }
              } else {
                const a0 = Math.atan2(dy, dx);
                for (const off of e.elite ? [-0.5, -0.25, 0, 0.25, 0.5] : [-0.32, 0, 0.32]) {
                  w.spawnProjectile(e.x, e.y - 4, Math.cos(a0 + off) * 220 * pace, Math.sin(a0 + off) * 220 * pace, 6, 2.2, true);
                }
                w.emit('shot', e.x, e.y, 1);
              }
              e.mode = 'rest';
              e.t = e.kind === 'thornbloom' ? 1.2 : rest;
            }
          } else if (e.t <= 0) {
            e.mode = 'idle';
            e.t = e.kind === 'thornbloom' ? 1.5 / pace : 0;
          }
          break;
        }
        case 'gloomwing': {
          if (e.mode === 'idle') {
            const hx = clamp(sees ? p.x - e.facing * 70 : e.homeX, e.x0, e.x1);
            const hy = sees ? p.y - 96 : e.homeY + Math.sin(w.clock * 2 + i) * 10;
            e.vx += ((hx - e.x) * 2.2 - e.vx * 2) * dt;
            e.vy += ((hy - e.y) * 3 - e.vy * 2.4) * dt;
            if (Math.abs(e.vx) > 6) e.facing = e.vx > 0 ? 1 : -1;
            if (sees && e.t <= 0 && Math.abs(dx) < 190) {
              e.a = p.x;
              e.b = p.y;
              begin(e, w, s.windup);
            }
          } else if (e.mode === 'windup') {
            e.vx *= 1 - Math.min(1, 6 * dt);
            e.vy *= 1 - Math.min(1, 6 * dt);
            if (e.t <= 0) {
              const d = Math.hypot(e.a - e.x, e.b - e.y) || 1;
              e.vx = ((e.a - e.x) / d) * 400 * pace;
              e.vy = ((e.b - e.y) / d) * 400 * pace;
              e.mode = 'attack';
              e.t = Math.min(0.7, d / (400 * pace) + 0.12);
              w.emit('enemyAttack', e.x, e.y, 1);
            }
          } else if (e.mode === 'attack') {
            if (e.t <= 0) {
              e.mode = 'rest';
              e.t = rest;
            }
          } else {
            e.vx *= 1 - Math.min(1, 3 * dt);
            e.vy += (-140 - e.vy) * Math.min(1, 3 * dt);
            if (e.t <= 0) e.mode = 'idle';
          }
          break;
        }
        case 'needlefish': {
          const wet = w.waterY + 14 < w.ground.at(e.x) - 14;
          if (!wet) {
            e.vx = e.vy = 0;
            break;
          }
          if (e.mode === 'idle') {
            if (e.x <= e.x0 + 4) e.facing = 1;
            else if (e.x >= e.x1 - 4) e.facing = -1;
            e.vx = approach(e.vx, e.facing * s.speed * pace, 200 * dt);
            e.vy = approach(e.vy, (e.homeY - e.y) * 2, 200 * dt);
            if (sees && e.t <= 0 && p.y > w.waterY - 30) {
              e.a = dx / (dist || 1);
              e.b = dy / (dist || 1);
              e.facing = dx >= 0 ? 1 : -1;
              begin(e, w, s.windup);
            }
          } else if (e.mode === 'windup') {
            e.vx *= 1 - Math.min(1, 6 * dt);
            e.vy *= 1 - Math.min(1, 6 * dt);
            if (e.t <= 0) {
              e.mode = 'attack';
              e.t = 0.5;
              w.emit('enemyAttack', e.x, e.y, 0);
            }
          } else if (e.mode === 'attack') {
            e.vx = e.a * 400 * pace;
            e.vy = e.b * 400 * pace;
            if (e.t <= 0) {
              e.mode = 'rest';
              e.t = rest;
            }
          } else {
            e.vx *= 1 - Math.min(1, 3 * dt);
            e.vy *= 1 - Math.min(1, 3 * dt);
            if (e.t <= 0) e.mode = 'idle';
          }
          break;
        }
        case 'burrower': {
          const floor = w.ground.at(e.x);
          if (e.mode === 'hidden') {
            e.y = floor + 14;
            e.vy = 0;
            if (sees) e.vx = approach(e.vx, Math.sign(dx) * s.speed * pace, 500 * dt);
            else e.vx = approach(e.vx, 0, 300 * dt);
            if (sees && Math.abs(dx) < 22 && p.y > floor - 90 && e.t <= 0) {
              e.vx = 0;
              w.spawnZone(true, e.x, floor - 10, 30, 0, s.windup, 0.2);
              begin(e, w, s.windup);
            }
          } else if (e.mode === 'windup') {
            e.vx = 0;
            if (e.t <= 0) {
              // Bursts out and is exposed until it digs back in.
              e.y = floor - 13;
              e.mode = 'rest';
              e.t = rest;
              w.emit('enemyAttack', e.x, e.y, 2);
            }
          } else {
            e.vx = 0;
            if (e.t <= 0) {
              e.mode = 'hidden';
              e.t = 0.8 / pace;
            }
          }
          break;
        }
        case 'lurker': {
          if (e.mode === 'idle') {
            e.vx = approach(e.vx, (e.homeX - e.x) * 3, 600 * dt);
            if (sees && e.t <= 0) {
              e.a = dx / (dist || 1);
              e.facing = dx >= 0 ? 1 : -1;
              begin(e, w, s.windup);
            }
          } else if (e.mode === 'windup') {
            if (e.t <= 0) {
              e.mode = 'attack';
              e.t = 0.28;
              e.vx = e.a * 430 * pace;
              w.emit('enemyAttack', e.x, e.y, 0);
            }
          } else if (e.mode === 'attack') {
            if (e.t <= 0) {
              e.mode = 'rest';
              e.t = rest;
            }
          } else {
            e.vx = approach(e.vx, 0, 900 * dt);
            if (e.t <= 0) e.mode = 'idle';
          }
          break;
        }
        case 'shellback':
        case 'emberhusk': {
          if (e.mode === 'idle') {
            if (sees) {
              e.facing = dx >= 0 ? 1 : -1;
              e.vx = approach(e.vx, e.facing * s.speed * pace, 300 * dt);
              const reach = e.kind === 'emberhusk' ? 150 : 64;
              if (Math.abs(dx) < reach && Math.abs(dy) < 80 && e.t <= 0) {
                e.vx = 0;
                begin(e, w, s.windup);
              }
            } else e.vx = approach(e.vx, 0, 300 * dt);
          } else if (e.mode === 'windup') {
            e.vx = 0;
            if (e.t <= 0) {
              if (e.kind === 'emberhusk') {
                // Ground slam: a wave runs out along the floor each way. Jump it.
                for (const d of [-1, 1]) w.spawnProjectile(e.x + d * 16, e.y, d * 250 * pace, 0, 11, 1.15, true, 'wave');
                w.emit('zoneHit', e.x, e.y + 14, 2);
                e.mode = 'rest';
                e.t = rest;
              } else {
                e.mode = 'attack';
                e.t = 0.34;
                e.vx = e.facing * 250 * pace;
                w.emit('enemyAttack', e.x, e.y, 0);
              }
            }
          } else if (e.mode === 'attack') {
            if (e.t <= 0) {
              e.mode = 'rest';
              e.t = rest;
            }
          } else {
            e.vx = approach(e.vx, 0, 800 * dt);
            if (e.t <= 0) e.mode = 'idle';
          }
          break;
        }
        case 'broodmother': {
          if (e.mode === 'idle') {
            if (sees && e.t <= 0) begin(e, w, s.windup);
          } else if (e.mode === 'windup') {
            if (e.t <= 0) {
              let mine = 0;
              for (const o of w.enemies) if (o.alive && o.kind === 'mite' && o.wave === -1 && o.arena === e.arena && Math.abs(o.homeX - e.x) < 2) mine++;
              for (let k = 0; k < 2 && mine + k < (e.elite ? 5 : 3); k++) {
                const m = spawnEnemy(w, 'mite', e.x, e.y - 8, e.x0, e.x1, false, e.arena, -1);
                m.active = true;
                m.spawnT = 0.3;
                m.homeX = e.x;
                m.vx = (k === 0 ? -1 : 1) * 120;
                m.vy = -220;
              }
              w.emit('spawn', e.x, e.y, 1);
              e.mode = 'rest';
              e.t = rest;
            }
          } else if (e.t <= 0) e.mode = 'idle';
          break;
        }
        case 'stormjelly': {
          const hx = clamp(sees ? p.x : e.homeX, e.x0, e.x1);
          const hy = sees ? p.y - 50 : e.homeY;
          if (e.mode !== 'windup') {
            const d = Math.hypot(hx - e.x, hy - e.y) || 1;
            e.vx = approach(e.vx, ((hx - e.x) / d) * s.speed * pace, 160 * dt);
            e.vy = approach(e.vy, ((hy - e.y) / d) * s.speed * pace + Math.sin(w.clock * 3 + i) * 14, 160 * dt);
          } else {
            e.vx *= 1 - Math.min(1, 4 * dt);
            e.vy *= 1 - Math.min(1, 4 * dt);
          }
          if (e.mode === 'idle' && sees && e.t <= 0 && dist < 150) {
            w.spawnZone(true, e.x, e.y, e.elite ? 92 : 74, 0, s.windup, 0.25);
            begin(e, w, s.windup);
          } else if (e.mode === 'windup' && e.t <= 0) {
            e.mode = 'rest';
            e.t = rest;
          } else if (e.mode === 'rest' && e.t <= 0) e.mode = 'idle';
          break;
        }
        case 'voidling': {
          e.vx = e.vy = 0;
          if (e.mode === 'idle') {
            if (sees && e.t <= 0) {
              // Steps out of the dark behind the creature.
              e.x = clamp(p.x - p.facing * 46, e.x0, e.x1);
              e.y = Math.min(p.y - 4, w.ground.at(e.x) - 14);
              e.prevX = e.x;
              e.prevY = e.y;
              e.facing = p.x >= e.x ? 1 : -1;
              w.spawnZone(true, e.x + e.facing * 16, e.y, 34, 0, s.windup, 0.15);
              begin(e, w, s.windup);
            }
          } else if (e.mode === 'windup') {
            if (e.t <= 0) {
              e.mode = 'rest';
              e.t = rest;
              w.emit('enemyAttack', e.x, e.y, 0);
            }
          } else if (e.t <= 0) {
            e.mode = 'idle';
            e.t = (hunted || p.glowOn ? 1.5 : 2.8) / pace;
          }
          break;
        }
        case 'sentinel': {
          if (e.mode === 'idle') {
            e.facing = dx >= 0 ? 1 : -1;
            // It keeps a duelling distance, but only gives ground while it is fresh: a pressed sentinel
            // stands and fights.
            const want = sees ? (Math.abs(dx) < 120 && e.hp > e.hpMax * 0.6 ? -e.facing : Math.abs(dx) > 190 ? e.facing : 0) : 0;
            e.vx = approach(e.vx, want * s.speed * pace, 500 * dt);
            if (sees && e.t <= 0) {
              e.a = e.a === 0 ? 1 : 0;
              e.vx = 0;
              begin(e, w, s.windup);
            }
          } else if (e.mode === 'windup') {
            if (e.t <= 0) {
              if (e.a === 1) {
                const d = dist || 1;
                w.spawnProjectile(e.x, e.y - 6, (dx / d) * 330 * pace, (dy / d) * 330 * pace, 7, 1.6, true);
                w.emit('shot', e.x, e.y, 0);
                e.mode = 'rest';
                e.t = rest * 0.7;
              } else {
                e.mode = 'attack';
                e.t = 0.5;
                e.vx = e.facing * 390 * pace;
                w.emit('enemyAttack', e.x, e.y, 0);
              }
            }
          } else if (e.mode === 'attack') {
            if (e.t <= 0) {
              e.mode = 'rest';
              e.t = rest;
            }
          } else {
            e.vx = approach(e.vx, 0, 900 * dt);
            if (e.t <= 0) e.mode = 'idle';
          }
          break;
        }
      }
    }

    // Movement.
    if (s.move === 'ground' && e.mode !== 'hidden' && !(e.kind === 'burrower' && e.mode === 'windup')) {
      e.vy = Math.min(700, e.vy + 1500 * dt);
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      const floor = w.ground.at(e.x) - s.r;
      e.onGround = false;
      if (e.y >= floor) {
        e.y = floor;
        e.vy = 0;
        e.onGround = true;
      }
    } else if (s.move === 'still') {
      e.x += e.vx * dt;
      e.y = w.ground.at(e.x) - s.r;
    } else {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      const floor = w.ground.at(e.x) - s.r;
      if (e.y > floor) e.y = floor;
      if (s.move === 'swim' && e.y < w.waterY + 10) e.y = w.waterY + 10;
    }
    if (e.x < e.x0) {
      e.x = e.x0;
      if (e.vx < 0) e.vx = 0;
    } else if (e.x > e.x1) {
      e.x = e.x1;
      if (e.vx > 0) e.vx = 0;
    }

    // Touching a foe hurts, except while it is dazed, buried or resting open.
    const harmless = e.mode === 'stun' || e.mode === 'hidden' || (e.kind === 'burrower' && e.mode === 'windup') || (e.kind === 'voidling' && e.mode !== 'rest');
    if (!harmless && dist < s.r + P.halfW - 1) hurtPlayer(w, 1, e.x, e.y);
  }
}
