import { Container, RenderTexture, Sprite, type Renderer } from 'pixi.js';
import type { Gfx } from './gfx';

/** Screen pixels per lightmap texel. Light is soft, so a coarse map is free quality. */
const TEXEL = 4;
const MAX_LIGHTS = 72;

/**
 * Darkness and light. Each frame the scene's lights are drawn additively into a small texture
 * that starts at the biome's ambient colour; that texture is then multiplied over the world.
 * Unlit places sink into blue shadow; the creature's glow restores true colour.
 */
export class Lightmap {
  readonly sprite: Sprite;
  private rt: RenderTexture;
  private readonly stage = new Container();
  private readonly pool: Sprite[] = [];
  private used = 0;
  private scale = 1;
  private left = 0;
  private top = 0;
  private readonly clear = new Float32Array([0, 0, 0, 1]);

  constructor(gfx: Gfx) {
    this.rt = RenderTexture.create({ width: 64, height: 64, resolution: 1 });
    this.sprite = new Sprite(this.rt);
    this.sprite.blendMode = 'multiply';
    this.sprite.scale.set(TEXEL);
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const s = gfx.sprite('soft');
      s.blendMode = 'add';
      s.visible = false;
      this.stage.addChild(s);
      this.pool.push(s);
    }
  }

  resize(screenW: number, screenH: number): void {
    const w = Math.ceil(screenW / TEXEL) + 1;
    const h = Math.ceil(screenH / TEXEL) + 1;
    if (this.rt.width !== w || this.rt.height !== h) {
      const old = this.rt;
      this.rt = RenderTexture.create({ width: w, height: h, resolution: 1 });
      this.sprite.texture = this.rt;
      old.destroy(true);
    }
  }

  /** Starts a frame. `scale` is screen px per world px; left/top is the camera corner in world px. */
  begin(scale: number, left: number, top: number): void {
    this.scale = scale;
    this.left = left;
    this.top = top;
    this.used = 0;
  }

  /** Adds a light at a world position. `radius` in world px. */
  add(x: number, y: number, radius: number, colour: number, intensity: number): void {
    if (this.used >= MAX_LIGHTS || intensity <= 0.01) return;
    const s = this.pool[this.used++];
    const k = this.scale / TEXEL;
    s.visible = true;
    s.position.set((x - this.left) * k, (y - this.top) * k);
    // The soft sprite's visible falloff ends around 60% of its radius.
    s.scale.set((radius * 3.2 * k) / 256);
    s.tint = colour;
    s.alpha = intensity > 1 ? 1 : intensity;
  }

  /** Adds a light at a screen position (sky, moon). `radius` in screen px. */
  addScreen(x: number, y: number, radius: number, colour: number, intensity: number): void {
    if (this.used >= MAX_LIGHTS || intensity <= 0.01) return;
    const s = this.pool[this.used++];
    s.visible = true;
    s.position.set(x / TEXEL, y / TEXEL);
    s.scale.set((radius * 3.2) / TEXEL / 256);
    s.tint = colour;
    s.alpha = intensity > 1 ? 1 : intensity;
  }

  render(renderer: Renderer, r: number, g: number, b: number): void {
    for (let i = this.used; i < MAX_LIGHTS; i++) {
      if (!this.pool[i].visible) break;
      this.pool[i].visible = false;
    }
    this.clear[0] = r;
    this.clear[1] = g;
    this.clear[2] = b;
    renderer.render({ container: this.stage, target: this.rt, clear: true, clearColor: this.clear });
  }
}
