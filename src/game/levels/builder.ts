import type { BiomeId, CurrentDef, FishKind, HintKind, LevelData, TideDef, Waypoint, WeatherDef } from '../core/types';
import { OPEN_SKY } from '../systems/terrain';

export interface LevelMeta {
  id: string;
  index: number;
  name: string;
  line: string;
  biome: BiomeId;
  teaches: string;
  weather?: Partial<WeatherDef>;
}

const DEFAULT_WEATHER: WeatherDef = { rain: 0, wind: 0.2, lightning: false, fog: 0.2, moon: 0.8, fireflies: 0.3 };

/** Average speed used to turn distance into the tide time a checkpoint is allowed to keep. */
const PAR_SPEED = 80;

/**
 * Cursor-based level authoring. Terrain calls extend the ground to the right and move the cursor;
 * entity calls place things `back` px behind the cursor, `up` px above the cursor's ground height.
 * The order of calls is also the route the verification bot follows.
 */
export class LevelBuilder {
  x = 0;
  y = 0;
  private readonly data: LevelData;
  private inCave = false;
  private optionalDepth = 0;
  private shellCount = 0;
  private goalSet = false;
  /** Stretches meant to hold water (pits, lagoons, sunken courts); the auto-tide ignores their floors. */
  private readonly wet: [number, number][] = [];
  private auto: { m0: number; m1: number; amp: number; period: number; pace: number; breathAmp: number; breathPeriod: number } | null = null;

  constructor(meta: LevelMeta, startY = 0) {
    this.y = startY;
    this.data = {
      id: meta.id,
      index: meta.index,
      name: meta.name,
      line: meta.line,
      biome: meta.biome,
      teaches: meta.teaches,
      width: 0,
      groundX: [-400, 0],
      groundY: [startY, startY],
      ceilX: [],
      ceilY: [],
      platforms: [],
      currents: [],
      kelp: [],
      pools: [],
      plants: [],
      fireflies: [],
      urchins: [],
      geysers: [],
      gates: [],
      stones: [],
      shells: [],
      checkpoints: [],
      fish: [],
      hints: [],
      secrets: [],
      kin: [],
      waypoints: [],
      tide: { keys: [[0, startY + 90]], amp: 3, period: 7 },
      weather: { ...DEFAULT_WEATHER, ...meta.weather },
      spawn: { x: 60, y: startY - 9 },
      goalX: 0,
    };
  }

  // ---- terrain ---------------------------------------------------------------------------

  private point(x: number, y: number): void {
    this.data.groundX.push(x);
    this.data.groundY.push(y);
  }

  private wp(x: number, y: number, extra: Partial<Waypoint> = {}): void {
    const w: Waypoint = { x, y, ...extra };
    if (this.optionalDepth > 0) w.optional = true;
    this.data.waypoints.push(w);
  }

  flat(len: number): this {
    this.x += len;
    this.point(this.x, this.y);
    this.wp(this.x - 4, this.y - 9);
    return this;
  }

  slope(len: number, dy: number): this {
    this.x += len;
    this.y += dy;
    this.point(this.x, this.y);
    this.wp(this.x - 4, this.y - 9);
    return this;
  }

  /** Vertical ledge. Negative dy steps up. */
  step(dy: number): this {
    // A waypoint left on the old lip would now be buried in (or hang over) the new ledge.
    const wps = this.data.waypoints;
    const prev = wps[wps.length - 1];
    if (prev && !prev.optional && !prev.ride && Math.abs(prev.x - this.x) <= 20) wps.pop();
    this.y += dy;
    this.point(this.x, this.y);
    this.wp(this.x + (dy < 0 ? 14 : 4), this.y - 9);
    return this;
  }

