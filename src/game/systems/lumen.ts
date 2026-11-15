import { P } from '../core/constants';
import { clamp } from '../core/util';
import type { World } from '../core/world';

const POOL_REGEN = 34;
const SAFE_REGEN = 12;

/**
 * Lumen: the creature's light and its only life resource.
 * Glow and cold open water drain it; pools, safe currents and land restore it.
 * Running dry never ends a run on land — only lingering in open water does, after a visible fade.
 */
export function updateLumen(w: World, dt: number): void {
  const p = w.player;
  const d = w.diff;
  const max = d.lumenMax;

  // Shelter and visibility flags.
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
  p.inKelp = false;
  for (let i = 0; i < w.level.kelp.length; i++) {
    const k = w.level.kelp[i];
    if (p.x > k.x && p.x < k.x + k.w && p.y < k.y + 6 && p.y > k.y - k.h) {
      p.inKelp = true;
      break;
    }
  }
  p.hidden = p.inKelp && !p.glowOn && p.pulseFlash <= 0 && Math.hypot(p.vx, p.vy) < 48;

  if (w.mode === 'drift' || w.mode === 'title') {
    p.lumen = max;
    p.fadeT = 0;
    return;
  }

  const before = p.lumen;
  let delta = 0;
  if (p.glowOn) delta -= d.glowDrain * w.drainScale;
  if (p.swim && !p.inSafe && !p.inPool) delta -= d.waterDrain * w.drainScale;
  if (p.inPool) delta += POOL_REGEN;
  if (p.inSafe) delta += SAFE_REGEN;
  if (!p.swim && !p.glowOn && p.lumen < max * d.trickleTo) delta += d.trickleRate;
  p.lumen = clamp(p.lumen + delta * dt, 0, max);

  const low = max * P.lowLumen;
  if (before >= low && p.lumen < low) w.emit('lowLumen', p.x, p.y, 0);

  if (p.swim && p.lumen <= 0) {
    if (p.fadeT === 0) w.emit('fading', p.x, p.y, 0);
    p.fadeT += dt;
    if (p.fadeT >= d.fadeTime) w.fail('swept');
  } else {
    p.fadeT = Math.max(0, p.fadeT - dt * 2);
  }
}

/** Adds Lumen from a pickup, clamped to the maximum. */
export function addLumen(w: World, amount: number): void {
  w.player.lumen = clamp(w.player.lumen + amount, 0, w.diff.lumenMax);
}

/** Removes Lumen without ever failing the run by itself. */
export function drainLumen(w: World, amount: number): void {
  w.player.lumen = Math.max(0, w.player.lumen - amount);
}
