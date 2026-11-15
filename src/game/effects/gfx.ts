import { Rectangle, Sprite, Texture } from 'pixi.js';
import { buildAtlas, type SpriteName } from '../../assets/sprites/atlas';

/** Wraps the procedural atlas as Pixi textures. All sprites share one GPU texture. */
export class Gfx {
  readonly inv: number;
  private readonly textures = new Map<string, Texture>();

  constructor() {
    const atlas = buildAtlas(2);
    this.inv = 1 / atlas.scale;
    const base = Texture.from(atlas.canvas);
    base.source.scaleMode = 'linear';
    for (const name of Object.keys(atlas.frames)) {
      const f = atlas.frames[name];
      // Inset by half a pixel so neighbours never bleed in when scaled.
      this.textures.set(name, new Texture({ source: base.source, frame: new Rectangle(f.x + 0.5, f.y + 0.5, f.w - 1, f.h - 1) }));
    }
  }

  tex(name: SpriteName): Texture {
    const t = this.textures.get(name);
    if (!t) throw new Error(`Unknown sprite ${name}`);
    return t;
  }

  /** Sprite at its natural logical size, anchored at (ax, ay). */
  sprite(name: SpriteName, ax = 0.5, ay = 0.5): Sprite {
    const s = new Sprite(this.tex(name));
    s.anchor.set(ax, ay);
    s.scale.set(this.inv);
    return s;
  }

  /** Logical width/height of a sprite frame. */
  size(name: SpriteName): { w: number; h: number } {
    const t = this.tex(name);
    return { w: t.frame.width * this.inv, h: t.frame.height * this.inv };
  }
}

/** Linear blend of two 0xRRGGBB colours. */
export function mixColor(a: number, b: number, t: number): number {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  const r = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * k;
  const g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * k;
  const bl = (a & 255) + ((b & 255) - (a & 255)) * k;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}