  /** Rolling ground that ends at the height it started. */
  hills(len: number, amp: number, bumps = 2): this {
    const n = bumps * 6;
    const y0 = this.y;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      this.point(this.x + len * t, y0 - Math.sin(t * Math.PI * bumps) ** 2 * amp);
      if (i % 3 === 0) this.wp(this.x + len * t - 2, y0 - Math.sin(t * Math.PI * bumps) ** 2 * amp - 9);
    }
    this.x += len;
    this.y = y0;
    return this;
  }

  /**
   * Sheer-walled pit. Rungs on both walls guarantee a way back out at any tide.
   * `swim` routes the bot through the water instead of over it.
   */
  pit(width: number, depth: number, opts: { rungs?: boolean; swim?: boolean; farDy?: number } = {}, over?: (b: this) => void): this {
    const x0 = this.x;
    const nearY = this.y;
    const farY = this.y + (opts.farDy ?? 0);
    this.point(x0, nearY + depth);
    this.point(x0 + width, nearY + depth);
    this.point(x0 + width, farY);
    this.x += width;
    this.y = farY;
    this.wet.push([x0, this.x]);
    if (opts.rungs !== false) {
      for (let h = 46; h < nearY + depth - farY - 30; h += 46) this.data.platforms.push({ x: this.x - 24, y: farY + h, w: 24, kind: 'rock' });
      if (width >= 70) for (let h = 66; h < depth - 30; h += 46) this.data.platforms.push({ x: x0, y: nearY + h, w: 24, kind: 'rock' });
    }
    if (opts.swim) {
      this.wp(x0 + 22, nearY + 24, { swim: true });
      this.wp(this.x - 24, Math.max(nearY, farY) + 24, { swim: true });
    }
    if (over) over(this);
    this.wp(this.x + 12, this.y - 9);
    return this;
  }

  /** Pool with sloped banks: walk in, swim across, walk out. */
  basin(width: number, depth: number, bank = 0.28): this {
    const b = width * bank;
    const x0 = this.x;
    this.point(x0 + b, this.y + depth);
    this.point(x0 + width - b, this.y + depth);
    this.point(x0 + width, this.y);
    this.x += width;
    this.wet.push([x0, this.x]);
    this.wp(x0 + b, this.y + Math.min(depth, 30) - 9, { swim: true });
    this.wp(this.x - b, this.y + Math.min(depth, 30) - 9, { swim: true });
    this.wp(this.x - 4, this.y - 9);
    return this;
  }

  /** Starts a cave roof `h` px above the ground at the cursor. */
  caveStart(h: number): this {
    if (this.inCave) throw new Error(`${this.data.id}: cave already open`);
    this.inCave = true;
    if (this.data.ceilX.length === 0) {
      this.data.ceilX.push(-400);
      this.data.ceilY.push(OPEN_SKY);
    }
    this.data.ceilX.push(this.x, this.x);
    this.data.ceilY.push(OPEN_SKY, this.y - h);
    return this;
  }

  /** Adds a roof vertex `h` px above the ground at the cursor. */
  roof(h: number, back = 0): this {
    if (!this.inCave) throw new Error(`${this.data.id}: roof outside cave`);
    this.data.ceilX.push(this.x - back);
    this.data.ceilY.push(this.y - h);
    return this;
  }

  caveEnd(h: number): this {
    this.roof(h);
    this.data.ceilX.push(this.x);
    this.data.ceilY.push(OPEN_SKY);
    this.inCave = false;
    return this;
  }

  // ---- route helpers ---------------------------------------------------------------------

  /** Everything placed inside is a detour for the collector bot only. */
  optional(fn: (b: this) => void): this {
    this.optionalDepth++;
    fn(this);
    this.optionalDepth--;
    return this;
  }

  /** Marks the last `len` px as ground that is meant to flood (a sunken court). */
  floods(len: number): this {
    this.wet.push([this.x - len, this.x]);
    return this;
  }

  /** Explicit waypoint for the verification bot. */
  via(back: number, up: number, extra: Partial<Waypoint> = {}): this {
    this.wp(this.x - back, this.y - up, extra);
    return this;
  }

  // ---- entities --------------------------------------------------------------------------

  private groundAt(x: number): number {
    const xs = this.data.groundX;
    const ys = this.data.groundY;
    for (let i = xs.length - 2; i >= 0; i--) {
      if (xs[i] <= x) {
        const span = xs[i + 1] - xs[i];
        return span === 0 ? ys[i + 1] : ys[i] + ((ys[i + 1] - ys[i]) * (x - xs[i])) / span;
      }
    }
    return ys[0];
  }

  plat(back: number, up: number, w: number, kind: 'rock' | 'moonglass' | 'crumble' = 'rock', route = true): this {
    const x = this.x - back;
    const y = this.y - up;
    this.data.platforms.push({ x, y, w, kind });
    if (route) this.wp(x + w / 2, y - 9, kind === 'moonglass' ? { glow: true } : {});
    return this;
  }

  plant(back: number, up?: number): this {
    const x = this.x - back;
    this.data.plants.push({ x, y: up === undefined ? this.groundAt(x) : this.y - up });
    return this;
  }

  /** A small swarm of fireflies around a point. */
  fireflies(back: number, up: number, count = 3, spread = 26): this {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + back * 0.37;
      this.data.fireflies.push({
        x: this.x - back + Math.cos(a) * spread * (0.5 + ((i * 7) % 5) / 8),
        y: this.y - up + Math.sin(a) * spread * 0.45,
      });
    }
    return this;
  }

  pool(back: number, r = 46, up = 4): this {
    const x = this.x - back;
    this.data.pools.push({ x, y: this.groundAt(x) - up, r });
    return this;
  }

  kelp(back: number, w: number, h = 70, up?: number): this {
    const x = this.x - back;
    this.data.kelp.push({ x, w, y: up === undefined ? this.groundAt(x + w / 2) : this.y - up, h });
    return this;
  }

  urchin(back: number, up?: number, r = 9): this {
    const x = this.x - back;
    this.data.urchins.push({ x, y: up === undefined ? this.groundAt(x) - r + 2 : this.y - up, r });
    return this;
  }

  geyser(back: number, power = 620, period = 4.5, phase = 0, route = true): this {
    const x = this.x - back;
    const y = this.groundAt(x);
    this.data.geysers.push({ x, y, power, period, phase });
    if (route) this.wp(x, y - 9, { ride: true });
    return this;
  }

  bloomGate(back: number, h = 70): this {
    const x = this.x - back;
    this.data.gates.push({ x, y: this.groundAt(x), h, kind: 'bloom' });
    this.wp(x - 30, this.groundAt(x - 30) - 9, { glow: true, pause: 1.3 });
    return this;
  }

  tideGate(back: number, h: number, cond: { openAbove?: number; openBelow?: number }): this {
    const x = this.x - back;
    this.data.gates.push({ x, y: this.groundAt(x), h, kind: 'tide', ...cond });
    this.wp(x - 30, this.groundAt(x - 30) - 9, { waitTideAbove: cond.openAbove, waitTideBelow: cond.openBelow });
    return this;
  }

  stone(back: number, up: number): this {
    const x = this.x - back;
    this.data.stones.push({ x, y: this.y - up, restY: this.groundAt(x) - 7 });
    return this;
  }

  /** Memory Shell. Ids are `<level>-<n>` in authoring order. Adds a collector-only waypoint. */
  shell(back: number, up: number, hidden = false): this {
    const x = this.x - back;
    const y = this.y - up;
    this.shellCount++;
    this.data.shells.push({ id: `${this.data.id}-${this.shellCount}`, x, y, hidden });
    this.data.waypoints.push({ x, y, optional: true, glow: hidden });
    return this;
  }

  checkpoint(back = 0, gentleOnly = false): this {
    const x = this.x - back;
    const y = this.groundAt(x) - 9;
    this.data.checkpoints.push({ x, y, tideCap: 0, gentleOnly });
    return this;
  }

  fish(kind: FishKind, back: number, up: number, back2 = back, up2 = up): this {
    this.data.fish.push({ kind, x: this.x - back, y: this.y - up, x2: this.x - back2, y2: this.y - up2 });
    return this;
  }

  current(back: number, up: number, w: number, h: number, fx: number, fy: number, opts: Partial<CurrentDef> = {}): this {
    this.data.currents.push({ x: this.x - back, y: this.y - up, w, h, fx, fy, safe: false, mode: 'always', ...opts });
    return this;
  }

  hint(kind: HintKind, back: number, w = 160): this {
    this.data.hints.push({ kind, x: this.x - back, w });
    return this;
  }

  secret(name: string, back: number, up: number, w: number, h: number): this {
    this.data.secrets.push({ id: `${this.data.id}-${name}`, x: this.x - back, y: this.y - up, w, h });
    return this;
  }

  kin(back: number, up: number, flee = false): this {
    this.data.kin.push({ x: this.x - back, y: this.y - up, flee });
    this.wp(this.x - back - 40, this.groundAt(this.x - back - 40) - 9, { glow: true, pause: 0.6 });
    return this;
  }

  tide(keys: [number, number][], amp = 3, period = 7): this {
    const def: TideDef = { keys, amp, period };
    this.data.tide = def;
    return this;
  }

  /**
   * Derives the tide from the terrain: at the pace of an unhurried player (`pace` px/s) the water
   * stays `m0` px below the walkable shore at the start, closing to `m1` px by the goal.
   * Dawdle and it overtakes you; hurry and the pools ahead are still shallow.
   */
  autoTide(m0: number, m1: number, amp = 4, period = 7, opts: { pace?: number; breathAmp?: number; breathPeriod?: number } = {}): this {
    this.auto = { m0, m1, amp, period, pace: opts.pace ?? 66, breathAmp: opts.breathAmp ?? 0, breathPeriod: opts.breathPeriod ?? 40 };
    return this;
  }

  private computeAutoTide(): void {
    const a = this.auto;
    const d = this.data;
    if (!a) return;
    const step = 20;
    const n = Math.ceil(d.goalX / step) + 1;
    // The walkable shore: ground outside the stretches that are meant to hold water.
    const w: number[] = [];
    for (let i = 0; i < n; i++) {
      const x = i * step;
      let rim = this.groundAt(x);
      for (const [from, to] of this.wet) {
        if (x >= from && x <= to) {
          rim = Math.max(this.groundAt(from - 1), this.groundAt(to + 1));
          break;
        }
      }
      w.push(rim + a.m0 + ((a.m1 - a.m0) * i) / (n - 1));
    }
    // The sea is level: it can only be as high as every stretch still ahead allows.
    for (let i = n - 2; i >= 0; i--) w[i] = Math.max(w[i], w[i + 1]);
    const keys: [number, number][] = [];
    const every = Math.max(1, Math.round((a.pace * 9) / step));
    for (let i = 0; i < n; i += every) {
      const t = Math.max(0, (i * step - d.spawn.x) / a.pace);
      if (keys.length && t <= keys[keys.length - 1][0]) continue;
      keys.push([Math.round(t * 10) / 10, Math.round(w[i])]);
    }
    const endT = (d.goalX - d.spawn.x) / a.pace;
    if (endT > keys[keys.length - 1][0] + 1) keys.push([Math.round(endT), Math.round(w[n - 1])]);
    d.tide = { keys, amp: a.amp, period: a.period, breathAmp: a.breathAmp, breathPeriod: a.breathPeriod };
  }

  spawn(x: number, up = 9): this {
    this.data.spawn = { x, y: this.groundAt(x) - up };
    return this;
  }

  /** Marks the goal at the cursor. */
  goal(): this {
    this.data.goalX = this.x;
    this.goalSet = true;
    return this;
  }

  build(): LevelData {
    const d = this.data;
    if (this.inCave) throw new Error(`${d.id}: cave left open`);
    if (!this.goalSet) d.goalX = this.x;
    this.computeAutoTide();
    // Run-out beyond the goal so the camera has somewhere to settle.
    this.point(this.x + 420, this.y);
    d.width = this.x + 400;
    if (d.ceilX.length > 0) {
      d.ceilX.push(d.width + 400);
      d.ceilY.push(OPEN_SKY);
    }
    for (const cp of d.checkpoints) cp.tideCap = Math.round((cp.x - d.spawn.x) / PAR_SPEED) + 6;
    d.checkpoints.sort((a, b) => a.x - b.x);
    validateLevel(d);
    return d;
  }
}

