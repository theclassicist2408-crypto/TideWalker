import { FIXED_DT, P } from './constants';
import { newIntent, type Intent, type LevelData, type Waypoint } from './types';
import type { World } from './world';

/**
 * A simple route-following player used to prove levels are completable and shells reachable.
 * It only uses the same Intent a human produces, and deliberately plays plainly:
 * walk, leap gaps and ledges, swim, glow where the route needs light, pulse when cornered.
 */
export class Bot {
  readonly intent: Intent = newIntent();
  index = 0;
  private pauseT = 0;
  private stuckT = 0;
  private markX = 0;
  private markIndex = -1;
  private reverseT = 0;
  private last: Waypoint | null = null;
  private wasFailed = false;
  private resting = false;

  constructor(
    private readonly w: World,
    /** Collector bots also take every optional detour (Memory Shells). */
    private readonly collect = false,
  ) {}

  private isMust(t: Waypoint): boolean {
    return Boolean(t.optional || t.ride || t.pause || t.waitTideAbove !== undefined || t.waitTideBelow !== undefined);
  }

  private shellTaken(t: Waypoint): boolean {
    for (const s of this.w.shells) if (s.x === t.x && s.y === t.y) return s.taken;
    return false;
  }

  private platformAhead(x: number, feet: number): boolean {
    for (const pl of this.w.platforms) {
      if (!pl.solid) continue;
      if (x >= pl.x - 6 && x <= pl.x + pl.w + 6 && pl.y >= feet - 5 && pl.y <= feet + 26) return true;
    }
    return false;
  }

  /** Re-aims at the route after a respawn. */
  private retarget(): void {
    const wps = this.w.level.waypoints;
    const px = this.w.player.x;
    let i = 0;
    while (i < wps.length && wps[i].x < px + 6) i++;
    // Step back over any optional detour that starts just behind us.
    this.index = i;
    this.pauseT = 0;
    this.stuckT = 0;
    this.last = null;
  }

  update(dt: number = FIXED_DT): Intent {
    const w = this.w;
    const p = w.player;
    const out = this.intent;
    out.mx = out.my = 0;
    out.jump = out.dash = out.pulse = out.glow = out.down = false;
    out.jumpHeld = true;

    if (w.status === 'failed') {
      this.wasFailed = true;
      return out;
    }
    if (this.wasFailed) {
      this.wasFailed = false;
      this.retarget();
    }

    const wps = w.level.waypoints;
    let t: Waypoint | null = null;
    while (this.index < wps.length) {
      const c = wps[this.index];
      if (c.optional && (!this.collect || this.shellTaken(c))) {
        this.index++;
        continue;
      }
      const dx = c.x - p.x;
      const dy = c.y - p.y;
      // Reached — or standing right on top of a point that ended up just under the surface.
      if (Math.abs(dx) < 15 && (Math.abs(dy) < 26 || (p.onGround && dy > 0 && dy < 70))) {
        if (c.ride) {
          // Under water a vent is not needed: just swim up.
          if (p.vy < -260 || p.swim) {
            this.advance(c);
            continue;
          }
          return out;
        }
        if (c.pause) {
          this.pauseT += dt;
          out.glow = Boolean(c.glow);
          if (this.pauseT < c.pause) return out;
        }
        if (c.waitTideAbove !== undefined && w.waterY > c.waitTideAbove) return out;
        if (c.waitTideBelow !== undefined && w.waterY < c.waitTideBelow) return out;
        this.advance(c);
        continue;
      }
      if (!this.isMust(c) && p.x > c.x + 34) {
        this.advance(c);
        continue;
      }
      t = c;
      break;
    }
    if (!t) {
      out.mx = 1;
      return this.unstick(out, dt);
    }

    const dx = t.x - p.x;
    const dy = t.y - p.y;
    let dir = Math.abs(dx) > 4 ? Math.sign(dx) : 0;
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      dir = -dir || -1;
    }

    // Light the way a little early: moonglass must be solid before we step onto it.
    out.glow = Boolean(t.glow || this.last?.glow);
    if (!out.glow) {
      let seen = 0;
      for (let i = this.index + 1; i < wps.length && seen < 2; i++) {
        const n = wps[i];
        if (n.optional && !this.collect) continue;
        seen++;
        if (n.glow && Math.abs(n.x - p.x) < 170) out.glow = true;
      }
    }

    // Out of light before a crossing that needs it: stand and let it seep back, as a person would.
    if (out.glow && !p.swim && p.onGround && !this.last?.glow) {
      const need = w.diff.lumenMax * w.diff.trickleTo - 2;
      if (p.lumen < 12) this.resting = true;
      else if (p.lumen >= need) this.resting = false;
      if (this.resting) {
        out.glow = false;
        out.mx = 0;
        return out;
      }
    } else {
      this.resting = false;
    }

