import type { AbilityId, ArenaDef, BiomeId, CurrentDef, EnemyKind, HintKind, LevelData, LevelRules, PlatformDef, TideDef, UpgradeId, Waypoint, WeatherDef } from '../core/types';
import { OPEN_SKY } from '../systems/terrain';

export interface LevelMeta {
  id: string;
  area: number;
  index: number;
  name: string;
  line: string;
  biome: BiomeId;
  twist: string;
  rules?: LevelRules;
  weather?: Partial<WeatherDef>;
}

const DEFAULT_WEATHER: WeatherDef = { rain: 0, wind: 0.2, lightning: false, fog: 0.2, moon: 0.8, fireflies: 0.3 };
const PAR_SPEED = 120;
const FLYERS: EnemyKind[] = ['gloomwing', 'stormjelly', 'voidling'];

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
  private readonly wet: [number, number][] = [];
  private auto: { m0: number; m1: number; amp: number; period: number; pace: number } | null = null;

  constructor(meta: LevelMeta, startY = 0) {
    this.y = startY;
    this.data = {
      id: meta.id,
      area: meta.area,
      index: meta.index,
      name: meta.name,
      line: meta.line,
      biome: meta.biome,
      twist: meta.twist,
      rules: meta.rules ?? {},
      width: 0,
      groundX: [-400, 0],
      groundY: [startY, startY],
      ceilX: [],
      ceilY: [],
      platforms: [],
      blocks: [],
      spikes: [],
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
      enemies: [],
      arenas: [],
      grants: [],
      hints: [],
      secrets: [],
      kin: [],
      waypoints: [],
      tide: { keys: [[0, startY + 400]], amp: 3, period: 7 },
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

  /** Level ground. `mark: false` leaves no waypoint (when the route is about to go somewhere else). */
  flat(len: number, mark = true): this {
    this.x += len;
    this.point(this.x, this.y);
    if (mark) this.wp(this.x - 4, this.y - 9);
    return this;
  }

  slope(len: number, dy: number): this {
    this.x += len;
    this.y += dy;
    this.point(this.x, this.y);
    this.wp(this.x - 4, this.y - 9);
    return this;
  }

  /** Vertical ledge. Negative dy steps up. `act` tells the bot which skill the climb needs. */
  step(dy: number, act?: Waypoint['act']): this {
    const wps = this.data.waypoints;
    const prev = wps[wps.length - 1];
    if (prev && !prev.optional && !prev.ride && prev.arena === undefined && Math.abs(prev.x - this.x) <= 20) wps.pop();
    this.y += dy;
    this.point(this.x, this.y);
    this.wp(this.x + (dy < 0 ? 14 : 4), this.y - 9, act ? { act } : {});
    return this;
  }

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

  /** Sheer-walled pit. Rungs on the walls give a way back out. */
  pit(width: number, depth: number, opts: { rungs?: boolean; swim?: boolean; farDy?: number; act?: Waypoint['act'] } = {}, over?: (b: this) => void): this {
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
    this.wp(this.x + 12, this.y - 9, opts.act ? { act: opts.act } : {});
    return this;
  }

  /** Pool with sloped banks: walk in, swim across, walk out. */
  basin(width: number, depth: number, bank = 0.28, under?: (b: this) => void): this {
    const b = width * bank;
    const x0 = this.x;
    this.point(x0 + b, this.y + depth);
    this.point(x0 + width - b, this.y + depth);
    this.point(x0 + width, this.y);
    this.x += width;
    this.wet.push([x0, this.x]);
    this.wp(x0 + b, this.y + Math.min(depth, 30) - 9, { swim: true });
    // Anything the swimmer must pass on the way across (a sunken wall to dive under) goes here.
    if (under) under(this);
    this.wp(this.x - b, this.y + Math.min(depth, 30) - 9, { swim: true });
    this.wp(this.x - 4, this.y - 9);
    return this;
  }

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

  optional(fn: (b: this) => void): this {
    this.optionalDepth++;
    fn(this);
    this.optionalDepth--;
    return this;
  }

  floods(len: number): this {
    this.wet.push([this.x - len, this.x]);
    return this;
  }

  via(back: number, up: number, extra: Partial<Waypoint> = {}): this {
    this.wp(this.x - back, this.y - up, extra);
    return this;
  }

  groundAt(x: number): number {
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

  // ---- solids and hazards ----------------------------------------------------------------

  plat(back: number, up: number, w: number, kind: PlatformDef['kind'] = 'rock', route = true, move?: { dx?: number; dy?: number; period: number }): this {
    const x = this.x - back;
    const y = this.y - up;
    this.data.platforms.push({ x, y, w, kind, ...move });
    if (route) this.wp(x + w / 2, y - 9, kind === 'moonglass' ? { glow: true } : {});
    return this;
  }

  /** Solid rectangle whose top is `up` px above the cursor's ground. */
  block(back: number, up: number, w: number, h: number, kind: 'rock' | 'cracked' = 'rock'): this {
    this.data.blocks.push({ x: this.x - back, y: this.y - up, w, h, kind });
    return this;
  }

  /** A strip of spikes on the ground. */
  spikes(back: number, w: number, up = 0): this {
    const x = this.x - back;
    this.data.spikes.push({ x, y: (up === 0 ? this.groundAt(x + w / 2) : this.y - up) - 10, w, h: 10 });
    return this;
  }

  // ---- combat ----------------------------------------------------------------------------

  /** A roaming foe, leashed to `range` px either side of where it stands. */
  foe(kind: EnemyKind, back: number, range = 110, elite = false): this {
    const x = this.x - back;
    const y = this.groundAt(x) - (FLYERS.includes(kind) ? 96 : 14);
    this.data.enemies.push({ kind, x, y, x0: x - range, x1: x + range, elite });
    return this;
  }

  /** An underwater foe at a depth below the cursor's ground. */
  fish(back: number, down: number, range = 130, elite = false): this {
    const x = this.x - back;
    this.data.enemies.push({ kind: 'needlefish', x, y: this.y + down, x0: x - range, x1: x + range, elite });
    return this;
  }

  /**
   * A combat arena: flat ground, gates that close while it is fought, enemies arriving in waves.
   * Elite foes are written with a trailing `!` (for example `'shellback!'`).
   */
  arena(width: number, waves: string[][], opts: { lock?: boolean; survive?: number; miniboss?: string; boss?: string } = {}): this {
    const x0 = this.x;
    const index = this.data.arenas.length;
    this.x += width;
    this.point(this.x, this.y);
    const def: ArenaDef = { x0, x1: this.x, y: this.y, waves: waves.length, lock: opts.lock !== false, survive: opts.survive, miniboss: opts.miniboss, boss: opts.boss };
    this.data.arenas.push(def);
    if (def.lock) {
      this.data.gates.push({ x: x0 + 8, y: this.y, h: 420, kind: 'arena', arena: index });
      this.data.gates.push({ x: this.x - 8, y: this.y, h: 420, kind: 'arena', arena: index });
    }
    waves.forEach((wave, wi) => {
      wave.forEach((name, k) => {
        const elite = name.endsWith('!');
        const kind = (elite ? name.slice(0, -1) : name) as EnemyKind;
        const x = x0 + width * (0.34 + (0.52 * (k + 1)) / (wave.length + 1));
        const y = this.y - (FLYERS.includes(kind) ? 110 : 14);
        this.data.enemies.push({ kind, x, y, x0: x0 + 34, x1: this.x - 34, elite, arena: index, wave: wi });
      });
    });
    this.wp(x0 + 70, this.y - 9, { arena: index });
    this.wp(this.x - 4, this.y - 9);
    return this;
  }

  /** A shrine that restores an ability or grants an upgrade, optionally only after a guardian falls. */
  grant(back: number, what: { ability?: AbilityId; upgrade?: UpgradeId; after?: string }): this {
    const x = this.x - back;
    this.data.grants.push({ x, y: this.groundAt(x) - 16, ...what });
    return this;
  }

  // ---- props -----------------------------------------------------------------------------

  plant(back: number, up?: number): this {
    const x = this.x - back;
    this.data.plants.push({ x, y: up === undefined ? this.groundAt(x) : this.y - up });
    return this;
  }

  fireflies(back: number, up: number, count = 3, spread = 26): this {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + back * 0.37;
      this.data.fireflies.push({ x: this.x - back + Math.cos(a) * spread * (0.5 + ((i * 7) % 5) / 8), y: this.y - up + Math.sin(a) * spread * 0.45 });
    }
    return this;
  }

  pool(back: number, r = 46, up = 4): this {
    const x = this.x - back;
    this.data.pools.push({ x, y: this.groundAt(x) - up, r });
    return this;
  }

  kelp(back: number, w: number, h = 70): this {
    const x = this.x - back;
    this.data.kelp.push({ x, w, y: this.groundAt(x + w / 2), h });
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
    this.wp(x - 30, this.groundAt(x - 30) - 9, { glow: true, pause: 1.0 });
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

  /** Memory Shell. Ids are `<level>-<n>` unless given. Adds a collector-only waypoint. */
  shell(back: number, up: number, hidden = false, id?: string): this {
    const x = this.x - back;
    const y = this.y - up;
    this.shellCount++;
    this.data.shells.push({ id: id ?? `${this.data.id}-${this.shellCount}`, x, y, hidden });
    this.data.waypoints.push({ x, y, optional: true, glow: hidden });
    return this;
  }

  /** A resting light: checkpoint. */
  /** Where the last lantern stands (the spawn if there is none yet). */
  lastLantern(): number {
    const cps = this.data.checkpoints;
    return cps.length ? cps[cps.length - 1].x : this.data.spawn.x;
  }

  checkpoint(back = 0, gentleOnly = false): this {
    const x = this.x - back;
    this.data.checkpoints.push({ x, y: this.groundAt(x) - 9, tideCap: 0, gentleOnly });
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
    return this;
  }

  tide(keys: [number, number][], amp = 3, period = 7): this {
    const def: TideDef = { keys, amp, period };
    this.data.tide = def;
    return this;
  }

  /**
   * Derives the tide from the terrain: at an unhurried pace the water stays `m0` px below the
   * walkable ground at the start, closing to `m1` px by the goal.
   */
  autoTide(m0: number, m1: number, amp = 4, period = 7, pace = 90): this {
    this.auto = { m0, m1, amp, period, pace };
    return this;
  }

  private computeAutoTide(): void {
    const a = this.auto;
    const d = this.data;
    if (!a) return;
    const step = 20;
    const n = Math.ceil(d.goalX / step) + 1;
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
    const every = Math.max(1, Math.round((a.pace * 6) / step));
    for (let i = 0; i < n; i += every) {
      const t = Math.max(0, (i * step - d.spawn.x) / a.pace);
      if (keys.length && t <= keys[keys.length - 1][0]) continue;
      keys.push([Math.round(t * 10) / 10, Math.round(w[i])]);
    }
    const endT = (d.goalX - d.spawn.x) / a.pace;
    if (endT > keys[keys.length - 1][0] + 1) keys.push([Math.round(endT), Math.round(w[n - 1])]);
    d.tide = { keys, amp: a.amp, period: a.period };
  }

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
  if (!d.twist) fail('every level needs a twist');
  const ids = new Set<string>();
  for (const s of d.shells) {
    if (ids.has(s.id)) fail(`duplicate shell ${s.id}`);
    ids.add(s.id);
  }
  for (const p of d.platforms) if (p.w <= 0) fail('platform with no width');
  for (const b of d.blocks) if (b.w <= 0 || b.h <= 0) fail('block with no size');
  for (const e of d.enemies) {
    if (e.x0 > e.x1) fail('enemy leash reversed');
    if (e.arena !== undefined && !d.arenas[e.arena]) fail('enemy in a missing arena');
  }
  for (const all of [d.plants, d.fireflies, d.shells, d.checkpoints, d.urchins, d.geysers, d.gates, d.stones, d.kin, d.grants, d.enemies]) {
    for (const e of all) if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || e.x < 0 || e.x > d.width) fail('entity out of bounds');
  }
}
