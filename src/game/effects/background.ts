import { Container, Sprite, Texture, TilingSprite } from 'pixi.js';
import { LAYER_H, paintLayer, paintSky } from '../../assets/backgrounds/painters';
import { PALETTES, type Palette } from '../../assets/data/palettes';
import type { BiomeId, WeatherDef } from '../core/types';
import { makeRng } from '../core/util';
import type { Gfx } from './gfx';

const STARS = 70;
const CLOUDS = 6;
const PARALLAX = [0.06, 0.14, 0.26];

/** Sky, moon, stars, clouds and three painted parallax layers. Lives in screen space. */
export class Background {
  readonly container = new Container();
  private readonly sky = new Sprite(Texture.WHITE);
  private readonly stars: Sprite[] = [];
  private readonly starSeed: number[] = [];
  private readonly moonHalo: Sprite;
  private readonly moon: Sprite;
  private readonly clouds: Sprite[] = [];
  private readonly layers: TilingSprite[] = [];
  private readonly fills: Sprite[] = [];
  private textures: Texture[] = [];
  private biome: BiomeId | null = null;
  private weather: WeatherDef | null = null;
  private w = 400;
  private h = 800;

  constructor(gfx: Gfx) {
    this.container.addChild(this.sky);
    const rng = makeRng(99);
    for (let i = 0; i < STARS; i++) {
      const s = gfx.sprite(i % 9 === 0 ? 'spark' : 'dot');
      s.blendMode = 'add';
      this.stars.push(s);
      this.starSeed.push(rng(), rng(), rng(), rng());
      this.container.addChild(s);
    }
    this.moonHalo = gfx.sprite('soft');
    this.moonHalo.blendMode = 'add';
    this.moon = gfx.sprite('moon');
    this.container.addChild(this.moonHalo, this.moon);
    for (let i = 0; i < CLOUDS; i++) {
      const c = gfx.sprite('cloud');
      this.clouds.push(c);
      this.container.addChild(c);
    }
    for (let i = 0; i < 3; i++) {
      const fill = new Sprite(Texture.WHITE);
      const layer = new TilingSprite({ texture: Texture.WHITE, width: 16, height: 16 });
      this.fills.push(fill);
      this.layers.push(layer);
      this.container.addChild(fill, layer);
    }
  }

  /** Repaints the backdrop for a biome. Old textures are released. */
  setBiome(biome: BiomeId, weather: WeatherDef): void {
    this.weather = weather;
    if (this.biome === biome) return;
    this.biome = biome;
    for (const t of this.textures) t.destroy(true);
    this.textures = [];
    const pal: Palette = PALETTES[biome];
    const skyTex = Texture.from(paintSky(biome));
    this.textures.push(skyTex);
    this.sky.texture = skyTex;
    for (let i = 0; i < 3; i++) {
      const tex = Texture.from(paintLayer(biome, i as 0 | 1 | 2));
      tex.source.addressMode = 'repeat';
      this.textures.push(tex);
      this.layers[i].texture = tex;
      // Below each layer the world continues in that layer's fogged colour.
      this.fills[i].tint = pal.layers[i];
      this.fills[i].alpha = 0.92;
    }
    this.moon.tint = parseInt(pal.moon.slice(1), 16);
    this.moonHalo.tint = parseInt(pal.moon.slice(1), 16);
    for (const c of this.clouds) c.tint = parseInt(pal.fog.slice(1), 16);
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.sky.width = w;
    this.sky.height = h;
  }

  /**
   * @param camX camera centre x in world px
   * @param camY camera centre y in world px
   * @param scale screen px per world px
   * @param calm 1 normal motion, lower for reduced motion
   */
  update(camX: number, camY: number, scale: number, t: number, calm: number, flash: number): void {
    const w = this.w;
    const h = this.h;
    const weather = this.weather;
    const moonAmt = weather ? weather.moon : 0.8;
    const overcast = weather ? Math.min(1, weather.rain * 0.9 + weather.fog * 0.4) : 0;

    for (let i = 0; i < STARS; i++) {
      const s = this.stars[i];
      const sx = this.starSeed[i * 4];
      const sy = this.starSeed[i * 4 + 1];
      const ph = this.starSeed[i * 4 + 2];
      const sz = this.starSeed[i * 4 + 3];
      // Stars drift a hair with the camera so the sky has depth.
      let x = (sx * (w + 80) - camX * scale * 0.012) % (w + 80);
      if (x < 0) x += w + 80;
      s.position.set(x - 40, sy * h * 0.62 - camY * scale * 0.006);
      const tw = 0.55 + 0.45 * Math.sin(t * (0.6 + ph * 1.8) + ph * 40) * calm;
      const size = (i % 9 === 0 ? 9 : 2.2) + sz * 2.2;
      s.scale.set(size / (i % 9 === 0 ? 64 : 32));
      s.alpha = tw * (0.35 + sz * 0.6) * (1 - overcast * 0.85);
    }

    const mx = w * 0.72 - camX * scale * 0.01;
    const my = h * 0.17 - camY * scale * 0.012;
    const moonSize = Math.min(w, h) * 0.2;
    this.moon.position.set(mx, my);
    this.moon.scale.set(moonSize / 192);
    this.moon.alpha = (0.25 + 0.75 * moonAmt) * (1 - overcast * 0.6);
    this.moonHalo.position.set(mx, my);
    this.moonHalo.scale.set((moonSize * 5.5) / 256);
    this.moonHalo.alpha = (0.1 + 0.26 * moonAmt) * (1 - overcast * 0.5) + flash * 0.25;

    for (let i = 0; i < CLOUDS; i++) {
      const c = this.clouds[i];
      const span = w + 500;
      let x = (i * 211 + t * (5 + i * 1.6) * calm - camX * scale * 0.03) % span;
      if (x < 0) x += span;
      c.position.set(x - 250, h * (0.1 + (i % 4) * 0.085) - camY * scale * 0.02);
      const cs = (1.2 + (i % 3) * 0.5) * (w / 400);
      c.scale.set(cs * 0.5, cs * 0.5 * 0.8);
      c.alpha = 0.5 + overcast * 0.45;
    }

    // The horizon sits a little below mid-screen and shifts gently as the camera rises or dives.
    const layerScale = Math.max(0.8, scale * 0.9) * (h / 800 > 1 ? h / 800 : 1);
    for (let i = 0; i < 3; i++) {
      const layer = this.layers[i];
      const f = PARALLAX[i];
      const lh = LAYER_H * layerScale;
      const baseY = h * (0.52 + i * 0.07) - camY * scale * f;
      layer.width = w;
      layer.height = lh;
      layer.tileScale.set(layerScale);
      layer.tilePosition.x = -camX * scale * f;
      layer.position.set(0, baseY - lh * 0.55);
      const fill = this.fills[i];
      fill.position.set(0, baseY - lh * 0.55 + lh - 1);
      fill.width = w;
      fill.height = Math.max(0, h - fill.y + 2);
    }
  }
}
