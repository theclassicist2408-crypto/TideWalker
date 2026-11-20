import { ENEMY } from '../entities/enemies';
import { DRILL_REPS, FIXED_DT, P } from './constants';
import { newIntent, type DrillId, type Intent, type Waypoint } from './types';
import type { EnemyState, GateState, World } from './world';

/**
 * A plain but competent player used to prove levels can be crossed and guardians beaten.
 * It sees only the world state a player sees on screen and acts through the same Intent:
 * follows the route, leaps and climbs with whatever skills it holds, steps out of telegraphed
 * attacks, strikes in the openings, and heals when it is safe.
 */
export class Bot {
  readonly intent: Intent = newIntent();
  index = 0;
  private pauseT = 0;
  private stuckT = 0;
  private markX = 0;
  private markY = 0;
  private markIndex = -1;
  private reverseT = 0;
  private last: Waypoint | null = null;
  private wasFailed = false;

  /** Called on a bot made fresh after a respawn: pick the route up again from the lantern. */
  resume(): this {
    this.wasFailed = true;
    return this;
  }
  private chargeHold = 0;
  private jumpWait = 0;
  private lastWall = 0;
  private focus: EnemyState | null = null;
  private drillNow: DrillId | null = null;
  private drillT = 0;

  constructor(
    private readonly w: World,
    private readonly collect = false,
  ) {}

  private isMust(t: Waypoint): boolean {
    return Boolean(t.optional || t.ride || t.pause || t.arena !== undefined || t.waitTideAbove !== undefined || t.waitTideBelow !== undefined);
  }

  private shellTaken(t: Waypoint): boolean {
    for (const s of this.w.shells) if (s.x === t.x && s.y === t.y) return s.taken;
    return false;
  }

  /** Is there something to stand on at (x, feet)? */
  private footing(x: number, feet: number): boolean {
    const w = this.w;
    if (w.ground.at(x) <= feet + 26) return true;
    for (const pl of w.platforms) if (pl.solid && x >= pl.x - 6 && x <= pl.x + pl.w + 6 && pl.y >= feet - 6 && pl.y <= feet + 30) return true;
    for (const b of w.blocks) if (!b.broken && x >= b.x && x <= b.x + b.w && b.y >= feet - 6 && b.y <= feet + 30) return true;
    return false;
  }

