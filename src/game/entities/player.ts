import { P, SWORDS } from '../core/constants';
import type { Intent } from '../core/types';
import { approach, clamp, damp, sign } from '../core/util';
import type { World } from '../core/world';
import { resolveSlash, swordArt, tidebreakerLand, useRelic, useReward } from '../systems/combat';
import { pulseProps } from './props';

const PROBE = 6;

/** The Tideborn: running, leaping, wall work, dashing, gliding, swimming, the light-blade. One fixed step. */
export function updatePlayer(w: World, inp: Intent, dt: number): void {
  const p = w.player;
  p.prevX = p.x;
  p.prevY = p.y;

  if (p.status !== 'alive') {
    p.statusT += dt;
    p.vx = approach(p.vx, 0, 400 * dt);
    p.vy = approach(p.vy, 30, 300 * dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.glow = approach(p.glow, 0, 3 * dt);
    return;
  }

  const calm = w.mode === 'drift' || w.mode === 'title';
  const waterY = w.waterAt(p.x);
  const crown = p.crownT > 0;

  p.invuln = Math.max(0, p.invuln - dt);
  p.pulseCd = Math.max(0, p.pulseCd - dt);
  p.pulseFlash = Math.max(0, p.pulseFlash - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.dashT = Math.max(0, p.dashT - dt);
  p.dropT = Math.max(0, p.dropT - dt);
  p.coyote = Math.max(0, p.coyote - dt);
  p.buffer = Math.max(0, p.buffer - dt);
  p.leapArm = Math.max(0, p.leapArm - dt);
  p.lockT = Math.max(0, p.lockT - dt);
  p.wallT = Math.max(0, p.wallT - dt);
  p.slashCd = Math.max(0, p.slashCd - dt);
  p.abilityCd = Math.max(0, p.abilityCd - dt);
  p.veilT = Math.max(0, p.veilT - dt);
  p.shield = Math.max(0, p.shield - dt);
  p.emberT = Math.max(0, p.emberT - dt);
  p.crownT = Math.max(0, p.crownT - dt);
  p.hookT = Math.max(0, p.hookT - dt);
  if (p.bloomT > 0) {
    p.bloomT -= dt;
    if (p.bloomT <= 0) {
      p.hp = Math.min(w.load.hpMax, p.hp + 2);
      w.emit('heal', p.x, p.y, 2);
    }
  }

  // --- Medium ---------------------------------------------------------------------------
  const groundHere = Math.min(w.ground.at(p.x - PROBE), w.ground.at(p.x + PROBE));
  const depth = groundHere - waterY;
  const wasSwim = p.swim;
  p.swim = wasSwim ? p.y > waterY - 6 && depth >= 12 : p.y > waterY - 2 && depth >= 16;
  p.wading = !p.swim && p.y + P.halfH > waterY + 1;
  if (p.swim && !wasSwim) {
    if (p.vy > 120) w.emit('splashIn', p.x, waterY, p.vy);
    p.vy *= 0.45;
    p.jumping = false;
    p.onGround = false;
    p.onPlatform = null;
    p.slamming = false;
    p.jumpsLeft = 1;
    p.airDashed = false;
  } else if (!p.swim && wasSwim && p.vy < -60) {
    w.emit('splashOut', p.x, waterY, -p.vy);
  }

  // --- Light: glow, pulse, healing, boss gift ------------------------------------------
  const want = inp.glow && (p.lumen > 0.5 || calm);
  if (want !== p.glowOn) {
    p.glowOn = want;
    w.emit(want ? 'glowOn' : 'glowOff', p.x, p.y, 0);
  }
  p.glow = approach(p.glow, want ? 1 : 0, dt * (want ? 6 : 3.5));
  const lumenBefore = p.lumen;
  if (!calm) {
    if (want) p.lumen = Math.max(0, p.lumen - P.glowDrain * dt);
    else p.lumen = Math.min(w.load.lumenMax, p.lumen + P.lumenRegen * (p.inPool || p.inSafe ? 5 : 1) * dt);
    const low = w.load.lumenMax * 0.2;
    if (lumenBefore >= low && p.lumen < low) w.emit('lowLumen', p.x, p.y, 0);
  } else {
    p.lumen = w.load.lumenMax;
  }

  if (inp.pulse) {
    if (w.has('pulse') && p.pulseCd <= 0 && (calm || p.lumen >= P.pulseCost)) {
      if (!calm) p.lumen -= P.pulseCost;
      p.pulseCd = P.pulseCooldown;
      p.pulseFlash = P.pulseReveal;
      p.invuln = Math.max(p.invuln, P.pulseSafe);
      w.emit('pulse', p.x, p.y, w.load.pulseLevel);
      pulseProps(w, p.x, p.y);
    } else {
      w.emit('pulseFail', p.x, p.y, 0);
    }
  }

  // Healing roots the creature in place: safety has to be made first.
  const canHeal = inp.heal && (p.onGround || p.swim) && p.essence >= 1 && p.hp < w.load.hpMax && !w.level.rules.noHeal && p.slashT <= 0 && p.dashT <= 0;
  if (canHeal) {
    if (p.healT === 0) w.emit('healStart', p.x, p.y, 0);
    p.healT += dt;
    if (p.healT >= P.healTime) {
      p.healT = 0;
      p.essence -= 1;
      p.hp = Math.min(w.load.hpMax, p.hp + w.diff.healAmount);
      w.emit('heal', p.x, p.y, w.diff.healAmount);
    }
  } else {
    p.healT = 0;
  }
  const rooted = p.healT > 0;

  if (inp.ability && !rooted) useReward(w);
  if (inp.item && !rooted) useRelic(w);

  if (p.lockT <= 0 && Math.abs(inp.mx) > 0.2 && p.dashT <= 0 && p.slashT <= 0) p.facing = sign(inp.mx);

  // --- Light-blade ----------------------------------------------------------------------
  const sword = SWORDS[w.load.sword];
  const styles = w.load.styles;
  p.comboT = Math.max(0, p.comboT - dt);
  p.sinceDash = p.dashT > 0 ? 0 : p.sinceDash + dt;
  // A press during the swing before is remembered, so mashing the button chains cleanly.
  if (inp.attack) p.attackBuf = P.attackBuffer;
  else p.attackBuf = Math.max(0, p.attackBuf - dt);
  if (p.attackBuf > 0 && p.slashCd <= 0 && !rooted) {
    p.attackBuf = 0;
    p.slashDir = inp.my < -0.5 ? 'up' : inp.my > 0.5 && !p.onGround && !p.swim ? 'down' : 'side';
    p.slashT = P.slashTime;
    p.slashCd = P.slashCooldown * sword.speed * (crown ? 0.7 : 1);
    p.slashId = w.nextSlashId();
    p.charged = false;
    p.slashMul = 1;
    p.slashReach = sword.reach;
    // Side strikes chain: cut, back-cut, then a heavy finisher with a step forward. The Third Cut
    // technique makes that finisher far stronger. Techniques change what other strikes do too.
    let swing = 0;
    if (p.slashDir === 'side') {
      p.comboN = p.comboT > 0 ? p.comboN + 1 : 1;
      p.comboT = P.comboWindow;
      swing = p.comboN === 2 ? 3 : 0;
      if (p.comboN >= 3) {
        p.comboN = 0;
        swing = 4;
        const third = styles.has('combo');
        p.slashMul = third ? 1.8 : P.finisherMul;
        p.slashReach *= third ? 1.35 : 1.15;
        p.slashCd *= 1.35;
        if (p.onGround) p.vx += p.facing * 150;
        w.emit('finisher', p.x, p.y, p.facing);
      }
      if (styles.has('dashcut') && p.sinceDash < 0.15) {
        p.slashMul *= 1.5;
        p.slashReach *= 1.2;
        w.emit('finisher', p.x, p.y, p.facing);
      }
    } else if (p.slashDir === 'up' && styles.has('rising') && p.onGround) {
      p.slashMul = 1.25;
      p.vy = -330;
      p.onGround = false;
      p.onPlatform = null;
    } else if (p.slashDir === 'down' && styles.has('plunge')) {
      p.slashMul = 2;
    }
    // The event says which swing it was: 0 cut, 1 up, 2 down, 3 back-cut, 4 finisher.
    w.emit('slash', p.x, p.y, p.slashDir === 'up' ? 1 : p.slashDir === 'down' ? 2 : swing);
  }
  if (w.has('charge') && inp.attackHeld && !rooted) {
    const before = p.chargeT;
    p.chargeT += dt;
    if (before < P.chargeTime && p.chargeT >= P.chargeTime) w.emit('chargeReady', p.x, p.y, 0);
  } else {
    if (p.chargeT >= P.chargeTime && !rooted && (calm || p.lumen >= P.chargeCost)) {
      if (!calm) p.lumen -= P.chargeCost;
      p.slashDir = 'side';
      p.slashT = P.slashTime * 1.4;
      p.slashCd = P.slashCooldown * 1.5;
      p.slashId = w.nextSlashId();
      p.charged = true;
      p.slashMul = 1;
      p.slashReach = sword.reach;
      w.emit('chargeSlash', p.x, p.y, p.facing);
      swordArt(w);
    }
    p.chargeT = 0;
  }
  if (p.slashT > 0) {
    p.slashT -= dt;
    resolveSlash(w);
  }

  // --- Dash -----------------------------------------------------------------------------
  if (inp.dash && w.has('dash') && p.dashCd <= 0 && !rooted && (p.swim || p.onGround || (w.has('airdash') && !p.airDashed))) {
    p.dashDir = Math.abs(inp.mx) > 0.2 ? sign(inp.mx) : p.sliding ? -p.wallDir : p.facing;
    p.facing = p.dashDir;
    p.dashT = P.dashTime;
    p.dashCd = P.dashCooldown * (crown ? 0.6 : 1);
    if (!p.swim && !p.onGround) p.airDashed = true;
    p.jumping = false;
    p.slamming = false;
    w.emit('dash', p.x, p.y, p.dashDir);
  }

  if (p.hookT > 0) {
    // Vinehook: reeled straight to the anchor.
    const dx = p.hookX - p.x;
    const dy = p.hookY - p.y;
    const d = Math.hypot(dx, dy) || 1;
    p.vx = (dx / d) * 640;
    p.vy = (dy / d) * 640;
    if (d < 22) {
      p.hookT = 0;
      p.vx *= 0.25;
      p.vy = Math.min(p.vy * 0.25, -120);
      p.jumpsLeft = 1;
      p.airDashed = false;
    }
  } else if (p.swim) swimStep(w, inp, dt, rooted);
  else landStep(w, inp, dt, rooted);

  applyCurrents(w, dt);
  integrate(w, dt);
}

function landStep(w: World, inp: Intent, dt: number, rooted: boolean): void {
  const p = w.player;
  const crown = p.crownT > 0;
  const steer = p.lockT > 0 || rooted ? 0 : inp.mx;
  // Wind shifts what the creature can hold in the air rather than nudging velocity, so it still
  // bites while the stick is held against it.
  const gust = p.onGround || rooted ? 0 : (w.level.rules.wind ?? 0) * P.windPush;
  const target = rooted ? 0 : steer * P.runSpeed * (p.wading ? 0.85 : 1) * (crown ? 1.18 : 1) + gust;

  if (p.dashT > 0) {
    p.vx = p.dashDir * P.dashSpeed;
    p.vy = 0;
  } else if (p.lockT <= 0 || rooted) {
    const speeding = Math.abs(target) > Math.abs(p.vx) || target * p.vx < 0;
    // In the air, speed carried out of a dash bleeds off slowly: a dash-leap covers real distance.
    const carried = !p.onGround && !speeding && target !== 0;
    const rate = p.onGround ? (speeding ? P.accel : P.friction) : carried ? 520 : P.airAccel;
    p.vx = approach(p.vx, target, rate * dt);
  }

  // Wall: slide when pressing into it, hang for a moment first.
  const onWall = w.has('wall') && !p.onGround && p.wallT > 0;
  p.sliding = onWall && p.vy >= 0 && inp.mx * p.wallDir > 0.2 && p.dashT <= 0;
  if (p.sliding) {
    p.clingT += dt;
    const cap = p.clingT < 1.1 ? 0 : P.wallSlide;
    if (p.vy > cap) p.vy = cap;
    p.airDashed = false;
  }

  if (inp.jump) p.buffer = P.buffer;
  if (p.onGround) {
    p.coyote = P.coyote;
    p.jumpsLeft = 1;
    p.clingT = 0;
  }
  if (p.buffer > 0 && !rooted) {
    if (p.coyote > 0) {
      p.dashT = 0;
      p.vy = -P.jumpVel;
      p.onGround = false;
      p.onPlatform = null;
      p.coyote = 0;
      p.buffer = 0;
      p.jumping = true;
      w.emit('jump', p.x, p.y + P.halfH, 0);
    } else if (onWall) {
      p.vx = -p.wallDir * P.wallJumpX;
      p.vy = -P.wallJumpY;
      p.facing = -p.wallDir;
      p.lockT = P.wallLock;
      p.wallT = 0;
      p.buffer = 0;
      p.jumping = true;
      p.jumpsLeft = 1;
      p.airDashed = false;
      p.sliding = false;
      w.emit('wallJump', p.x + p.wallDir * P.halfW, p.y, -p.wallDir);
    } else if (w.has('double') && p.jumpsLeft > 0) {
      p.vy = -P.doubleVel;
      p.jumpsLeft = 0;
      p.buffer = 0;
      p.jumping = true;
      w.emit('doubleJump', p.x, p.y + P.halfH, 0);
    }
  }
  if (p.jumping) {
    if (p.vy >= 0) p.jumping = false;
    else if (!inp.jumpHeld) {
      p.vy *= P.jumpCut;
      p.jumping = false;
    }
  }

  if (inp.my > 0.5 && p.onGround && p.onPlatform) {
    p.dropT = 0.25;
    p.onGround = false;
    p.onPlatform = null;
  }

  if (p.dashT <= 0) {
    const g = P.gravity * (w.level.rules.gravity ?? 1);
    p.vy = Math.min(p.slamming ? 1100 : P.maxFall, p.vy + g * dt);
    // Glide: a held jump while falling spreads the fins.
    p.gliding = w.has('glide') && inp.jumpHeld && !p.onGround && !p.sliding && !p.slamming && p.vy > P.glideFall && p.jumpsLeft === 0;
    if (p.gliding) p.vy = approach(p.vy, P.glideFall, 2600 * dt);
  } else {
    p.gliding = false;
  }
}

function swimStep(w: World, inp: Intent, dt: number, rooted: boolean): void {
  const p = w.player;
  p.sliding = false;
  p.gliding = false;
  let ix = rooted ? 0 : inp.mx;
  let iy = rooted ? 0 : inp.my;
  // Without the dive, the creature can only paddle along the surface.
  if (!w.has('dive') && iy > 0) iy = 0;
  const len = Math.hypot(ix, iy);
  if (len > 1) {
    ix /= len;
    iy /= len;
  }
  const speed = P.swimSpeed * (p.crownT > 0 ? 1.15 : 1);
  const waterY = w.waterAt(p.x);
  const atSurface = p.y <= waterY + 3;
  let tvx = ix * speed;
  let tvy = iy * speed;
  if (Math.abs(iy) < 0.1) tvy = atSurface ? 0 : -P.buoyancy * (w.has('dive') ? 1 : 4);
  if (p.dashT > 0) {
    const dx = Math.abs(ix) > 0.1 || Math.abs(iy) > 0.1 ? ix : p.dashDir;
    tvx = dx * P.dashSpeed * 0.8;
    tvy = iy * P.dashSpeed * 0.8;
  }
  const k = damp(p.dashT > 0 ? 30 : P.swimRate, dt);
  p.vx += (tvx - p.vx) * k;
  p.vy += (tvy - p.vy) * k;

  if (inp.jump) p.leapArm = P.leapArm;
  if (p.y <= waterY + 1.5 && p.vy <= 0) {
    if (p.leapArm > 0 && !rooted) {
      p.vy = -P.leapVel;
      p.vx += ix * 40;
      p.leapArm = 0;
      p.swim = false;
      p.jumping = false;
      p.jumpsLeft = 1;
      p.airDashed = false;
      w.emit('splashOut', p.x, waterY, P.leapVel);
    } else {
      p.vy = 0;
      p.y = waterY + 1.5;
    }
  }
}

function applyCurrents(w: World, dt: number): void {
  const p = w.player;
  p.inSafe = false;
  if (p.y + P.halfH < w.waterAt(p.x)) return;
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
  const feet0 = p.y + P.halfH;
  const head0 = p.y - P.halfH;

  // Horizontal: terrain walls, cave lips, blocks and closed gates stop the creature.
  let nx = clamp(p.x + p.vx * dt, w.minX, w.maxX);
  const dx = nx - p.x;
  let touched = 0;
  if (dx !== 0) {
    const dir = dx > 0 ? 1 : -1;
    const lead = nx + dir * P.halfW;
    const allow = P.stepUp + Math.abs(dx) * 1.6;
    // The face of a cave roof stops the creature but gives it nothing to cling to (it has no top).
    const roofFace = ceil.at(lead) > head0 + allow;
    let blocked = ground.at(lead) < feet0 - allow || roofFace;
    if (!blocked) {
      for (let i = 0; i < w.blocks.length; i++) {
        const b = w.blocks[i];
        if (b.broken || feet0 <= b.y + 2 || head0 >= b.y + b.h - 2) continue;
        if (lead > b.x && lead < b.x + b.w) {
          blocked = true;
          break;
        }
      }
    }
    if (!blocked) {
      for (let i = 0; i < w.gates.length; i++) {
        const g = w.gates[i];
        if (g.open || feet0 < g.y - g.h || head0 > g.y) continue;
        const from = p.x + dir * P.halfW;
        if ((dir > 0 && from <= g.x - 5 && lead > g.x - 5) || (dir < 0 && from >= g.x + 5 && lead < g.x + 5)) {
          blocked = true;
          break;
        }
      }
    }
    if (blocked) {
      nx = p.x;
      touched = roofFace ? 0 : dir;
      p.vx = 0;
      if (p.dashT > 0) p.dashT = 0;
      if (p.hookT > 0) p.hookT = 0;
    }
  }
  p.x = nx;
  if (touched !== 0 && !p.onGround) {
    p.wallDir = touched;
    p.wallT = P.wallGrace;
  }

  // Vertical: ground, platforms, block tops and undersides, cave roof.
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
    ny = g - P.halfH;
    p.vy = 0;
    p.onGround = true;
  }

  for (let i = 0; i < w.blocks.length; i++) {
    const b = w.blocks[i];
    if (b.broken || p.x + PROBE <= b.x || p.x - PROBE >= b.x + b.w) continue;
    if (p.vy >= 0 && feet0 <= b.y + 4 && ny + P.halfH >= b.y) {
      ny = b.y - P.halfH;
      p.vy = 0;
      p.onGround = !p.swim;
    } else if (p.vy < 0 && head0 >= b.y + b.h - 4 && ny - P.halfH <= b.y + b.h) {
      ny = b.y + b.h + P.halfH;
      p.vy = 0;
      p.jumping = false;
    }
  }

  if (!p.onGround && !p.swim && p.dropT <= 0 && p.vy >= 0) {
    for (let i = 0; i < w.platforms.length; i++) {
      const pl = w.platforms[i];
      if (!pl.solid) continue;
      if (p.x < pl.x - PROBE || p.x > pl.x + pl.w + PROBE) continue;
      if (feet0 <= pl.y + 3 + Math.abs(pl.mvy) * dt * 2 && ny + P.halfH >= pl.y) {
        ny = pl.y - P.halfH;
        p.vy = 0;
        p.onGround = true;
        onPlatform = pl;
        if (pl.kind === 'crumble' && pl.timer < 0) pl.timer = 0.45;
        break;
      }
    }
  }
  p.onPlatform = onPlatform;
  if (onPlatform) p.x += onPlatform.mvx * dt;

  const c = Math.max(ceil.at(p.x - PROBE), ceil.at(p.x + PROBE));
  if (ny - P.halfH < c) {
    ny = c + P.halfH;
    if (p.vy < 0) p.vy = 0;
  }
  p.y = ny;

  if (p.onGround) {
    p.airDashed = false;
    p.gliding = false;
    if (!wasOnGround) {
      if (p.slamming) tidebreakerLand(w);
      else if (impact > 160) w.emit('land', p.x, p.y + P.halfH, impact);
    }
    p.slamming = false;
    if (!onPlatform || onPlatform.kind === 'rock') {
      p.safeX = p.x;
      p.safeY = p.y;
    }
  }
}
