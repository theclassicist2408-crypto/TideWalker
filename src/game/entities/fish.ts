import { F, P } from '../core/constants';
import { approach, clamp } from '../core/util';
import type { FishState, World } from '../core/world';
import { drainLumen } from '../systems/lumen';

/** Sends every fish home and calms it (level start and respawn). */
export function resetFish(w: World): void {
  for (const f of w.fish) {
    f.x = f.prevX = f.hx1;
    f.y = f.prevY = f.hy1;
    f.vx = f.vy = 0;
    f.leg = 1;
    f.mode = 'patrol';
    f.t = 0;
    f.alert = 0;
    f.curiosity = 0;
    f.missed = false;
  }
}

function steer(f: FishState, tx: number, ty: number, speed: number, dt: number, turn = 4): number {
  const dx = tx - f.x;
  const dy = ty - f.y;
  const d = Math.hypot(dx, dy);
  if (d > 0.5) {
    const k = Math.min(1, turn * dt);
    f.vx += ((dx / d) * speed - f.vx) * k;
    f.vy += ((dy / d) * speed - f.vy) * k;
  }
  return d;
}

/**
 * Shadow-fish. They react to light rather than hunting relentlessly:
 *  - drifter: patrols, investigates light, strikes after a visible wind-up.
 *  - angler: waits behind a false light; strikes if touched or stared at with glow.
 *  - hush: a vast eel on a fixed sweep; light only makes it hurry.
 */
export function updateFish(w: World, dt: number): void {
  const p = w.player;
  const speedScale = w.fishSpeedScale;
  const senseScale = w.diff.fishSense;
  const visible = (p.glowOn || p.pulseFlash > P.pulseReveal - 0.5) && !p.hidden;
  let danger = 0;

  for (let i = 0; i < w.fish.length; i++) {
    const f = w.fish[i];
    f.prevX = f.x;
    f.prevY = f.y;
    const tune = F[f.kind];

    // Fish wait for the tide: no water over their home means they are not here yet.
    const homeFloor = w.ground.at(f.hx1);
    const flooded = w.waterY + 22 < Math.min(homeFloor, Math.max(f.hy1, f.hy2) + 14);
    if (!flooded) {
      f.mode = 'dormant';
      f.alert = approach(f.alert, 0, dt);
      continue;
    }
    if (f.mode === 'dormant') {
      f.mode = 'patrol';
      f.x = f.hx1;
      f.y = f.hy1;
      f.vx = f.vy = 0;
    }

    const dx = p.x - f.x;
    const dy = p.y - f.y;
    const dist = Math.hypot(dx, dy);
    const sense = tune.sense * senseScale;
    const sees = !p.hidden && ((visible && dist < sense) || (p.swim && dist < F.blindSense));
    f.t -= dt;

    switch (f.mode) {
      case 'patrol': {
        if (f.kind === 'angler') {
          steer(f, f.hx1, f.hy1, 20, dt);
          if (visible && dist < sense) f.curiosity += dt;
          else f.curiosity = Math.max(0, f.curiosity - dt * 0.7);
          const touched = dist < tune.strike && !p.hidden && p.y > w.waterY - 12;
          if (touched || f.curiosity > w.diff.anglerPatience) beginWindup(w, f, dx, dist, dy);
        } else {
          const tx = f.leg ? f.hx2 : f.hx1;
          const ty = f.leg ? f.hy2 : f.hy1;
          if (steer(f, tx, ty, tune.patrol * speedScale, dt, 2.2) < 12) f.leg = f.leg ? 0 : 1;
          if (sees) {
            f.mode = 'investigate';
            f.tx = p.x;
            f.ty = p.y;
            w.emit('fishAlert', f.x, f.y, f.kind === 'hush' ? 2 : 1);
          }
        }
        break;
      }
      case 'investigate': {
        if (sees || (visible && dist < sense * 1.3)) {
          f.tx = p.x;
          f.ty = p.y;
        }
        const d = steer(f, f.tx, f.ty, tune.chase * speedScale, dt, f.kind === 'hush' ? 1.6 : 3.2);
        if (f.kind === 'drifter' && visible && dist < tune.strike) beginWindup(w, f, dx, dist, dy);
        else if (!sees && (d < 12 || f.kind === 'hush')) {
          f.mode = 'linger';
          f.t = f.kind === 'hush' ? 0.4 : F.linger;
        }
        break;
      }
      case 'linger': {
        f.vx *= 1 - Math.min(1, 3 * dt);
        f.vy *= 1 - Math.min(1, 3 * dt);
        if (sees) f.mode = 'investigate';
        else if (f.t <= 0) f.mode = 'return';
        break;
      }
      case 'windup': {
        f.vx *= 1 - Math.min(1, 6 * dt);
        f.vy *= 1 - Math.min(1, 6 * dt);
        if (f.t <= 0) {
          f.mode = 'lunge';
          f.t = tune.lungeTime;
          f.missed = true;
          w.emit('fishLunge', f.x, f.y, 0);
        }
        break;
      }
      case 'lunge': {
        const s = tune.lunge * speedScale;
        f.vx = f.lx * s;
        f.vy = f.ly * s;
        if (f.t <= 0) {
          f.mode = 'recover';
          f.t = F.recover;
          if (f.missed && dist < F.nearMiss + 26 && p.invuln <= 0) w.emit('nearMiss', p.x, p.y, 0);
        }
        break;
      }
      case 'recover':
      case 'stunned': {
        f.vx *= 1 - Math.min(1, 2.4 * dt);
        f.vy *= 1 - Math.min(1, 2.4 * dt);
        if (f.t <= 0) f.mode = 'return';
        break;
      }
      case 'return': {
        const d = steer(f, f.hx1, f.hy1, Math.max(40, tune.patrol) * speedScale, dt, 2.4);
        if (sees && f.kind !== 'angler') f.mode = 'investigate';
        else if (d < 14) {
          f.mode = 'patrol';
          f.curiosity = 0;
        }
        break;
      }
      default:
        break;
    }

    f.x += f.vx * dt;
    f.y += f.vy * dt;
    // Stay in the water column; a lunge may break the surface a little.
    const top = w.waterY + (f.mode === 'lunge' ? -8 : 12);
    const floor = w.ground.at(f.x) - 10;
    if (f.y < top) {
      f.y = top;
      if (f.vy < 0) f.vy = 0;
    }
    if (f.y > floor) {
      f.y = Math.max(top, floor);
      if (f.vy > 0) f.vy = 0;
    }
    f.x = clamp(f.x, 20, w.level.width - 20);

    const aware = f.mode === 'investigate' || f.mode === 'windup' || f.mode === 'lunge';
    f.alert = approach(f.alert, aware ? 1 : f.kind === 'angler' ? clamp(f.curiosity / w.diff.anglerPatience, 0, 0.8) : 0, dt * (aware ? 4 : 1.2));

    // Sound and ripples warn of a fish before it can be seen.
    f.rippleT -= dt;
    if (f.rippleT <= 0 && dist < 420) {
      f.rippleT = f.kind === 'hush' ? 0.9 : 2.2;
      w.emit('fishRipple', f.x, w.waterY, f.kind === 'hush' ? 2 : 1);
    }

    const reach = 1 - dist / (sense * 1.4);
    const weight = f.kind === 'hush' ? 1 : aware ? 1 : 0.45;
    if (reach * weight > danger) danger = reach * weight;

    if (f.mode !== 'stunned' && dist < tune.hit + P.halfW - 2) bite(w, f, dx, dy, dist);
    else if (f.mode === 'lunge' && dist < tune.hit + P.halfW + 4) f.missed = false;
  }
  p.danger = approach(p.danger, clamp(danger, 0, 1), dt * 2.5);
}

