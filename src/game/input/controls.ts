import type { Intent } from '../core/types';

export type ControlButton = 'jump' | 'attack' | 'dash' | 'light' | 'heal' | 'ability';

/** A tap of the light button is a pulse; holding it longer than this is a glow. */
export const LIGHT_HOLD_MS = 200;

/**
 * Turns button and stick state into an Intent. Pure: fed presses, releases and a clock,
 * so the same logic serves the touch pad, the keyboard and the tests.
 */
export class Controls {
  mx = 0;
  my = 0;
  private readonly held: Record<ControlButton, boolean> = { jump: false, attack: false, dash: false, light: false, heal: false, ability: false };
  private qJump = false;
  private qAttack = false;
  private qDash = false;
  private qPulse = false;
  private qAbility = false;
  private lightAt = 0;
  private glowing = false;

  reset(): void {
    this.mx = this.my = 0;
    for (const k of Object.keys(this.held) as ControlButton[]) this.held[k] = false;
    this.qJump = this.qAttack = this.qDash = this.qPulse = this.qAbility = false;
    this.glowing = false;
  }

  /** Stick position, each axis -1..1. Small pushes are ignored; firm ones snap to full. */
  stick(x: number, y: number): void {
    this.mx = Math.abs(x) < 0.28 ? 0 : x > 0 ? 1 : -1;
    this.my = Math.abs(y) < 0.5 ? 0 : y > 0 ? 1 : -1;
  }

  press(b: ControlButton, t: number): void {
    if (this.held[b]) return;
    this.held[b] = true;
    if (b === 'jump') this.qJump = true;
    else if (b === 'attack') this.qAttack = true;
    else if (b === 'dash') this.qDash = true;
    else if (b === 'ability') this.qAbility = true;
    else if (b === 'light') this.lightAt = t;
  }

  release(b: ControlButton, t: number): void {
    if (!this.held[b]) return;
    this.held[b] = false;
    if (b === 'light') {
      if (!this.glowing && t - this.lightAt < LIGHT_HOLD_MS) this.qPulse = true;
      this.glowing = false;
    }
  }

  isHeld(b: ControlButton): boolean {
    return this.held[b];
  }

  /** Writes the current intent. Edge-triggered actions are consumed by the call. */
  read(t: number, out: Intent): void {
    if (this.held.light && !this.glowing && t - this.lightAt >= LIGHT_HOLD_MS) this.glowing = true;
    out.mx = this.mx;
    out.my = this.my;
    out.jump = this.qJump;
    out.jumpHeld = this.held.jump;
    out.attack = this.qAttack;
    out.attackHeld = this.held.attack;
    out.dash = this.qDash;
    out.pulse = this.qPulse;
    out.glow = this.glowing;
    out.heal = this.held.heal;
    out.ability = this.qAbility;
    this.qJump = this.qAttack = this.qDash = this.qPulse = this.qAbility = false;
  }
}