  /** Is (x, y) inside something solid? */
  private solid(x: number, y: number): boolean {
    const w = this.w;
    if (w.ground.at(x) < y) return true;
    for (const b of w.blocks) if (!b.broken && x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
    return false;
  }

  private crackedAhead(x: number, y: number, dir: number): boolean {
    for (const b of this.w.blocks) {
      if (b.broken || b.kind !== 'cracked') continue;
      const edge = dir > 0 ? b.x - x : x - (b.x + b.w);
      if (edge > -4 && edge < 44 && y > b.y - 8 && y < b.y + b.h + 8) return true;
    }
    return false;
  }

  private retarget(): void {
    const wps = this.w.level.waypoints;
    const px = this.w.player.x;
    let i = 0;
    while (i < wps.length && wps[i].x < px + 6) i++;
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
    out.jump = out.dash = out.pulse = out.glow = out.attack = out.heal = out.ability = false;
    out.attackHeld = false;
    // Hold the jump only while rising: holding it on the way down would glide, and waste time.
    out.jumpHeld = this.w.player.vy < 0 && !this.w.player.onGround;
    this.jumpWait = Math.max(0, this.jumpWait - dt);

    if (w.status === 'failed') {
      this.wasFailed = true;
      return out;
    }
    if (this.wasFailed) {
      this.wasFailed = false;
      this.retarget();
    }

    // --- Route -----------------------------------------------------------------------------
    const wps = w.level.waypoints;
    // Already standing at a later point (a vent or a current carried us there): jump ahead,
    // as long as nothing skipped is a fight or something we were sent to collect.
    if (p.onGround) {
      for (let k = 1; k <= 3 && this.index + k < wps.length; k++) {
        const n = wps[this.index + k];
        if (Math.abs(n.x - p.x) >= 15 || Math.abs(n.y - p.y) >= 26) continue;
        let safe = true;
        for (let j = this.index; j < this.index + k; j++) if (wps[j].arena !== undefined || (wps[j].optional && this.collect)) safe = false;
        if (safe) this.index += k;
        break;
      }
    }
    let t: Waypoint | null = null;
    while (this.index < wps.length) {
      const c = wps[this.index];
      if (c.optional && (!this.collect || this.shellTaken(c))) {
        this.index++;
        continue;
      }
      if (c.arena !== undefined && w.arenas[c.arena].state === 'done') {
        this.advance(c);
        continue;
      }
      const dx = c.x - p.x;
      const dy = c.y - p.y;
      // Reached — or standing right above a point it cannot get down to (buried, or under water with no dive).
      // Under water above low points the route climbs out of again (a current carried us up): skip them.
      let lifted = false;
      if (p.swim && dy > 30 && !c.optional) for (let k = 1; k <= 3 && !lifted; k++) lifted = (wps[this.index + k]?.y ?? Infinity) < p.y + 10;
      const sunk = p.swim && dy > 0 && (!w.has('dive') || lifted);
      if (Math.abs(dx) < 15 && (Math.abs(dy) < 26 || sunk || (p.onGround && dy > 0 && dy < 70))) {
        if (c.arena !== undefined) {
          t = c;
          break;
        }
        if (c.ride) {
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
      // Passed it by — unless it is a ledge well above us that we walked under.
      if (!this.isMust(c) && p.x > c.x + 34 && p.y < c.y + 30) {
        this.advance(c);
        continue;
      }
      t = c;
      break;
    }

    // --- Fight or travel -------------------------------------------------------------------
    const foe = this.pickFoe(t);
    const gate = foe ? null : this.drillGate();
    if (foe) this.fight(foe, out);
    else if (gate) this.drill(gate, out, dt);
    else if (t) this.travel(t, out, dt);
    else out.mx = 1;

    this.avoid(out);
    // A jump pressed now must be held, or it is cut to a hop on its first frame.
    if (out.jump) out.jumpHeld = true;
    this.mend(out, foe !== null);
    return this.unstick(out, dt);
  }

  /** A closed training gate just ahead, if any. */
  private drillGate(): GateState | null {
    const p = this.w.player;
    for (const g of this.w.gates) {
      if (g.kind !== 'drill' || g.open || g.x < p.x - 10 || g.x - p.x > 170 || Math.abs(g.y - p.y) > 220) continue;
      return g;
    }
    return null;
  }

  /** Practises whatever the gate still asks for, the way a player would. */
  private drill(g: GateState, out: Intent, dt: number): void {
    const w = this.w;
    const p = w.player;
    let want: DrillId | null = null;
    for (const d of g.drills ?? []) {
      if (w.drills[d] < DRILL_REPS) {
        want = d;
        break;
      }
    }
    if (!want) return;
    if (want !== this.drillNow) {
      this.drillNow = want;
      this.drillT = 0;
    }
    this.drillT += dt;
    const k = this.drillT;
    const toward = g.x > p.x ? 1 : -1;
    // Keep a little room in front of the gate to move in.
    const room = Math.abs(g.x - p.x) < 40 ? -toward : 0;
    switch (want) {
      case 'jump':
        out.jump = p.onGround;
        break;
      case 'double':
        out.jump = p.onGround || (p.vy > 0 && p.jumpsLeft > 0);
        out.jumpHeld = true;
        break;
      case 'wall':
        out.mx = toward;
        out.jumpHeld = true;
        out.jump = p.onGround || (p.wallT > 0 && p.vy > -100);
        break;
      case 'dash':
        out.mx = room || toward;
        out.dash = p.onGround && p.dashCd <= 0;
        break;
      case 'airdash':
        out.mx = room || -toward;
        out.jump = p.onGround;
        out.jumpHeld = true;
        out.dash = !p.onGround && !p.airDashed && p.dashCd <= 0 && p.vy > -300;
        break;
      case 'glide':
        out.mx = room;
        out.jumpHeld = true;
        out.jump = p.onGround || (p.vy > 0 && p.jumpsLeft > 0);
        break;
      case 'swim':
      case 'dive':
        // The water is behind us: go back in, dive under, climb out, and in again.
        if (!p.swim) out.mx = -1;
        else if (want === 'dive') {
          out.my = 1;
          out.mx = -0.3;
        } else {
          out.mx = 1;
          out.my = -1;
          out.jump = p.y <= w.waterAt(p.x) + 5;
        }
        break;
      case 'strike':
        out.mx = room;
        out.attack = true;
        break;
      case 'upstrike':
        out.my = -1;
        out.attack = true;
        break;
      case 'combo':
        out.mx = room;
        out.attack = p.onGround;
        break;
      case 'downstrike':
        out.jump = p.onGround;
        out.jumpHeld = true;
        out.my = p.onGround ? 0 : 1;
        out.attack = !p.onGround;
        break;
      case 'charge':
        out.mx = room;
        out.attackHeld = k % 1 < 0.72;
        break;
      case 'glow':
        out.glow = k % 0.8 < 0.4;
        break;
      case 'pulse':
        out.pulse = p.pulseCd <= 0 && p.lumen >= P.pulseCost;
        break;
      case 'heal':
        // Healed already: walk back to where the old wound aches.
        if (p.hp >= w.load.hpMax) out.mx = -1;
        else out.heal = true;
        break;
    }
  }

  private advance(c: Waypoint): void {
    this.last = c;
    this.index++;
    this.pauseT = 0;
  }

  // ---- travelling ---------------------------------------------------------------------------

  private travel(t: Waypoint, out: Intent, dt: number): void {
    const w = this.w;
    const p = w.player;
    const wps = w.level.waypoints;
    let tx = t.x;
    let wait = false;
    for (const pl of w.platforms) {
      if (!pl.period || Math.abs(pl.x0 + pl.w / 2 - t.x) > 3 || Math.abs(pl.y0 - 9 - t.y) > 3) continue;
      // A sliding ledge: aim at where it is, and do not leap until it has come close.
      tx = pl.x + pl.w / 2;
      wait = p.onGround && p.onPlatform !== pl && Math.abs(tx - p.x) > 104;
    }
    const dx = tx - p.x;
    const dy = t.y - p.y;
    let dir = Math.abs(dx) > 4 ? Math.sign(dx) : 0;
    // Standing on the lip right above the next point: step off on the side that drops away.
    if (dir === 0 && dy > 30 && p.onGround) dir = 1;
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      dir = -dir || -1;
    }

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

    if (p.swim) {
      const surface = w.waterAt(p.x);
      const above = t.y < surface - 6;
      if (t.y < surface - 74) {
        out.mx = 1;
        out.my = -1;
        if (p.y <= surface + 5 && Math.abs(p.vx) < 14) out.jump = true;
      } else if (above) {
        out.mx = dir;
        out.my = -1;
        if (p.y <= surface + 5 && (Math.abs(dx) < 90 || Math.abs(p.vx) < 12)) out.jump = true;
      } else {
        out.mx = Math.max(-1, Math.min(1, dx / 14));
        out.my = Math.max(-1, Math.min(1, dy / 14));
      }
      return;
    }

    out.mx = dir;
    const look = dir || p.facing;
    const feet = p.y + P.halfH;

    // A cracked wall in the way: charge the blade and break it.
    if (w.has('charge') && this.crackedAhead(p.x, p.y, look)) {
      out.mx = 0;
      p.facing = look;
      this.chargeHold += dt;
      out.attackHeld = this.chargeHold < P.chargeTime + 0.1;
      if (!out.attackHeld) this.chargeHold = 0;
      return;
    }
    this.chargeHold = 0;

    // Down a hole with the route far overhead: head for the far wall and climb it.
    const climbOut = dy < -96 && t.act !== 'climb' && Math.abs(dx) < 400 && w.ground.at(p.x) > t.y + 80;
    if (climbOut) out.mx = 1;
    if (p.onGround) this.lastWall = 0;
    if (p.onGround) {
      const wallHeight = this.wallAhead(p.x, feet, look);
      const gap = !this.footing(p.x + look * 12, feet) && dir !== 0 && !t.swim && t.y < p.y + 60;
      if (wait && gap) {
        out.mx = 0;
        return;
      }
      if (climbOut && (wallHeight > 7 || Math.abs(p.vx) < 10) && this.jumpWait <= 0) {
        out.jump = true;
        return;
      }
      const higher = dy < -16;
      if (wallHeight > 7 && dir !== 0) {
        // Any wall: jump at it. Taller ones are finished with a second jump or by kicking up the face.
        if (this.jumpWait <= 0) out.jump = true;
      } else if (gap) {
        out.jump = true;
        if (w.has('dash') && p.dashCd <= 0 && this.gapWidth(p.x, look, feet) > 96) out.dash = true;
      } else if (higher && Math.abs(dx) < this.reach(-dy)) out.jump = true;
      else {
        for (const u of w.level.urchins) {
          const ux = (u.x - p.x) * look;
          if (ux > 0 && ux < 40 && Math.abs(u.y - p.y) < 22) out.jump = true;
        }
        for (const s of w.level.spikes) {
          const sx = (look > 0 ? s.x - p.x : p.x - (s.x + s.w));
          if (sx > 0 && sx < 30 && Math.abs(s.y - feet) < 30) out.jump = true;
        }
      }
      return;
    }

    // Airborne: spend the extra moves only when they are needed to make the landing.
    if (Math.abs(dx) < 5 && !climbOut) out.mx = 0;
    const falling = p.vy > 30;
    const below = this.footing(p.x + look * 6, feet + Math.max(0, p.vy) * 0.12) || this.footing(p.x, feet);
    const needHeight = t.y < p.y - 14;
    if (p.wallT > 0 && w.has('wall') && (needHeight || !below)) {
      out.mx = p.wallDir;
      this.lastWall = p.wallDir;
      if (p.vy > -120) out.jump = true;
      return;
    }
    // After kicking off a wall straight below the goal, drift back to that wall.
    if (needHeight && out.mx === 0 && this.lastWall !== 0 && p.lockT <= 0) out.mx = this.lastWall;
    if (falling && w.has('double') && p.jumpsLeft > 0 && (needHeight || (!below && Math.abs(dx) > 26))) {
      out.jump = true;
      return;
    }
    // Glide only when there is a long way to go and nothing underfoot.
    if (falling && !below && Math.abs(dx) > 90 && p.jumpsLeft === 0) out.jumpHeld = true;
    if (falling && w.has('airdash') && !p.airDashed && p.dashCd <= 0 && !below && Math.abs(dx) > 70 && p.jumpsLeft === 0) out.dash = true;
  }

  /** Height of the obstacle directly ahead, measured from the feet (0 if the way is clear). */
  private wallAhead(x: number, feet: number, dir: number): number {
    const w = this.w;
    const ax = x + dir * 13;
    let top = w.ground.at(ax);
    for (const b of w.blocks) {
      if (b.broken || ax <= b.x || ax >= b.x + b.w) continue;
      if (b.y < feet - 2 && b.y + b.h > feet - 16 && b.y < top) top = b.y;
    }
    return feet - top;
  }

  private gapWidth(x: number, dir: number, feet: number): number {
    for (let d = 12; d <= 420; d += 10) if (this.footing(x + dir * d, feet)) return d;
    return 420;
  }

  private reach(h: number): number {
    const v = P.jumpVel;
    const g = P.gravity;
    const hh = Math.min(h, 88);
    const tLand = (v + Math.sqrt(Math.max(0, v * v - 2 * g * hh))) / g;
    return P.runSpeed * tLand * 0.8 + 8;
  }

  // ---- fighting -----------------------------------------------------------------------------

  /** Who to fight right now: the arena's guardian, its nearest foe, or something blocking the road. */
  private pickFoe(t: Waypoint | null): { x: number; y: number; r: number; e: EnemyState | null } | null {
    const w = this.w;
    const p = w.player;
    let arena = -1;
    for (let i = 0; i < w.arenas.length; i++) if (w.arenas[i].state === 'active') arena = i;
    if (arena < 0 && t && t.arena !== undefined && Math.abs(t.x - p.x) < 20) {
      // Standing at the mark but the arena has not woken: step in.
      return null;
    }
    const b = w.boss;
    let best: { x: number; y: number; r: number; e: EnemyState | null } | null = null;
    let bestD = Infinity;
    // Finish what was started: chasing whoever is nearest this instant gets nothing killed.
    const f = this.focus;
    if (arena >= 0 && f && f.alive && f.active && f.arena === arena && (!b || b.mode === 'dead')) return { x: f.x, y: f.y, r: ENEMY[f.kind].r, e: f };
    this.focus = null;
    for (const e of w.enemies) {
      if (!e.alive || !e.active) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      // Outside arenas only bother with what is actually in the way and within reach.
      const flyer = ENEMY[e.kind].move === 'fly';
      const mine = arena >= 0 ? e.arena === arena : e.arena < 0 && d < (flyer ? 120 : 150) && Math.abs(e.y - p.y) < (flyer ? 110 : 44) && (e.x - p.x) * (t ? Math.sign(t.x - p.x) || 1 : 1) > -40;
      if (!mine || d >= bestD) continue;
      bestD = d;
      best = { x: e.x, y: e.y, r: ENEMY[e.kind].r, e };
    }
    if (b && b.mode !== 'dead' && (arena === b.arena || w.arenas[b.arena].state === 'active') && bestD > 90) return { x: b.x, y: b.y, r: b.def.r, e: null };
    this.focus = best ? best.e : null;
    return best;
  }

  private fight(f: { x: number; y: number; r: number; e: EnemyState | null }, out: Intent): void {
    const w = this.w;
    const p = w.player;
    const dx = f.x - p.x;
    const dy = f.y - p.y;
    const dir = dx >= 0 ? 1 : -1;
    const e = f.e;
    const b = e ? null : w.boss;
    const reach = P.slashReach + f.r - 8;
    const gapWant = f.r + 30;

    if (p.swim) {
      out.mx = Math.max(-1, Math.min(1, (dx - dir * gapWant) / 20));
      out.my = Math.max(-1, Math.min(1, dy / 20));
      if (Math.abs(dx) < reach && Math.abs(dy) < 26 && p.slashCd <= 0) {
        p.facing = dir;
        out.attack = true;
      }
      // A fish that has drawn back to dart: slip sideways off its line.
      if (e && (e.mode === 'windup' || e.mode === 'attack') && Math.hypot(dx, dy) < 150) {
        out.mx = -e.b;
        out.my = e.a >= 0 ? 1 : -1;
        if (w.has('dash') && p.dashCd <= 0 && e.mode === 'attack') out.dash = true;
      }
      return;
    }

    // When to strike, and when to hang back.
    let open = true;
    let armoured = false;
    const flyer = b !== null && b !== undefined && b.def.move === 'fly';
    if (e) {
      if (e.kind === 'shellback') armoured = !((p.x - e.x) * e.facing < 0 || e.mode === 'rest' || e.mode === 'stun');
      if (e.kind === 'thornbloom') armoured = e.mode === 'idle';
      if (e.kind === 'burrower' && e.mode === 'hidden') {
        // Stand over it to draw it out; the warning ring tells us when to step away.
        out.mx = Math.abs(dx) > 14 ? dir : 0;
        return;
      }
      if (e.kind === 'burrower') open = e.mode === 'rest' || e.mode === 'stun';
      if (e.mode === 'attack' && (e.kind === 'skitter' || e.kind === 'sentinel' || e.kind === 'shellback' || e.kind === 'lurker')) open = false;
    } else if (b) {
      // Flying guardians are only in reach when they come down to recover.
      open = flyer ? b.mode === 'recover' : b.mode === 'recover' || b.mode === 'idle' || b.mode === 'tele';
    }

    if (!open) {
      // Hold a little distance and be ready to leap a charge; flyers get a wider berth.
      const keep = flyer ? f.r + 110 : 70;
      out.mx = Math.abs(dx) < keep ? -dir : 0;
      if (!flyer && p.onGround && Math.abs(dx) < 110 && Math.abs(dy) < 50) out.jump = true;
      return;
    }

    if (armoured && w.has('charge') && p.lumen >= P.chargeCost) {
      // A charged strike goes straight through a shell.
      const near = Math.abs(dx) < P.chargeReach - 8;
      out.mx = near ? 0 : dir;
      p.facing = dir;
      out.attackHeld = !(near && p.chargeT >= P.chargeTime);
      return;
    }
    if (armoured) {
      // Wait just outside its reach: a shellback lunges and is open afterwards; a bloom opens to fire.
      const stand = e && e.kind === 'shellback' ? 58 : 84;
      out.mx = Math.abs(dx) > stand + 8 ? dir : Math.abs(dx) < stand - 14 ? -dir : 0;
      return;
    }

    const far = Math.abs(dx) - gapWant;
    out.mx = far > 6 ? dir : far < -14 ? -dir : 0;
    if (dy < -34) {
      // Target overhead: get under it and cut upward, jumping if it is out of reach.
      out.mx = Math.abs(dx) > 14 ? dir : 0;
      if (Math.abs(dx) < 30) {
        if (dy > -P.slashReach - f.r + 4 && p.slashCd <= 0) {
          out.my = -1;
          out.attack = true;
        } else if (p.onGround) out.jump = true;
        else if (w.has('double') && p.jumpsLeft > 0 && p.vy > 0 && dy < -60) out.jump = true;
      }
      return;
    }
    if (Math.abs(dx) < reach && Math.abs(dy) < 30 && p.slashCd <= 0) {
      p.facing = dir;
      out.mx = far < -14 ? -dir : 0;
      out.attack = true;
    } else if (dy > 40 && Math.abs(dx) < 24 && !p.onGround && p.slashCd <= 0) {
      out.my = 1;
      out.attack = true;
    }
    // A cornered crowd: buy room with a pulse.
    if (w.has('pulse') && p.pulseCd <= 0 && p.lumen >= P.pulseCost + 10 && p.hp <= 2) {
      let near = 0;
      for (const o of w.enemies) if (o.alive && o.active && Math.hypot(o.x - p.x, o.y - p.y) < 90) near++;
      if (near >= 2) out.pulse = true;
    }
  }

  // ---- staying alive ------------------------------------------------------------------------

  /** Steps out of anything that has announced it is about to hurt. Overrides other plans. */
  private avoid(out: Intent): void {
    const w = this.w;
    const p = w.player;
    if (p.swim) return;
    const feet = p.y + P.halfH;
    const floor = w.ground.at(p.x);
    let flee = 0;
    let fleeUrgent = false;
    let mustJump = false;
    let stayLow = false;

    for (const z of w.zones) {
      if (!z.alive) continue;
      const soon = z.warn < 0.5;
      if (!soon) continue;
      if (z.circle) {
        const d = Math.hypot(p.x - z.x, p.y - z.y);
        if (d < z.w + 26) {
          flee = p.x >= z.x ? 1 : -1;
          // Dash only if still inside the ring: a dash carries far, and a burrower that has just
          // erupted is open to a blow from someone who stepped only just clear.
          if (z.warn < 0.3 && d < z.w + 4) fleeUrgent = true;
        }
        continue;
      }
      if (z.dmg <= 0) continue;
      const insideX = p.x > z.x - 14 && p.x < z.x + z.w + 14;
      if (!insideX) continue;
      const tall = z.h > 150;
      if (tall) {
        // A falling column: walk out of it by the nearer side that stays inside the arena.
        const leftRoom = p.x - z.x;
        const rightRoom = z.x + z.w - p.x;
        flee = leftRoom < rightRoom ? -1 : 1;
        if (this.solid(p.x + flee * 60, p.y)) flee = -flee;
        if (z.warn < 0.3) fleeUrgent = true;
      } else if (z.y + z.h >= floor - 4) {
        // Something low along the floor: be in the air when it strikes.
        if (z.warn < 0.2) mustJump = true;
      } else if (z.y + z.h > p.y - 40) {
        stayLow = true;
      }
    }

    for (const s of w.projectiles) {
      if (!s.alive || !s.hostile) continue;
      const dx = s.x - p.x;
      const closing = dx * s.vx < 0;
      if (s.kind === 'wave') {
        if (closing && Math.abs(dx) < 34 + Math.abs(s.vx) * 0.2 && Math.abs(s.y - feet) < 40) mustJump = true;
        continue;
      }
      const fx = s.x + s.vx * 0.22;
      const fy = s.y + s.vy * 0.22 + 0.5 * s.gravity * 0.05;
      if (Math.hypot(fx - p.x, fy - p.y) < 26 || Math.hypot(dx, s.y - p.y) < 30) {
        // Cut it out of the air if the blade is ready; otherwise get out of its line.
        if (p.slashCd <= 0 && Math.abs(dx) < P.slashReach && Math.abs(s.y - p.y) < 24) {
          p.facing = dx >= 0 ? 1 : -1;
          out.attack = true;
          out.my = 0;
        } else if (Math.abs(s.vy) < Math.abs(s.vx)) mustJump = true;
        else flee = dx >= 0 ? -1 : 1;
      }
    }

    const b = w.boss;
    if (b && b.spec && (b.mode === 'act' || (b.mode === 'tele' && b.t < 0.15))) {
      const dx = b.x - p.x;
      if (b.spec.a === 'charge' && dx * b.facing < 0 && Math.abs(dx) < 150 && b.def.move === 'ground') mustJump = true;
      if (b.spec.a === 'charge' && b.def.move === 'fly' && Math.abs(dx) < 150 && Math.abs(b.y - p.y) < 50) flee = dx >= 0 ? -1 : 1;
      if (b.spec.a === 'pull') {
        flee = dx >= 0 ? -1 : 1;
        fleeUrgent = Math.abs(dx) < 150;
      }
    }
    for (const e of w.enemies) {
      if (!e.alive || !e.active || e.mode !== 'attack') continue;
      const dx = e.x - p.x;
      if ((e.kind === 'skitter' || e.kind === 'sentinel' || e.kind === 'shellback' || e.kind === 'lurker') && Math.abs(dx) < 110 && dx * e.vx < 0 && Math.abs(e.y - p.y) < 40) mustJump = true;
      if ((e.kind === 'gloomwing' || e.kind === 'needlefish') && Math.hypot(dx, e.y - p.y) < 90) flee = dx >= 0 ? -1 : 1;
    }

    // Never back out of the arena: an optional guardian forgets the fight if we leave.
    for (const a of w.arenas) {
      if (a.state !== 'active' || flee === 0) continue;
      if (p.x + flee * 70 < a.x0 + 44 || p.x + flee * 70 > a.x1 - 44) flee = -flee;
    }
    if (stayLow) {
      out.jump = false;
      out.jumpHeld = false;
    }
    if (flee !== 0) {
      out.mx = flee;
      out.attack = false;
      out.heal = false;
      if (fleeUrgent && w.has('dash') && p.dashCd <= 0 && (p.onGround || (w.has('airdash') && !p.airDashed))) out.dash = true;
    }
    if (mustJump && !stayLow) {
      out.heal = false;
      if (p.onGround) out.jump = true;
      else if (w.has('double') && p.jumpsLeft > 0 && p.vy > 60 && feet > floor - 50) out.jump = true;
    }
  }

  /** Heals in a quiet moment. */
  private mend(out: Intent, fighting: boolean): void {
    const w = this.w;
    const p = w.player;
    if (p.hp > w.load.hpMax - 2 || p.essence < 1 || w.level.rules.noHeal || !(p.onGround || p.swim)) return;
    if (out.jump || out.dash) return;
    for (const z of w.zones) {
      if (!z.alive || z.warn > 1.3) continue;
      const d = z.circle ? Math.hypot(p.x - z.x, p.y - z.y) - z.w : Math.max(z.x - p.x, p.x - (z.x + z.w));
      if (d < 50) return;
    }
    for (const s of w.projectiles) if (s.alive && s.hostile && Math.hypot(s.x - p.x, s.y - p.y) < 220) return;
    for (const e of w.enemies) if (e.alive && e.active && Math.hypot(e.x - p.x, e.y - p.y) < (fighting ? 190 : 150)) return;
    const b = w.boss;
    if (b && b.mode !== 'dead') {
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      const quiet = (b.mode === 'recover' && b.t > P.healTime - 0.1) || (b.mode === 'idle' && b.t > P.healTime + 0.1) || b.mode === 'intro';
      if (!quiet || d < b.def.r + 50) return;
    }
    out.mx = 0;
    out.my = 0;
    out.attack = false;
    out.heal = true;
  }

  private unstick(out: Intent, dt: number): Intent {
    const p = this.w.player;
    // Progress is a new point, ground covered, or standing at a new height (bouncing in place is not).
    const newHeight = (p.onGround || p.swim) && Math.abs(p.y - this.markY) > 40;
    if (this.index !== this.markIndex || Math.abs(p.x - this.markX) > 24 || newHeight) {
      this.markIndex = this.index;
      this.markX = p.x;
      this.markY = p.y;
      this.stuckT = 0;
      return out;
    }
    let busy = this.w.boss !== null && this.w.boss.mode !== 'dead';
    for (const a of this.w.arenas) if (a.state === 'active') busy = true;
    if (busy || out.heal) return out;
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
  hits: number;
  shells: number;
  shellsTotal: number;
  stuckAt: number;
  missing: string[];
  grants: number;
}

/** Plays a whole level headlessly. Used by tests and by the level verification script. */
export function runBot(make: () => World, collect: boolean, limitSeconds = 900): BotResult {
  const w = make();
  let bot = new Bot(w, collect);
  let t = 0;
  while (t < limitSeconds && w.status !== 'complete') {
    if (w.hitstop > 0) {
      // Impact freeze, exactly as the game applies it.
      w.hitstop -= FIXED_DT;
    } else {
      w.step(bot.update(FIXED_DT), FIXED_DT);
      w.clearEvents();
      if (w.status === 'failed' && w.player.statusT > 0.9) {
        w.respawn();
        bot = new Bot(w, collect).resume();
      }
    }
    t += FIXED_DT;
  }
  const taken = w.shells.filter((s) => s.taken);
  return {
    completed: w.status === 'complete',
    time: w.time,
    fails: w.totalFails,
    hits: w.hitsTaken,
    shells: taken.length,
    shellsTotal: w.level.shells.length,
    stuckAt: Math.round(w.player.x),
    missing: w.shells.filter((s) => !s.taken).map((s) => s.id),
    grants: w.grants.filter((g) => g.taken).length,
  };
}
