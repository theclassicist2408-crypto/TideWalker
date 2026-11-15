import { P } from '../core/constants';
import type { Intent } from '../core/types';
import { approach, clamp, damp, lerp, sign } from '../core/util';
import type { World } from '../core/world';

const PROBE = 6;

/** Creature movement: running, leaping, wading, swimming, dashing. One fixed step. */
export function updatePlayer(w: World, inp: Intent, dt: number): void {
  const p = w.player;
  p.prevX = p.x;
  p.prevY = p.y;

  if (p.status !== 'alive') {
    // Carried gently away; no control.
    p.statusT += dt;
    p.vx = approach(p.vx, p.status === 'swept' ? -40 : 0, 120 * dt);
    p.vy = approach(p.vy, 26, 200 * dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.glow = approach(p.glow, 0, 2.5 * dt);
    return;
  }

  const drift = w.mode === 'drift' || w.mode === 'title';
  const waterY = w.waterY;
  const frac = w.lumenFrac;
  const lowScale = frac < P.lowLumen ? lerp(P.lowSpeedScale, 1, frac / P.lowLumen) : 1;

  p.invuln = Math.max(0, p.invuln - dt);
  p.pulseCd = Math.max(0, p.pulseCd - dt);
  p.pulseFlash = Math.max(0, p.pulseFlash - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.dashT = Math.max(0, p.dashT - dt);
  p.dropT = Math.max(0, p.dropT - dt);
  p.coyote = Math.max(0, p.coyote - dt);
  p.buffer = Math.max(0, p.buffer - dt);
  p.leapArm = Math.max(0, p.leapArm - dt);

  // --- Medium: air/land, wading, or swimming -------------------------------------------
  const groundHere = Math.min(w.ground.at(p.x - PROBE), w.ground.at(p.x + PROBE));
  const depth = groundHere - waterY;
  const wasSwim = p.swim;
  p.swim = wasSwim ? p.y > waterY - 6 && depth >= 12 : p.y > waterY - 2 && depth >= 16;
  p.wading = !p.swim && p.y + P.halfH > waterY + 1;
  if (p.swim && !wasSwim) {
    if (p.vy > 120) w.emit('splashIn', p.x, waterY, p.vy);
    p.vy *= 0.4;
    p.dashT = 0;
    p.jumping = false;
    p.onGround = false;
    p.onPlatform = null;
  } else if (!p.swim && wasSwim && p.vy < -60) {
    w.emit('splashOut', p.x, waterY, -p.vy);
  }

  // --- Glow and pulse -------------------------------------------------------------------
  if (p.glowLocked && (p.lumen > 6 || drift)) p.glowLocked = false;
  const want = inp.glow && !p.glowLocked && (p.lumen > 0.05 || drift);
  if (inp.glow && !want && !p.glowLocked && !drift) p.glowLocked = true;
  if (want !== p.glowOn) {
    p.glowOn = want;
    w.emit(want ? 'glowOn' : 'glowOff', p.x, p.y, 0);
  }
  p.glow = approach(p.glow, want ? 1 : 0, dt * (want ? 5.5 : 3.2));

  if (inp.pulse) {
    if (p.pulseCd <= 0 && (drift || p.lumen >= P.pulseCost * 0.5)) {
      if (!drift) p.lumen = Math.max(0, p.lumen - P.pulseCost);
      p.pulseCd = P.pulseCooldown;
      p.pulseFlash = P.pulseReveal;
      w.emit('pulse', p.x, p.y, 0);
      w.pulse(p.x, p.y);
    } else {
      w.emit('pulseFail', p.x, p.y, 0);
    }
  }

  if (Math.abs(inp.mx) > 0.1) p.facing = sign(inp.mx);

  // --- Dash (slide on land, burst in water) ---------------------------------------------
  if (inp.dash && p.dashCd <= 0 && (p.swim || p.onGround || !p.airDashed)) {
    p.dashDir = Math.abs(inp.mx) > 0.1 ? sign(inp.mx) : p.facing;
    p.dashT = P.dashTime;
    p.dashCd = P.dashCooldown;
    if (!p.swim && !p.onGround) {
      p.airDashed = true;
      if (p.vy > 0) p.vy *= 0.35;
    }
    w.emit('dash', p.x, p.y, p.dashDir);
  }

  if (p.swim) swimStep(w, inp, dt, lowScale);
  else landStep(w, inp, dt, lowScale);

  applyCurrents(w, dt);
  integrate(w, dt);
}

function landStep(w: World, inp: Intent, dt: number, lowScale: number): void {
  const p = w.player;
  p.crouch = inp.down && p.onGround && Math.abs(inp.mx) < 0.1;
  const scale = lowScale * (p.wading ? P.wadeScale : 1);
  const target = p.crouch ? 0 : inp.mx * P.runSpeed * scale;

  if (p.dashT > 0) {
    p.vx = p.dashDir * P.dashSpeed * (0.62 + 0.38 * (p.dashT / P.dashTime));
  } else {
    const speeding = Math.abs(target) > Math.abs(p.vx) || target * p.vx < 0;
    const rate = p.onGround ? (speeding ? P.accel : P.friction) : P.airAccel;
    p.vx = approach(p.vx, target, rate * dt);
  }

  if (inp.jump) p.buffer = P.buffer;
  if (p.onGround) p.coyote = P.coyote;
  if (p.buffer > 0 && p.coyote > 0) {
    p.vy = -P.jumpVel;
    p.onGround = false;
    p.onPlatform = null;
    p.coyote = 0;
    p.buffer = 0;
    p.jumping = true;
    w.emit('jump', p.x, p.y + P.halfH, 0);
  }
  if (p.jumping) {
    if (p.vy >= 0) p.jumping = false;
    else if (!inp.jumpHeld) {
      p.vy *= P.jumpCut;
      p.jumping = false;
    }
  }

  if (inp.down && p.onGround && p.onPlatform) {
    p.dropT = 0.25;
    p.onGround = false;
    p.onPlatform = null;
  }

  const fastFall = inp.down && !p.onGround && p.vy > -80;
  p.vy = Math.min(P.maxFall, p.vy + P.gravity * (fastFall ? 1.7 : 1) * dt);
}

function swimStep(w: World, inp: Intent, dt: number, lowScale: number): void {
  const p = w.player;
  p.crouch = false;
  let ix = inp.mx;
  let iy = inp.my;
  const len = Math.hypot(ix, iy);
  if (len > 1) {
    ix /= len;
    iy /= len;
  }
  const speed = P.swimSpeed * lowScale;
  const atSurface = p.y <= w.waterY + 3;
  let tvx = ix * speed;
  let tvy = iy * speed;
  // Without vertical steering the creature drifts up and rests at the surface.
  if (Math.abs(iy) < 0.1) tvy = atSurface ? 0 : -P.buoyancy;
  if (p.dashT > 0) {
    const boost = 1 + 1.25 * (p.dashT / P.dashTime);
    tvx = (Math.abs(ix) > 0.1 || Math.abs(iy) > 0.1 ? ix : p.dashDir) * speed * boost;
    tvy *= boost;
  }
  const k = damp(P.swimRate, dt);
  p.vx += (tvx - p.vx) * k;
  p.vy += (tvy - p.vy) * k;

  if (inp.jump) p.leapArm = P.leapArm;
  if (p.y <= w.waterY + 1.5 && p.vy <= 0) {
    if (p.leapArm > 0) {
      // Breach: leave the water in a clean arc.
      p.vy = -P.leapVel;
      p.vx += ix * 36;
      p.leapArm = 0;
      p.swim = false;
      p.jumping = false;
      p.airDashed = false;
      w.emit('splashOut', p.x, w.waterY, P.leapVel);
    } else {
      p.vy = 0;
      p.y = w.waterY + 1.5;
    }
  }
}

function applyCurrents(w: World, dt: number): void {
  const p = w.player;
  p.inSafe = false;
  if (p.y + P.halfH < w.waterY) return;
  for (let i = 0; i < w.currents.length; i++) {
    const c = w.currents[i];
    if (c.power === 0) continue;
    if (p.x < c.x || p.x > c.x + c.w || p.y < c.y || p.y > c.y + c.h) continue;
    if (c.radial) {
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      const dx = cx - p.x;
      const dy = cy - p.y;
      const d = Math.hypot(dx, dy) + 0.001;
      const pull = Math.abs(c.fx) * c.power * clamp(d / (c.w / 2), 0.25, 1);
      p.vx += (dx / d) * pull * dt;
      p.vy += (dy / d) * pull * dt;
    } else {
      p.vx += c.fx * c.power * dt;
      p.vy += c.fy * c.power * dt;
    }
    if (c.safe) p.inSafe = true;
  }
}

function integrate(w: World, dt: number): void {
  const p = w.player;
  const ground = w.ground;
  const ceil = w.ceil;

  // Horizontal move, blocked by walls, low ceilings and closed gates.
  let nx = clamp(p.x + p.vx * dt, w.minX, w.level.width - 10);
  const dx = nx - p.x;
  if (dx !== 0) {
    const dir = dx > 0 ? 1 : -1;
    const lead = nx + dir * P.halfW;
    const allow = P.stepUp + Math.abs(dx) * 1.6;
    const feet = p.y + P.halfH;
    const head = p.y - P.halfH;
    let blocked = ground.at(lead) < feet - allow || ceil.at(lead) > head + allow;
    if (!blocked) {
      for (let i = 0; i < w.gates.length; i++) {
        const g = w.gates[i];
        if (g.open) continue;
        if (feet < g.y - g.h || head > g.y) continue;
        const from = p.x + dir * P.halfW;
        if ((dir > 0 && from <= g.x - 5 && lead > g.x - 5) || (dir < 0 && from >= g.x + 5 && lead < g.x + 5)) {
          blocked = true;
          break;
        }
      }
    }
    if (blocked) {
      nx = p.x;
      p.vx = 0;
      p.dashT = 0;
    }
  }
  p.x = nx;

  // Vertical move against ground, platforms and ceiling.
  const prevFeet = p.y + P.halfH;
  let ny = p.y + p.vy * dt;
  const g = Math.min(ground.at(p.x - PROBE), ground.at(p.x + PROBE));
  const wasOnGround = p.onGround;
  const impact = p.vy;
  p.onGround = false;
  let onPlatform: typeof p.onPlatform = null;

  if (ny + P.halfH >= g) {
    if (p.vy >= 0 || ny + P.halfH > g + 20) {
      ny = g - P.halfH;
      p.vy = 0;
      p.onGround = !p.swim;
    }
  } else if (wasOnGround && !p.swim && p.vy >= 0 && !p.jumping && g - (ny + P.halfH) < 9) {
    // Stay glued to gentle downward slopes instead of micro-falling.
    ny = g - P.halfH;
    p.vy = 0;
    p.onGround = true;
  }

  if (!p.onGround && !p.swim && p.dropT <= 0 && p.vy >= 0) {
    for (let i = 0; i < w.platforms.length; i++) {
      const pl = w.platforms[i];
      if (!pl.solid) continue;
      if (p.x < pl.x - PROBE || p.x > pl.x + pl.w + PROBE) continue;
      if (prevFeet <= pl.y + 3 && ny + P.halfH >= pl.y) {
        ny = pl.y - P.halfH;
        p.vy = 0;
        p.onGround = true;
        onPlatform = pl;
        if (pl.kind === 'crumble' && pl.timer < 0) pl.timer = 0.6;
        break;
      }
    }
  }
  p.onPlatform = onPlatform;

  const c = Math.max(ceil.at(p.x - PROBE), ceil.at(p.x + PROBE));
  if (ny - P.halfH < c) {
    ny = c + P.halfH;
    if (p.vy < 0) p.vy = 0;
  }
  p.y = ny;

  if (p.onGround) {
    p.airDashed = false;
    if (!wasOnGround && impact > 140) w.emit('land', p.x, p.y + P.halfH, impact);
  }
}