/** Structural checks that catch authoring mistakes before a level ever reaches a player. */
export function validateLevel(d: LevelData): void {
  const fail = (msg: string): never => {
    throw new Error(`Level ${d.id}: ${msg}`);
  };
  if (d.groundX.length !== d.groundY.length) fail('ground arrays differ');
  if (d.ceilX.length !== d.ceilY.length) fail('ceiling arrays differ');
  for (let i = 1; i < d.groundX.length; i++) if (d.groundX[i] < d.groundX[i - 1]) fail(`ground x not monotonic at ${i}`);
  for (let i = 1; i < d.ceilX.length; i++) if (d.ceilX[i] < d.ceilX[i - 1]) fail(`ceiling x not monotonic at ${i}`);
  if (!(d.goalX > d.spawn.x)) fail('goal must be right of spawn');
  if (d.width < d.goalX) fail('width smaller than goal');
  if (d.tide.keys.length === 0) fail('tide has no keys');
  for (let i = 1; i < d.tide.keys.length; i++) if (d.tide.keys[i][0] <= d.tide.keys[i - 1][0]) fail('tide keys not increasing in time');
  const ids = new Set<string>();
  for (const s of d.shells) {
    if (ids.has(s.id)) fail(`duplicate shell ${s.id}`);
    ids.add(s.id);
  }
  for (const p of d.platforms) if (p.w <= 0) fail('platform with no width');
  for (const all of [d.plants, d.fireflies, d.shells, d.checkpoints, d.urchins, d.geysers, d.gates, d.stones, d.kin]) {
    for (const e of all) if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || e.x < 0 || e.x > d.width) fail('entity out of bounds');
  }
}
