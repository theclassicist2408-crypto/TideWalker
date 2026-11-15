import { clamp, damp } from './util';

/** Smooth follow camera with look-ahead, a vertical dead zone and optional trauma shake. */
export class Camera {
  x = 0;
  y = 0;
  /** Final offsets applied on top of x/y for shake. */
  shakeX = 0;
  shakeY = 0;
  viewW = 400;
  viewH = 800;
  private trauma = 0;
  private lookX = 0;
  private time = 0;
  /** 0 disables shake entirely (accessibility), 1 is full. */
  shakeScale = 1;

  setView(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
  }

  /** Jumps straight to the target (level start, respawn). */
  snap(px: number, py: number, minX: number, maxX: number): void {
    this.lookX = 0;
    this.x = this.clampX(px, minX, maxX);
    this.y = py - this.viewH * 0.15;
    this.trauma = 0;
    this.shakeX = this.shakeY = 0;
  }

  private clampX(x: number, minX: number, maxX: number): number {
    const half = this.viewW / 2;
    if (maxX - minX <= this.viewW) return (minX + maxX) / 2;
    return clamp(x, minX + half, maxX - half);
  }

  /** Adds impact energy (0..1). Only major impacts should call this. */
  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount * this.shakeScale);
  }

  update(px: number, py: number, vx: number, facing: number, dt: number, minX: number, maxX: number): void {
    this.time += dt;
    const lookTarget = facing * 34 + clamp(vx * 0.22, -46, 46);
    this.lookX += (lookTarget - this.lookX) * damp(2.2, dt);
    const tx = this.clampX(px + this.lookX, minX, maxX);
    this.x += (tx - this.x) * damp(5, dt);

    // Vertical: keep the creature a little below centre, ignoring small hops.
    const ty = py - this.viewH * 0.15;
    const dy = ty - this.y;
    const dead = 26;
    if (Math.abs(dy) > dead) this.y += (dy - Math.sign(dy) * dead) * damp(4.2, dt);
    else this.y += dy * damp(0.9, dt);

    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const power = this.trauma * this.trauma * 7;
    this.shakeX = Math.sin(this.time * 61.3) * power;
    this.shakeY = Math.cos(this.time * 47.9) * power;
  }

  get left(): number {
    return this.x + this.shakeX - this.viewW / 2;
  }

  get top(): number {
    return this.y + this.shakeY - this.viewH / 2;
  }
}