    if (p.swim) {
      const above = t.y < w.waterY - 6;
      if (t.y < w.waterY - 62) {
        // Too high to breach to: swim to the far wall and climb its rungs.
        out.mx = 1;
        out.my = -1;
        if (p.y <= w.waterY + 5 && Math.abs(p.vx) < 14) out.jump = true;
      } else if (above) {
        out.mx = dir;
        out.my = -1;
        if (p.y <= w.waterY + 5 && (Math.abs(dx) < 76 || Math.abs(p.vx) < 12)) out.jump = true;
      } else {
        out.mx = Math.max(-1, Math.min(1, dx / 14));
        out.my = Math.max(-1, Math.min(1, dy / 14));
      }
    } else {
      out.mx = dir;
      if (p.onGround) {
        const feet = p.y + P.halfH;
        const lookDir = dir || p.facing;
        const ahead = w.ground.at(p.x + lookDir * 13);
        const wall = ahead < feet - 7 && feet - ahead <= 88;
        const gap = w.ground.at(p.x + lookDir * 11) > feet + 24 && !this.platformAhead(p.x + lookDir * 11, feet);
        const higher = dy < -16;
        if (dy < -96) {
          // Down a dry hole with the way on far overhead: make for the far wall and climb its rungs.
          out.mx = 1;
          if (ahead < feet - 7 || Math.abs(p.vx) < 10) out.jump = true;
        } else if (wall && dir !== 0) out.jump = true;
        else if (gap && dir !== 0 && !t.swim && t.y < p.y + 44) out.jump = true;
        else if (higher && Math.abs(dx) < this.reach(-dy)) out.jump = true;
        else {
          for (const u of w.level.urchins) {
            const ux = (u.x - p.x) * lookDir;
            if (ux > 0 && ux < 34 && Math.abs(u.y - p.y) < 22) out.jump = true;
          }
        }
        if (t.dash && out.jump) out.dash = true;
      } else if (Math.abs(dx) < 5) {
        out.mx = 0;
      }
    }

    // Cornered: pulse. Otherwise darkness is the best defence.
    let nearest = Infinity;
    let aware = false;
    for (const f of w.fish) {
      if (f.mode === 'dormant' || f.mode === 'stunned') continue;
      const d = Math.hypot(f.x - p.x, f.y - p.y);
      if (d < nearest) {
        nearest = d;
        aware = f.mode === 'investigate' || f.mode === 'windup' || f.mode === 'lunge' || f.kind === 'hush';
      }
    }
    if (nearest < 100 && aware && p.pulseCd <= 0 && p.lumen >= P.pulseCost) out.pulse = true;
    if (nearest < 220 && !t.glow && !this.last?.glow) out.glow = false;

    return this.unstick(out, dt);
  }

  private advance(c: Waypoint): void {
    this.last = c;
    this.index++;
    this.pauseT = 0;
  }

  /** Horizontal distance a full jump covers before landing `h` px higher. */
  private reach(h: number): number {
    const v = P.jumpVel;
    const g = P.gravity;
    const hh = Math.min(h, 86);
    const tLand = (v + Math.sqrt(Math.max(0, v * v - 2 * g * hh))) / g;
    return P.runSpeed * tLand * 0.8 + 8;
  }

  private unstick(out: Intent, dt: number): Intent {
    const p = this.w.player;
    if (this.index !== this.markIndex || Math.abs(p.x - this.markX) > 24) {
      this.markIndex = this.index;
      this.markX = p.x;
      this.stuckT = 0;
      return out;
    }
    this.stuckT += dt;
    if (this.stuckT > 2.5 && (p.onGround || p.swim) && Math.floor(this.stuckT * 2) % 2 === 0) out.jump = true;
    if (this.stuckT > 6 && this.reverseT <= 0 && Math.floor(this.stuckT) % 4 === 0) this.reverseT = 0.7;
    return out;
  }
}

export interface BotResult {
  completed: boolean;
  time: number;
  fails: number;
  shells: number;
  shellsTotal: number;
  stuckAt: number;
  missing: string[];
}

/** Plays a whole level headlessly. Used by tests and by the level verification script. */
export function runBot(make: () => World, collect: boolean, limitSeconds = 900): BotResult {
  const w = make();
  const bot = new Bot(w, collect);
  let t = 0;
  while (t < limitSeconds && w.status !== 'complete') {
    w.step(bot.update(FIXED_DT), FIXED_DT);
    w.clearEvents();
    if (w.status === 'failed' && w.player.statusT > 1) w.respawn();
    t += FIXED_DT;
  }
  const level: LevelData = w.level;
  const taken = w.shells.filter((s) => s.taken);
  return {
    completed: w.status === 'complete',
    time: w.time,
    fails: w.totalFails,
    shells: taken.length,
    shellsTotal: level.shells.length,
    stuckAt: Math.round(w.player.x),
    missing: w.shells.filter((s) => !s.taken).map((s) => s.id),
  };
}
