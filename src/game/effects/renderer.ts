import { Application, Container, type Sprite } from 'pixi.js';
import { LIGHT, PALETTES, type Palette } from '../../assets/data/palettes';
import { Camera } from '../core/camera';
import { P, VIEW_MIN_H, VIEW_W } from '../core/constants';
import type { GameEvent } from '../core/types';
import { clamp, damp } from '../core/util';
import type { World } from '../core/world';
import { OPEN_SKY } from '../systems/terrain';
import { Background } from './background';
import { CreatureView } from './creatureView';
import { EntityLayer } from './entityViews';
import { CombatLayer } from './combatView';
import { Gfx, mixColor } from './gfx';
import { Lightmap } from './lightmap';
import { ParticleLayer } from './particles';
import { TerrainView, WaterView } from './terrainView';

export interface RenderOptions {
  reducedMotion: boolean;
  screenShake: boolean;
  visualCues: boolean;
}

const RAIN = 120;

/** Draws a World. Owns the Pixi application, camera and every visual effect. */
export class GameRenderer {
  readonly app = new Application();
  readonly camera = new Camera();
  private background!: Background;
  private terrain!: TerrainView;
  private water = new WaterView();
  private entities!: EntityLayer;
  private creature!: CreatureView;
  private lightmap!: Lightmap;
  private motes!: ParticleLayer;
  private sparks!: ParticleLayer;
  private bubbles!: ParticleLayer;
  private readonly worldC = new Container();
  private readonly overlay = new Container();
  private combat!: CombatLayer;
  private rain: Sprite[] = [];
  private rainSeed: Float32Array = new Float32Array(RAIN * 3);
  private vignette!: Sprite;
  private edgeL!: Sprite;
  private edgeR!: Sprite;
  private flashSprite!: Sprite;
  private world: World | null = null;
  private pal: Palette = PALETTES.storm;
  private scale = 1;
  private screenW = 400;
  private screenH = 800;
  private time = 0;
  private flash = 0;
  private nextBolt = 6;
  private cave = 0;
  private trailT = 0;
  private ambientT = 0;
  private guideT = 0;
  private slowFrames = 0;
  private resolution = 1;
  options: RenderOptions = { reducedMotion: false, screenShake: true, visualCues: true };
  /** Called when lightning strikes, so audio can answer with thunder. */
  onThunder: (() => void) | null = null;
  /** Draw calls are not exposed by Pixi; sprite counts are a good proxy for the perf overlay. */
  stats = { fps: 60, frameMs: 16.7, resolution: 1 };