function beginWindup(w: World, f: FishState, dx: number, dist: number, dy: number): void {
  const tune = F[f.kind];
  f.mode = 'windup';
  f.t = tune.windup;
  const d = dist > 0.5 ? dist : 1;
  f.lx = dx / d;
  f.ly = dy / d;
  w.emit('fishWindup', f.x, f.y, 0);
}

function bite(w: World, f: FishState, dx: number, dy: number, dist: number): void {
  const p = w.player;
  if (p.invuln > 0 || p.hidden) return;
  f.missed = false;
  f.mode = 'recover';
  f.t = F.recover + 0.6;
  f.curiosity = 0;
  if (p.lumen <= 5) {
    w.fail('caught');
    return;
  }
  drainLumen(w, w.diff.bite);
  p.invuln = P.invuln;
  const d = dist > 0.5 ? dist : 1;
  p.vx = (dx / d) * 210;
  p.vy = (dy / d) * 160 - 60;
  p.dashT = 0;
  f.vx = -(dx / d) * 60;
  f.vy = -(dy / d) * 60;
  w.emit('bite', p.x, p.y, w.diff.bite);
}

/** A Lumen Pulse shoves nearby fish away and dazes them. */
export function pulseFish(w: World, x: number, y: number): void {
  for (const f of w.fish) {
    if (f.mode === 'dormant') continue;
    const dx = f.x - x;
    const dy = f.y - y;
    const d = Math.hypot(dx, dy);
    if (d > P.pulsePush) continue;
    const nd = d > 0.5 ? d : 1;
    const strength = f.kind === 'hush' ? 90 : 260;
    f.vx = (dx / nd) * strength;
    f.vy = (dy / nd) * strength;
    f.mode = 'stunned';
    f.t = f.kind === 'hush' ? F.hushStun : F.stun;
    f.curiosity = 0;
  }
}
