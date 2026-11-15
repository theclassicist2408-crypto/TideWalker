import type { Intent } from '../core/types';

/** Tunable thresholds, in CSS pixels and milliseconds. */
export const G = {
  swipeDist: 24,
  reSwipeDist: 38,
  flickSpeed: 0.55,
  tapMove: 12,
  tapTime: 230,
  doubleTap: 320,
  glowHold: 240,
  /** A flick up still gives a healthy leap: jump stays "held" at least this long. */
  minJumpHold: 170,
} as const;

interface Pointer {
  id: number;
  downX: number;
  downY: number;
  downT: number;
  /** Origin of the current swipe segment. */
  ox: number;
  oy: number;
  ot: number;
  x: number;
  y: number;
  travel: number;
  swipes: number;
  lastDir: number;
  holdFrom: number;
}

/**
 * One-thumb gesture recogniser. Pure: fed pointer samples with timestamps, it produces an Intent.
 *
 *  - Swipe / drag sideways: travel that way (latched; the creature keeps going).
 *  - Swipe up: leap (or swim up and breach). Swipe down: stop and crouch, drop, or dive.
 *  - Flick again in the direction of travel: dash.
 *  - Hold: glow for as long as the finger stays down.
 *  - Tap: stop. Double-tap or a second finger: Lumen Pulse.
 */
export class GestureRecognizer {
  /** Latched travel direction. */
  lx = 0;
  ly = 0;
  private primary: Pointer | null = null;
  private glowing = false;
  private jumpUntil = 0;
  private jumpPointer = -1;
  private lastTapT = -10000;
  private beforeTapX = 0;
  private beforeTapY = 0;
  private qJump = false;
  private qDash = false;
  private qPulse = false;
  /** Set when any gesture has been recognised since the last read (tutorial hints). */
  lastGesture: 'none' | 'move' | 'jump' | 'down' | 'glow' | 'pulse' | 'dash' | 'stop' = 'none';

  reset(): void {
    this.lx = 0;
    this.ly = 0;
    this.primary = null;
    this.glowing = false;
    this.jumpUntil = 0;
    this.jumpPointer = -1;
    this.qJump = this.qDash = this.qPulse = false;
  }

  /** Releases any held touch without clearing the latched direction (pause, blur). */
  cancel(): void {
    this.primary = null;
    this.glowing = false;
    this.jumpPointer = -1;
  }

  down(id: number, x: number, y: number, t: number): void {
    if (this.primary) {
      // A second finger anywhere releases a pulse.
      if (id !== this.primary.id) {
        this.qPulse = true;
        this.lastGesture = 'pulse';
      }
      return;
    }
    this.primary = { id, downX: x, downY: y, downT: t, ox: x, oy: y, ot: t, x, y, travel: 0, swipes: 0, lastDir: -1, holdFrom: t };
  }

  move(id: number, x: number, y: number, t: number): void {
    const p = this.primary;
    if (!p || p.id !== id) return;
    p.travel += Math.hypot(x - p.x, y - p.y);
    p.x = x;
    p.y = y;
    const dx = x - p.ox;
    const dy = y - p.oy;
    const dist = Math.hypot(dx, dy);
    const need = p.swipes === 0 ? G.swipeDist : G.reSwipeDist;
    if (dist < need) return;

    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    // 0 right, 1 left, 2 up, 3 down, 4 up-right, 5 up-left, 6 down-right, 7 down-left
    let dir: number;
    if (ax >= ay * 1.7) dir = dx > 0 ? 0 : 1;
    else if (ay >= ax * 1.7) dir = dy < 0 ? 2 : 3;
    else if (dy < 0) dir = dx > 0 ? 4 : 5;
    else dir = dx > 0 ? 6 : 7;

    const fast = dist / Math.max(1, t - p.ot) >= G.flickSpeed;
    const first = p.swipes === 0;
    p.ox = x;
    p.oy = y;
    p.ot = t;
    if (!first && dir === p.lastDir) return;
    p.swipes++;
    p.lastDir = dir;
    if (!this.glowing) p.holdFrom = t;
    this.applyDirection(dir, fast && first, id, t);
  }

  private applyDirection(dir: number, flick: boolean, id: number, t: number): void {
    const prevX = this.lx;
    switch (dir) {
      case 0:
      case 1: {
        const sx = dir === 0 ? 1 : -1;
        if (flick && prevX === sx) {
          this.qDash = true;
          this.lastGesture = 'dash';
        } else this.lastGesture = 'move';
        this.lx = sx;
        this.ly = 0;
        break;
      }
      case 2:
        this.ly = -1;
        this.jump(id, t);
        break;
      case 3:
        this.lx = 0;
        this.ly = 1;
        this.lastGesture = 'down';
        break;
      case 4:
      case 5:
        this.lx = dir === 4 ? 1 : -1;
        this.ly = -1;
        this.jump(id, t);
        break;
      default:
        this.lx = dir === 6 ? 1 : -1;
        this.ly = 1;
        this.lastGesture = 'down';
        break;
    }
  }

  private jump(id: number, t: number): void {
    this.qJump = true;
    this.jumpPointer = id;
    this.jumpUntil = t + G.minJumpHold;
    this.lastGesture = 'jump';
  }

  up(id: number, _x: number, _y: number, t: number): void {
    const p = this.primary;
    if (!p || p.id !== id) return;
    this.primary = null;
    this.glowing = false;
    if (this.jumpPointer === id) this.jumpPointer = -1;
    if (p.swipes === 0 && p.travel < G.tapMove && t - p.downT < G.tapTime) {
      if (t - this.lastTapT < G.doubleTap) {
        // Double tap: pulse, and carry on the way we were going.
        this.qPulse = true;
        this.lx = this.beforeTapX;
        this.ly = this.beforeTapY;
        this.lastTapT = -10000;
        this.lastGesture = 'pulse';
      } else {
        this.beforeTapX = this.lx;
        this.beforeTapY = this.ly;
        this.lx = 0;
        this.ly = 0;
        this.lastTapT = t;
        this.lastGesture = 'stop';
      }
    }
  }

  /** On-screen pulse button. */
  pressPulse(): void {
    this.qPulse = true;
    this.lastGesture = 'pulse';
  }

  /** Writes the current intent. Edge-triggered actions are consumed by the call. */
  read(t: number, out: Intent): void {
    const p = this.primary;
    if (p && !this.glowing && t - p.holdFrom >= G.glowHold) {
      this.glowing = true;
      this.lastGesture = 'glow';
    }
    out.mx = this.lx;
    out.my = this.ly;
    out.down = this.ly > 0 && this.lx === 0;
    out.glow = this.glowing;
    out.jumpHeld = t < this.jumpUntil || (p !== null && this.jumpPointer === p.id);
    out.jump = this.qJump;
    out.dash = this.qDash;
    out.pulse = this.qPulse;
    this.qJump = this.qDash = this.qPulse = false;
  }
}