  async init(parent: HTMLElement): Promise<void> {
    this.resolution = Math.min(window.devicePixelRatio || 1, 2);
    await this.app.init({
      background: 0x070b1c,
      antialias: false,
      resolution: this.resolution,
      autoDensity: true,
      powerPreference: 'high-performance',
      preference: 'webgl',
      resizeTo: parent,
      autoStart: false,
    });
    this.app.canvas.classList.add('game-canvas');
    parent.prepend(this.app.canvas);

    const gfx = new Gfx();
    this.background = new Background(gfx);
    this.terrain = new TerrainView(gfx);
    this.entities = new EntityLayer(gfx);
    this.creature = new CreatureView(gfx);
    this.combat = new CombatLayer(gfx);
    this.lightmap = new Lightmap(gfx);
    this.motes = new ParticleLayer(gfx, 220, false);
    this.sparks = new ParticleLayer(gfx, 260, true);
    this.bubbles = new ParticleLayer(gfx, 160, false);

    const glow = new Container();
    glow.addChild(this.entities.glow, this.combat.glow, this.creature.halo, this.creature.trail, this.sparks.container);
    this.worldC.addChild(
      this.terrain.back,
      this.water.g,
      this.entities.back,
      this.terrain.ground,
      this.terrain.front,
      this.combat.back,
      this.entities.mid,
      this.combat.mid,
      this.creature.root,
      this.entities.front,
      this.motes.container,
      this.bubbles.container,
      this.combat.zones,
      glow,
    );

    for (let i = 0; i < RAIN; i++) {
      const s = gfx.sprite('streak');
      s.visible = false;
      this.rain.push(s);
      this.overlay.addChild(s);
      this.rainSeed[i * 3] = Math.random();
      this.rainSeed[i * 3 + 1] = Math.random();
      this.rainSeed[i * 3 + 2] = 0.6 + Math.random() * 0.8;
    }
    this.flashSprite = gfx.sprite('white', 0, 0);
    this.flashSprite.blendMode = 'add';
    this.flashSprite.alpha = 0;
    this.edgeL = gfx.sprite('soft');
    this.edgeR = gfx.sprite('soft');
    for (const e of [this.edgeL, this.edgeR]) {
      e.blendMode = 'add';
      e.tint = LIGHT.danger;
      e.alpha = 0;
    }
    this.vignette = gfx.sprite('vignette', 0, 0);
    this.overlay.addChild(this.flashSprite, this.edgeL, this.edgeR, this.vignette);

    this.app.stage.addChild(this.background.container, this.worldC, this.lightmap.sprite, this.overlay);
    this.resize();
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  /** Recomputes the view after a size or orientation change. */
  resize(): void {
    this.app.resize();
    const w = (this.screenW = this.app.screen.width);
    const h = (this.screenH = this.app.screen.height);
    this.scale = Math.min(w / VIEW_W, h / VIEW_MIN_H);
    this.camera.setView(w / this.scale, h / this.scale);
    this.background.resize(w, h);
    this.lightmap.resize(w, h);
    this.vignette.width = w;
    this.vignette.height = h;
    this.flashSprite.width = w;
    this.flashSprite.height = h;
    const p = this.world?.player;
    if (p && this.world) this.camera.snap(p.x, p.y, this.world.minX - 10, this.world.maxX + 10);
  }

  setWorld(w: World): void {
    this.world = w;
    this.pal = PALETTES[w.level.biome];
    this.background.setBiome(w.level.biome, w.level.weather);
    this.terrain.reset(w.level.id + w.mode);
    this.entities.sync(w);
    this.combat.setWorld(w, this.pal);
    this.motes.clear();
    this.sparks.clear();
    this.bubbles.clear();
    this.creature.reset(w.player.x, w.player.y);
    this.camera.snap(w.player.x, w.player.y, w.minX - 10, w.maxX + 10);
    this.flash = 0;
    this.nextBolt = 4 + Math.random() * 6;
    this.cave = 0;
  }

  /** Camera snap after a respawn or resume. */
  snapCamera(): void {
    const w = this.world;
    if (!w) return;
    this.creature.reset(w.player.x, w.player.y);
    this.camera.snap(w.player.x, w.player.y, w.minX - 10, w.maxX + 10);
  }

  /** Damage numbers: one particle per digit, floating up off the target. */
  private number(x: number, y: number, n: number): void {
    const digits = n >= 100 ? 3 : n >= 10 ? 2 : 1;
    const vx = (Math.random() - 0.5) * 30;
    for (let i = 0; i < digits; i++) {
      const d = Math.floor(n / 10 ** (digits - 1 - i)) % 10;
      this.motes.spawn({ frame: `n${d}`, x: x + (i - (digits - 1) / 2) * 7, y, vx, vy: -70, gravity: 90, ttl: 0.75, s0: 8, s1: 8, alpha: 1 });
    }
  }

  /** Turns a simulation event into particles, squash and camera feedback. */
  onEvent(e: GameEvent): void {
    const { x, y, v } = e;
    const sp = this.sparks;
    const mo = this.motes;
    const cam = this.camera;
    const cr = this.creature;
    const rnd = Math.random;
    switch (e.type) {
      case 'jump':
        cr.squash(0.72, 1.34);
        for (let i = 0; i < 4; i++) mo.spawn({ x: x + (rnd() - 0.5) * 10, y, vx: (rnd() - 0.5) * 50, vy: -10 - rnd() * 20, ttl: 0.4, s0: 5, s1: 9, alpha: 0.3, tint: this.pal.rim });
        break;
      case 'land': {
        const k = clamp(v / 600, 0.2, 1);
        cr.squash(1 + 0.4 * k, 1 - 0.34 * k);
        for (let i = 0; i < 5; i++) mo.spawn({ x: x + (rnd() - 0.5) * 12, y, vx: (rnd() - 0.5) * 90 * k, vy: -8 - rnd() * 26, ttl: 0.45, s0: 5, s1: 11, alpha: 0.32 * k + 0.1, tint: this.pal.rim });
        if (v > 540) cam.shake(0.22);
        break;
      }
      case 'splashIn':
      case 'splashOut': {
        const k = clamp(v / 500, 0.3, 1.2);
        cr.squash(e.type === 'splashIn' ? 1.25 : 0.8, e.type === 'splashIn' ? 0.78 : 1.25);
        for (let i = 0; i < 9; i++) mo.spawn({ x: x + (rnd() - 0.5) * 12, y, vx: (rnd() - 0.5) * 130 * k, vy: -90 * k - rnd() * 130 * k, gravity: 620, ttl: 0.6, s0: 4, s1: 2, alpha: 0.75, tint: this.pal.surface });
        for (let i = 0; i < 2; i++) mo.spawn({ frame: 'ring', x, y, ttl: 0.7 + i * 0.25, s0: 8, s1: 60 + i * 30, alpha: 0.5, tint: this.pal.surface, flat: 0.28 });
        if (e.type === 'splashIn') for (let i = 0; i < 5; i++) this.bubbles.spawn({ frame: 'bubble', x: x + (rnd() - 0.5) * 16, y: y + 8 + rnd() * 16, vy: -20 - rnd() * 30, ttl: 0.9, s0: 4, s1: 7, alpha: 0.6 });
        if (v > 480) cam.shake(0.14);
        break;
      }
      case 'glowOn':
        sp.spawn({ frame: 'ring', x, y, ttl: 0.4, s0: 14, s1: 90, alpha: 0.5, tint: LIGHT.creatureWarm });
        break;
      case 'pulse':
        cr.squash(1.4, 1.4);
        sp.spawn({ frame: 'ring', x, y, ttl: 0.7, s0: 30, s1: P.pulseRadius * 2, alpha: 0.85, tint: LIGHT.creatureCore });
                sp.spawn({ frame: 'soft', x, y, ttl: 0.45, s0: 80, s1: 420, alpha: 0.5, tint: LIGHT.creatureWarm });
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          sp.spawn({ frame: 'spark', x, y, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, drag: 2.4, ttl: 0.7, s0: 12, s1: 3, alpha: 0.9, tint: LIGHT.creatureCore, spin: 3 });
        }
        cam.shake(0.2);
        break;
      case 'pulseFail':
        sp.spawn({ frame: 'ring', x, y, ttl: 0.3, s0: 12, s1: 36, alpha: 0.35, tint: 0x8fa0c0 });
        break;
      case 'dash':
        cr.squash(1.35, 0.72);
        for (let i = 0; i < 5; i++) sp.spawn({ frame: 'streak', x: x - v * i * 5, y: y + (rnd() - 0.5) * 10, vx: -v * 60, ttl: 0.3, s0: 6, s1: 6, alpha: 0.6, tint: LIGHT.creatureWarm, rotation: Math.PI / 2 });
        break;
      case 'slash':
      case 'chargeSlash': {
        const p = this.world?.player;
        if (!p) break;
        const big = e.type === 'chargeSlash';
        // The sword itself draws the swing; a charged strike also throws a crescent of light.
        cr.startSwing(big ? 0 : v, big);
        if (big) {
          const rot = p.facing > 0 ? 0 : Math.PI;
          sp.spawn({ frame: 'slash', x: x + Math.cos(rot) * 30, y, vx: Math.cos(rot) * 120, ttl: 0.26, s0: 90, s1: 120, alpha: 0.8, tint: LIGHT.creatureWarm, rotation: rot });
          cam.shake(0.18);
        }
        break;
      }
      case 'plasma': {
        // Beads burst off the kill and stream toward the Tideborn.
        const p = this.world?.player;
        const n = Math.min(10, 2 + Math.floor(v / 4));
        for (let i = 0; i < n; i++) {
          const tx = p ? p.x : x;
          const ty = p ? p.y : y;
          sp.spawn({ frame: 'plasma', x: x + (rnd() - 0.5) * 12, y: y + (rnd() - 0.5) * 12, vx: (tx - x) * 2.2 + (rnd() - 0.5) * 90, vy: (ty - y) * 2.2 - 60 - rnd() * 60, drag: 1.5, ttl: 0.55, s0: 7, s1: 3, alpha: 1, tint: 0xffffff });
        }
        break;
      }
      case 'bank':
        sp.spawn({ frame: 'ring', x, y, ttl: 0.6, s0: 10, s1: 80, alpha: 0.8, tint: LIGHT.safeCurrent });
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          sp.spawn({ frame: 'plasma', x: x + Math.cos(a) * 40, y: y + Math.sin(a) * 40, vx: -Math.cos(a) * 90, vy: -Math.sin(a) * 90, ttl: 0.45, s0: 7, s1: 2, alpha: 1 });
        }
        break;
      case 'diamond':
        for (let i = 0; i < 3 + v * 2; i++) mo.spawn({ frame: 'diamond', x, y, vx: (rnd() - 0.5) * 200, vy: -120 - rnd() * 140, gravity: 420, ttl: 1, s0: 10, s1: 8, alpha: 1, spin: (rnd() - 0.5) * 8 });
        sp.spawn({ frame: 'ring', x, y, ttl: 0.6, s0: 20, s1: 140, alpha: 0.7, tint: 0xffb8f0 });
        break;
      case 'chest':
        sp.spawn({ frame: 'soft', x, y: y - 8, ttl: 0.5, s0: 30, s1: 120, alpha: 0.9, tint: LIGHT.lantern });
        for (let i = 0; i < 14; i++) sp.spawn({ frame: i % 3 ? 'plasma' : 'spark', x, y: y - 6, vx: (rnd() - 0.5) * 220, vy: -150 - rnd() * 180, gravity: 380, ttl: 0.9, s0: 7, s1: 3, alpha: 1, tint: i % 3 ? 0xffffff : LIGHT.lantern });
        cr.squash(1.1, 0.92);
        cam.shake(0.08);
        break;
      case 'relic': {
        const tint = [0xd8e4ff, 0xbff4ff, 0xffd98a, 0xfff4d0][v] ?? 0xffffff;
        sp.spawn({ frame: 'ring', x, y, ttl: 0.8, s0: 20, s1: 520, alpha: 0.9, tint });
        sp.spawn({ frame: 'soft', x, y, ttl: 0.5, s0: 60, s1: 600, alpha: 0.6, tint });
        if (v === 0) {
          // Thunder: bolts falling across the screen.
          for (let i = 0; i < 8; i++) sp.spawn({ frame: 'streak', x: x + (rnd() - 0.5) * 480, y: y - 120, vy: 900, ttl: 0.3, s0: 16, s1: 16, alpha: 1, tint: 0xffffff, flat: 6 });
          this.flash = Math.max(this.flash, 0.7);
        }
        for (let i = 0; i < 20; i++) sp.spawn({ frame: 'spark', x, y, vx: (rnd() - 0.5) * 500, vy: (rnd() - 0.5) * 500, drag: 2, ttl: 0.8, s0: 12, s1: 2, alpha: 1, tint, spin: 4 });
        cam.shake(0.35);
        break;
      }
      case 'relicFail':
      case 'abilityFail':
        sp.spawn({ frame: 'ring', x, y, ttl: 0.25, s0: 24, s1: 14, alpha: 0.6, tint: 0x8890a8 });
        break;
      case 'art': {
        const tint = [LIGHT.safeCurrent, 0xff9a50, 0xe6f0ff, 0xff9ab8, 0xc890ff, 0xfff0b8][v] ?? 0xffffff;
        if (v === 2) {
          // Lightning from above onto the target.
          for (let i = 0; i < 4; i++) sp.spawn({ frame: 'streak', x: x + (rnd() - 0.5) * 8, y: y - 60 - i * 40, ttl: 0.18, s0: 14, s1: 10, alpha: 1, tint: 0xffffff, flat: 5, rotation: (rnd() - 0.5) * 0.4 });
          sp.spawn({ frame: 'ring', x, y, ttl: 0.3, s0: 10, s1: 70, alpha: 1, tint });
          this.flash = Math.max(this.flash, 0.25);
        } else if (v === 4) {
          sp.spawn({ frame: 'ring', x, y, ttl: 0.4, s0: 220, s1: 10, alpha: 0.9, tint });
        } else {
          sp.spawn({ frame: 'ring', x, y, ttl: 0.4, s0: 16, s1: v === 3 ? 160 : 110, alpha: 0.9, tint });
          for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2;
            sp.spawn({ frame: v === 1 ? 'soft' : 'spark', x, y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220 - (v === 1 ? 60 : 0), drag: 3, ttl: 0.5, s0: v === 1 ? 22 : 10, s1: 2, alpha: 0.9, tint });
          }
        }
        cam.shake(0.15);
        break;
      }
      case 'finisher':
        sp.spawn({ frame: 'ring', x: x + v * 26, y, ttl: 0.3, s0: 10, s1: 90, alpha: 0.9, tint: LIGHT.creatureWarm });
        cam.shake(0.1);
        break;
      case 'trialEnter':
      case 'trialExit':
        sp.spawn({ frame: 'ring', x, y, ttl: 0.7, s0: 10, s1: 200, alpha: 0.9, tint: 0xd8a8ff });
        this.flash = Math.max(this.flash, 0.5);
        break;
      case 'chargeReady':
        sp.spawn({ frame: 'ring', x, y, ttl: 0.3, s0: 60, s1: 16, alpha: 0.8, tint: LIGHT.creatureWarm });
        break;
      case 'hit': {
        // A cut across the target, sparks, and the damage rising off it.
        const p = this.world?.player;
        const side = p && p.x > x ? -1 : 1;
        sp.spawn({ frame: 'cut', x, y, ttl: 0.18, s0: 30, s1: 52, alpha: 1, tint: 0xffffff, rotation: side * (0.5 + rnd() * 0.5) });
        sp.spawn({ frame: 'ring', x, y, ttl: 0.16, s0: 6, s1: 34, alpha: 0.7, tint: LIGHT.blade });
        for (let i = 0; i < 7; i++) sp.spawn({ frame: 'spark', x, y, vx: side * (60 + rnd() * 240), vy: (rnd() - 0.6) * 260, drag: 4, ttl: 0.3, s0: 9, s1: 2, alpha: 0.95, tint: i % 2 ? 0xffffff : LIGHT.creatureWarm });
        if (v > 0) this.number(x, y - 12, Math.round(v));
        cam.shake(0.04);
        break;
      }
      case 'clang':
        sp.spawn({ frame: 'ring', x, y, ttl: 0.22, s0: 8, s1: 46, alpha: 0.9, tint: 0xcfd8ff });
        break;
      case 'pogo':
        cr.squash(0.8, 1.25);
        sp.spawn({ frame: 'ring', x, y, ttl: 0.25, s0: 8, s1: 50, alpha: 0.7, tint: LIGHT.blade, flat: 0.4 });
        break;
      case 'kill':
        sp.spawn({ frame: 'ring', x, y, ttl: 0.4, s0: 10, s1: 90, alpha: 0.7, tint: LIGHT.dangerEye });
        for (let i = 0; i < 12; i++) sp.spawn({ frame: 'dot', x, y, vx: (rnd() - 0.5) * 300, vy: (rnd() - 0.5) * 300, drag: 3, ttl: 0.6, s0: 7, s1: 1, alpha: 0.9, tint: i % 2 ? LIGHT.dangerEye : LIGHT.creatureWarm });
        cam.shake(0.12);
        break;
      case 'hurt':
        cr.squash(0.7, 1.3);
        sp.spawn({ frame: 'ring', x, y, ttl: 0.4, s0: 10, s1: 130, alpha: 0.8, tint: LIGHT.danger });
        for (let i = 0; i < 10; i++) sp.spawn({ frame: 'dot', x, y, vx: (rnd() - 0.5) * 260, vy: (rnd() - 0.5) * 260, drag: 2.6, ttl: 0.6, s0: 6, s1: 1, alpha: 0.9, tint: LIGHT.creatureWarm });
        cam.shake(0.45);
        break;
      case 'death':
        sp.spawn({ frame: 'ring', x, y, ttl: 0.9, s0: 20, s1: 240, alpha: 0.6, tint: LIGHT.danger });
        for (let i = 0; i < 18; i++) sp.spawn({ frame: 'dot', x, y, vx: (rnd() - 0.5) * 200, vy: -20 - rnd() * 120, drag: 1.2, ttl: 1.1, s0: 6, s1: 1, alpha: 0.9, tint: LIGHT.creatureWarm });
        cam.shake(0.5);
        break;
      case 'heal':
      case 'grant':
        sp.spawn({ frame: 'ring', x, y, ttl: 0.6, s0: 14, s1: e.type === 'grant' ? 220 : 110, alpha: 0.8, tint: LIGHT.plant });
        for (let i = 0; i < 12; i++) sp.spawn({ frame: 'spark', x: x + (rnd() - 0.5) * 20, y, vx: (rnd() - 0.5) * 60, vy: -40 - rnd() * 90, drag: 1.5, ttl: 0.9, s0: 10, s1: 2, alpha: 0.9, tint: LIGHT.plant, spin: 2 });
        break;
      case 'ability':
        sp.spawn({ frame: 'ring', x, y, ttl: 0.4, s0: 16, s1: 130, alpha: 0.7, tint: LIGHT.safeCurrent });
        break;
      case 'doubleJump':
      case 'wallJump':
        sp.spawn({ frame: 'ring', x, y, ttl: 0.25, s0: 8, s1: 44, alpha: 0.6, tint: LIGHT.blade, flat: e.type === 'doubleJump' ? 0.35 : 1 });
        cr.squash(0.78, 1.26);
        break;
      case 'break':
        for (let i = 0; i < 14; i++) mo.spawn({ x: x + (rnd() - 0.5) * 30, y: y + (rnd() - 0.5) * 100, vx: (rnd() - 0.5) * 220, vy: -60 - rnd() * 120, gravity: 700, ttl: 0.8, s0: 7, s1: 3, alpha: 0.9, tint: 0xd8c0b0 });
        cam.shake(0.3);
        break;
      case 'zoneHit':
        sp.spawn({ frame: 'ring', x, y, ttl: 0.3, s0: 20, s1: v === 2 ? 180 : 90, alpha: 0.7, tint: 0xffd0f4, flat: v === 2 ? 0.3 : 1 });
        if (v === 2) cam.shake(0.3);
        break;
      case 'enemyWindup':
        sp.spawn({ frame: 'ring', x, y, ttl: 0.4, s0: v > 0 ? 150 : 70, s1: 12, alpha: 0.8, tint: LIGHT.dangerEye });
        break;
      case 'spawn':
        sp.spawn({ frame: 'ring', x, y, ttl: 0.5, s0: 60, s1: 10, alpha: 0.7, tint: LIGHT.danger });
        break;
      case 'bossIntro':
      case 'bossPhase':
        sp.spawn({ frame: 'ring', x, y, ttl: 0.9, s0: 30, s1: 420, alpha: 0.8, tint: LIGHT.dangerEye });
        cam.shake(0.6);
        break;
      case 'bossDown':
      case 'minibossDown':
        for (let k = 0; k < 3; k++) sp.spawn({ frame: 'ring', x, y, ttl: 0.8 + k * 0.3, s0: 30, s1: 360 + k * 120, alpha: 0.8, tint: LIGHT.creatureWarm });
        for (let i = 0; i < 30; i++) sp.spawn({ frame: 'spark', x, y, vx: (rnd() - 0.5) * 420, vy: (rnd() - 0.5) * 420, drag: 1.6, ttl: 1.4, s0: 16, s1: 2, alpha: 1, tint: i % 2 ? LIGHT.creatureWarm : LIGHT.dangerEye, spin: 3 });
        cam.shake(0.8);
        break;
      case 'pickup':
        for (let i = 0; i < 6; i++) sp.spawn({ frame: 'dot', x, y, vx: (rnd() - 0.5) * 90, vy: -30 - rnd() * 70, drag: 2, ttl: 0.6, s0: 5, s1: 1, alpha: 0.9, tint: LIGHT.firefly });
        break;
      case 'plant':
        sp.spawn({ frame: 'ring', x, y, ttl: 0.5, s0: 10, s1: 70, alpha: 0.5, tint: LIGHT.plant });
        for (let i = 0; i < 10; i++) sp.spawn({ frame: 'dot', x: x + (rnd() - 0.5) * 16, y, vx: (rnd() - 0.5) * 70, vy: -40 - rnd() * 80, drag: 1.6, ttl: 0.9, s0: 6, s1: 1, alpha: 0.9, tint: LIGHT.plant });
        break;
      case 'shell':
        sp.spawn({ frame: 'ring', x, y, ttl: 0.8, s0: 12, s1: 150, alpha: 0.7, tint: LIGHT.shell });
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          sp.spawn({ frame: 'spark', x, y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120 - 30, drag: 2, ttl: 1, s0: 13, s1: 2, alpha: 1, tint: LIGHT.shell, spin: 2 });
        }
        break;
      case 'checkpoint':
        sp.spawn({ frame: 'ring', x, y: y - 20, ttl: 0.9, s0: 16, s1: 200, alpha: 0.6, tint: LIGHT.lantern });
        for (let i = 0; i < 12; i++) sp.spawn({ frame: 'dot', x: x + (rnd() - 0.5) * 20, y: y - 24, vx: (rnd() - 0.5) * 40, vy: -30 - rnd() * 60, ttl: 1.3, s0: 5, s1: 1, alpha: 0.9, tint: LIGHT.lantern });
        break;
      case 'goal':
      case 'kin':
        sp.spawn({ frame: 'ring', x, y, ttl: 1, s0: 16, s1: 240, alpha: 0.7, tint: LIGHT.kin });
        for (let i = 0; i < 14; i++) sp.spawn({ frame: 'spark', x, y, vx: (rnd() - 0.5) * 160, vy: -40 - rnd() * 120, drag: 1.4, ttl: 1.2, s0: 12, s1: 2, alpha: 0.9, tint: LIGHT.kin, spin: 2 });
        break;
      case 'gateOpen':
      case 'secret':
        for (let i = 0; i < 10; i++) sp.spawn({ frame: 'spark', x: x + (rnd() - 0.5) * 16, y: y + (rnd() - 0.5) * 50, vx: (rnd() - 0.5) * 60, vy: -20 - rnd() * 50, ttl: 0.9, s0: 10, s1: 2, alpha: 0.9, tint: LIGHT.shell, spin: 2 });
        break;
      case 'crumble':
      case 'stoneLand':
        for (let i = 0; i < 7; i++) mo.spawn({ x: x + (rnd() - 0.5) * 40, y, vx: (rnd() - 0.5) * 60, vy: -20 - rnd() * 40, gravity: 500, ttl: 0.7, s0: 5, s1: 3, alpha: 0.7, tint: 0xb9aee0 });
        if (this.world && Math.abs(this.world.player.x - x) < 200) cam.shake(0.16);
        break;
      case 'stoneWarn':
        for (let i = 0; i < 4; i++) mo.spawn({ x: x + (rnd() - 0.5) * 18, y: y + 12, vy: 30 + rnd() * 30, gravity: 300, ttl: 0.6, s0: 3, s1: 1, alpha: 0.7, tint: 0xcabfff });
        break;
      case 'respawn':
        this.snapCamera();
        sp.spawn({ frame: 'ring', x, y, ttl: 0.8, s0: 10, s1: 140, alpha: 0.6, tint: LIGHT.lantern });
        break;
      default:
        break;
    }
  }

  /** Renders one frame. `alpha` interpolates between the last two simulation steps. */
  frame(w: World, alpha: number, dt: number, frozen: boolean): void {
    const calm = this.options.reducedMotion ? 0.35 : 1;
    const step = frozen ? 0 : dt;
    this.time += step;
    const t = this.time;
    const p = w.player;
    const cam = this.camera;
    cam.shakeScale = this.options.screenShake && !this.options.reducedMotion ? 1 : 0;
    this.motes.density = this.sparks.density = this.bubbles.density = this.options.reducedMotion ? 0.5 : 1;

    this.entities.sync(w);
    this.creature.setSword(w.load.sword);
    this.creature.update(w, alpha, step);
    if (!frozen) cam.update(this.creature.x, this.creature.y, p.vx, p.facing, dt, w.minX - 10, w.maxX + 10);

    const s = this.scale;
    const left = cam.left;
    const top = cam.top;
    const right = left + cam.viewW;
    const bottom = top + cam.viewH;
    this.worldC.scale.set(s);
    this.worldC.position.set(-left * s, -top * s);

    this.terrain.ensure(w, this.pal, left, right);
    this.lightmap.begin(s, left, top);
    this.entities.update(w, this.pal, t, step, left, right, this.lightmap, this.sparks, this.bubbles, calm);

    const radius = w.lightRadius;
    this.combat.update(w, this.pal, alpha, t, left, right, top, bottom, this.lightmap);
    const near = this.combat.threat;
    const nearSide = this.combat.threatSide;

    this.emitAmbient(w, step, left, right, top, bottom, calm);
    this.motes.update(step);
    this.sparks.update(step);
    this.bubbles.update(step);
    this.water.draw(this.pal, left, right, bottom, w.waterY, w.level.lakes, w.ground, t, calm);

    // --- Light ---------------------------------------------------------------------------
    const fading = 1;
    const warm = mixColor(LIGHT.creatureDim, LIGHT.creatureWarm, clamp(p.glow + 0.25, 0, 1));
    if (p.status === 'alive') {
      this.lightmap.add(this.creature.x, this.creature.y, radius, warm, (0.55 + 0.45 * p.glow) * fading);
      if (p.glow > 0.05) this.lightmap.add(this.creature.x, this.creature.y, radius * 0.55, LIGHT.creatureCore, 0.6 * p.glow * fading);
    }
    if (p.pulseFlash > 0) {
      const k = p.pulseFlash / P.pulseReveal;
      this.lightmap.add(this.creature.x, this.creature.y, P.pulseRadius * (1.1 - 0.3 * k), LIGHT.creatureCore, clamp(k * 1.4, 0, 1) * 0.9);
    }
    const weather = w.level.weather;
    this.lightmap.addScreen(this.screenW * 0.72, this.screenH * 0.17, Math.min(this.screenW, this.screenH) * 0.5, 0xffffff, 0.3 + 0.5 * weather.moon);

    const roofed = w.ceil.length > 0 && w.ceil.at(cam.x) > OPEN_SKY / 2 ? 1 : 0;
    this.cave += (roofed - this.cave) * damp(1.6, dt);
    const submerged = clamp((top + cam.viewH * 0.5 - w.waterAt(cam.x)) / 160, 0, 1);
    // Darkness levels turn the ambient light right down: only what glows can be seen.
    const dim = (1 - this.cave * 0.42) * (1 - submerged * 0.2) * (w.level.rules.dark ?? 1) * (p.veilT > 0 ? 0.7 : 1);
    this.updateWeather(w, step, calm);
    const a = this.pal.ambient;
    const boost = this.flash * (this.options.reducedMotion ? 0.15 : 0.5);
    this.lightmap.render(this.app.renderer, Math.min(1, a[0] * dim + boost), Math.min(1, a[1] * dim + boost), Math.min(1, a[2] * dim + boost));

    this.background.update(cam.x, cam.y, s, t, calm, this.flash);

    // --- Overlays ------------------------------------------------------------------------
    const danger = clamp(p.danger, 0, 1);
    const low = p.hp <= 1 && p.status === 'alive' ? 1 : 0;
    this.vignette.tint = mixColor(0x000000, 0x4a1040, danger * 0.8);
    this.vignette.alpha = clamp(0.3 + low * 0.34 + danger * 0.2 + (w.level.rules.fog ? 0.25 : 0), 0, 1);

    const cue = this.options.visualCues ? near : 0;
    const pulse = 0.6 + 0.4 * Math.sin(t * 5);
    const edgeSize = (this.screenH * 0.9) / 256;
    this.edgeL.position.set(0, this.screenH * 0.55);
    this.edgeR.position.set(this.screenW, this.screenH * 0.55);
    this.edgeL.scale.set(edgeSize * 0.45, edgeSize);
    this.edgeR.scale.set(edgeSize * 0.45, edgeSize);
    this.edgeL.alpha += ((nearSide < 0 ? cue * pulse * 0.75 : 0) - this.edgeL.alpha) * damp(6, dt);
    this.edgeR.alpha += ((nearSide > 0 ? cue * pulse * 0.75 : 0) - this.edgeR.alpha) * damp(6, dt);

    this.trackPerformance(dt);
    this.app.render();
  }

  /** Motes, bubbles, trails and guide lights that keep the world alive. */
  private emitAmbient(w: World, dt: number, left: number, right: number, top: number, bottom: number, calm: number): void {
    if (dt <= 0) return;
    const p = w.player;
    const rnd = Math.random;
    const speed = Math.hypot(p.vx, p.vy);

    this.trailT += dt;
    if (this.trailT > 0.045) {
      this.trailT = 0;
      if (p.status === 'alive') {
        if (p.glow > 0.3 && speed > 30) {
          this.sparks.spawn({ x: this.creature.x - p.facing * 8 + (rnd() - 0.5) * 6, y: this.creature.y + (rnd() - 0.5) * 8, vx: -p.vx * 0.1, vy: -6 - rnd() * 14, ttl: 0.7, s0: 5 + rnd() * 3, s1: 1, alpha: 0.6 * p.glow, tint: LIGHT.creatureWarm });
        }
        if (p.dashT > 0) {
          this.sparks.spawn({ frame: 'body', x: this.creature.x, y: this.creature.y, ttl: 0.22, s0: 30, s1: 24, alpha: 0.35, tint: LIGHT.creatureWarm });
        } else if (speed > 240) {
          this.sparks.spawn({ frame: 'streak', x: this.creature.x, y: this.creature.y, ttl: 0.25, s0: 5, s1: 5, alpha: 0.4, tint: 0xffffff, rotation: Math.atan2(p.vy, p.vx) + Math.PI / 2 });
        }
        if (p.swim && speed > 40 && rnd() < 0.5) {
          this.bubbles.spawn({ frame: 'bubble', x: this.creature.x - p.facing * 8, y: this.creature.y + (rnd() - 0.5) * 8, vx: -p.vx * 0.2, vy: -18 - rnd() * 20, ttl: 0.9, s0: 3, s1: 6, alpha: 0.55 });
        }
        if (p.wading && speed > 40 && rnd() < 0.6) {
          this.motes.spawn({ x: this.creature.x, y: w.waterAt(p.x), vx: (rnd() - 0.5) * 60, vy: -50 - rnd() * 50, gravity: 500, ttl: 0.4, s0: 3, s1: 1.5, alpha: 0.7, tint: this.pal.surface });
        }
        if (p.danger > 0.6 && rnd() < 0.3) {
          this.sparks.spawn({ x: this.creature.x + (rnd() - 0.5) * 30, y: this.creature.y + (rnd() - 0.5) * 30, ttl: 0.5, s0: 3, s1: 1, alpha: 0.6, tint: LIGHT.dangerEye });
        }
      }
    }

    this.ambientT += dt;
    if (this.ambientT > 0.12) {
      this.ambientT = 0;
      const weather = w.level.weather;
      // Drifting fireflies / plankton.
      if (rnd() < weather.fireflies * 1.2 * calm) {
        const x = left + rnd() * (right - left);
        const gy = w.ground.at(x);
        const y = Math.min(gy - 10 - rnd() * 140, bottom - 20);
        const under = y > w.waterAt(x);
        this.sparks.spawn({ x, y, vx: (rnd() - 0.5) * 16, vy: (rnd() - 0.5) * 10 - (under ? 4 : 0), ttl: 3 + rnd() * 2, s0: under ? 2.5 : 3.5, s1: 1.5, alpha: under ? 0.35 : 0.7, tint: under ? this.pal.accent : LIGHT.firefly });
      }
      // Bubbles rising from the floor of any water.
      if (rnd() < 0.5) {
        const x = left + rnd() * (right - left);
        const gy = Math.min(w.ground.at(x), bottom);
        const surface = w.waterAt(x);
        if (gy > surface + 20) this.bubbles.spawn({ frame: 'bubble', x, y: gy - 2, vx: (rnd() - 0.5) * 6, vy: -16 - rnd() * 22, ttl: Math.min(3.5, (gy - surface) / 30), s0: 2.5, s1: 5.5, alpha: 0.35 });
      }
      // Wind-blown spray along the surface in rough weather.
      if (weather.wind > 0.5 && rnd() < weather.wind * 0.6 * calm && w.waterY > top && w.waterY < bottom) {
        const x = left + rnd() * (right - left);
        if (w.ground.at(x) > w.waterY) this.motes.spawn({ x, y: w.waterY, vx: -60 - rnd() * 80, vy: -20 - rnd() * 40, gravity: 200, ttl: 0.7, s0: 3, s1: 1, alpha: 0.5, tint: this.pal.surface });
      }
    }

    // Assist: a trail of soft lights along the safest route.
    if (w.assist) {
      this.guideT += dt;
      if (this.guideT > 0.3) {
        this.guideT = 0;
        let shown = 0;
        for (const wp of w.level.waypoints) {
          if (wp.optional || wp.x < p.x + 20) continue;
          if (wp.x > p.x + 520 || shown >= 5) break;
          shown++;
          this.sparks.spawn({ frame: 'spark', x: wp.x + (rnd() - 0.5) * 6, y: wp.y - 6, vy: -8, ttl: 0.9, s0: 9, s1: 3, alpha: 0.55, tint: LIGHT.lantern, spin: 1 });
        }
      }
    }
  }

  private updateWeather(w: World, dt: number, calm: number): void {
    const weather = w.level.weather;
    const count = Math.round(RAIN * clamp(weather.rain, 0, 1) * (this.options.reducedMotion ? 0.5 : 1));
    const wind = weather.wind;
    const sw = this.screenW;
    const sh = this.screenH;
    const fall = sh * 1.5;
    for (let i = 0; i < RAIN; i++) {
      const s = this.rain[i];
      if (i >= count) {
        s.visible = false;
        continue;
      }
      s.visible = true;
      const speed = this.rainSeed[i * 3 + 2];
      let y = this.rainSeed[i * 3 + 1] + (dt * fall * speed) / (sh + 80);
      let x = this.rainSeed[i * 3] - (dt * fall * speed * wind * 0.45) / (sw + 160);
      if (y > 1) {
        y -= 1;
        x = Math.random();
      }
      if (x < 0) x += 1;
      this.rainSeed[i * 3] = x;
      this.rainSeed[i * 3 + 1] = y;
      s.position.set(x * (sw + 160) - 80, y * (sh + 80) - 40);
      s.rotation = wind * 0.42;
      s.scale.set(0.5, 0.5 * (0.7 + speed * 0.6));
      s.alpha = 0.16 + speed * 0.14;
      s.tint = this.pal.surface;
    }

    if (weather.lightning && dt > 0) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.nextBolt = 7 + Math.random() * 11;
        this.flash = 1;
        this.onThunder?.();
      }
    }
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 2.6);
      // A double flicker reads as lightning; skipped for reduced motion.
      const strobe = calm < 1 ? 1 : this.flash > 0.72 && this.flash < 0.82 ? 0.25 : 1;
      this.flashSprite.alpha = this.flash * this.flash * 0.16 * strobe * calm;
    } else {
      this.flashSprite.alpha = 0;
    }
  }

  /** Drops render resolution if the device cannot hold frame rate; restores nothing automatically. */
  private trackPerformance(dt: number): void {
    const ms = dt * 1000;
    this.stats.frameMs += (ms - this.stats.frameMs) * 0.05;
    this.stats.fps = 1000 / Math.max(1, this.stats.frameMs);
    this.stats.resolution = this.resolution;
    if (ms > 24) this.slowFrames++;
    else this.slowFrames = Math.max(0, this.slowFrames - 2);
    if (this.slowFrames > 150 && this.resolution > 1) {
      this.resolution = Math.max(1, this.resolution - 0.5);
      this.app.renderer.resolution = this.resolution;
      this.slowFrames = 0;
      this.resize();
    }
  }

  /** Quality cap chosen in settings (1 = battery saver). */
  setMaxResolution(max: number): void {
    const target = Math.min(window.devicePixelRatio || 1, max);
    if (target !== this.resolution) {
      this.resolution = target;
      this.app.renderer.resolution = target;
      this.resize();
    }
  }
}
