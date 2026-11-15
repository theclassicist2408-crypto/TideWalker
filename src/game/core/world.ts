import { ASSIST_AFTER_FAILS, DIFF, P, type DifficultyTuning } from './constants';
import type {
  CheckpointDef,
  CurrentDef,
  Difficulty,
  EventType,
  FishKind,
  GameEvent,
  GameMode,
  GateDef,
  GeyserDef,
  Intent,
  KinDef,
  LevelData,
  PlatformDef,
  ShellDef,
  StoneDef,
} from './types';
import { Heightfield, OPEN_SKY } from '../systems/terrain';
import { Tide } from '../systems/tide';
import { updatePlayer } from '../entities/player';
import { resetFish, updateFish } from '../entities/fish';
import { pulseProps, resetProps, updateProps } from '../entities/props';
import { updateLumen } from '../systems/lumen';

export interface PlayerState {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  facing: number;
  onGround: boolean;
  onPlatform: PlatformState | null;
  swim: boolean;
  wading: boolean;
  lumen: number;
  glowOn: boolean;
  /** Smoothed 0..1 glow amount for visuals and light radius. */
  glow: number;
  /** Glow needs a little Lumen back before it can restart after running dry. */
  glowLocked: boolean;
  pulseCd: number;
  pulseFlash: number;
  invuln: number;
  hidden: boolean;
  crouch: boolean;
  dashT: number;
  dashCd: number;
  dashDir: number;
  airDashed: boolean;
  coyote: number;
  buffer: number;
  jumping: boolean;
  leapArm: number;
  dropT: number;
  fadeT: number;
  inKelp: boolean;
  inPool: boolean;
  inSafe: boolean;
  /** 0..1 proximity of the nearest alerted fish, for danger feedback. */
  danger: number;
  status: 'alive' | 'caught' | 'swept';
  statusT: number;
}

export type FishMode = 'dormant' | 'patrol' | 'investigate' | 'linger' | 'windup' | 'lunge' | 'recover' | 'return' | 'stunned';

export interface FishState {
  kind: FishKind;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  hx1: number;
  hy1: number;
  hx2: number;
  hy2: number;
  /** Which end of the patrol path the fish is heading to (0 or 1). */
  leg: number;
  mode: FishMode;
  t: number;
  tx: number;
  ty: number;
  /** Lunge direction. */
  lx: number;
  ly: number;
  /** 0..1 awareness, drives eye glow and warnings. */
  alert: number;
  /** Angler: how long light has been held nearby. */
  curiosity: number;
  missed: boolean;
  rippleT: number;
}

export interface PlatformState extends PlatformDef {
  lit: number;
  litT: number;
  solid: boolean;
  /** Crumble: -1 idle, counts down once stood on. */
  timer: number;
  fallen: number;
}

export interface CurrentState extends CurrentDef {
  /** -1..1 current strength right now (sign flips for `flip` currents). */
  power: number;
}

export interface PlantState {
  x: number;
  y: number;
  cd: number;
}

export interface FireflyState {
  x: number;
  y: number;
  taken: boolean;
}

export interface GeyserState extends GeyserDef {
  /** 0 idle, 0..1 warning ramp, 2 erupting. */
  phaseNow: number;
  fired: boolean;
}

export interface GateState extends GateDef {
  open: boolean;
  prog: number;
}

export interface StoneState extends StoneDef {
  cy: number;
  vy: number;
  mode: 'hang' | 'warn' | 'fall' | 'rest';
  t: number;
}

export interface ShellState extends ShellDef {
  taken: boolean;
  revealed: boolean;
  /** True if the player already owned this shell before the run. */
  owned: boolean;
}

export interface CheckpointState extends CheckpointDef {
  lit: boolean;
}

export interface KinState extends KinDef {
  awake: boolean;
  cx: number;
  cy: number;
  vx: number;
  vy: number;
  life: number;
  gone: boolean;
  slot: number;
}

export interface WorldOptions {
  difficulty: Difficulty;
  mode: GameMode;
  ownedShells?: ReadonlySet<string>;
  /** Start at this checkpoint index (resume). */
  startCheckpoint?: number;
  /** Multiplies tide speed (Daily Tide conditions). */
  tideScale?: number;
  /** Multiplies Lumen drain (Daily Tide conditions). */
  drainScale?: number;
}

const MAX_EVENTS = 96;

/** The whole simulation for one level. Pure logic: no rendering, audio or DOM. */
export class World {
  readonly level: LevelData;
  readonly mode: GameMode;
  readonly difficulty: Difficulty;
  readonly diff: DifficultyTuning;
  readonly ground: Heightfield;
  readonly ceil: Heightfield;
  readonly tide: Tide;
  readonly tideScale: number;
  readonly drainScale: number;

  player: PlayerState;
  fish: FishState[] = [];
  platforms: PlatformState[] = [];
  currents: CurrentState[] = [];
  plants: PlantState[] = [];
  fireflies: FireflyState[] = [];
  geysers: GeyserState[] = [];
  gates: GateState[] = [];
  stones: StoneState[] = [];
  shells: ShellState[] = [];
  checkpoints: CheckpointState[] = [];
  kin: KinState[] = [];
  secretsFound = new Set<string>();

  /** Surface y of the water this step. */
  waterY = 0;
  /** Seconds played in this run (drives best times). */
  time = 0;
  /** Simulation clock for periodic props; never rewinds. */
  clock = 0;
  status: 'playing' | 'failed' | 'complete' = 'playing';
  checkpointIndex = -1;
  checkpointTide = 0;
  failsHere = 0;
  totalFails = 0;
  assist = false;
  kinAwake = 0;
  /** Left edge the player may not cross (moves in Drift Mode). */
  minX = 10;

  readonly events: GameEvent[] = [];
  eventCount = 0;

  constructor(level: LevelData, opts: WorldOptions) {
    this.level = level;
    this.mode = opts.mode;
    this.difficulty = opts.difficulty;
    this.diff = DIFF[opts.difficulty];
    this.tideScale = opts.tideScale ?? 1;
    this.drainScale = opts.drainScale ?? 1;
    this.ground = new Heightfield(level.groundX.slice(), level.groundY.slice());
    this.ceil = new Heightfield(level.ceilX.slice(), level.ceilY.slice(), OPEN_SKY);
    this.tide = new Tide(level.tide);
    for (let i = 0; i < MAX_EVENTS; i++) this.events.push({ type: 'jump', x: 0, y: 0, v: 0 });

    const owned = opts.ownedShells ?? new Set<string>();
    this.addEntities(level, owned);
    this.player = this.makePlayer(level.spawn.x, level.spawn.y);

    const start = opts.startCheckpoint ?? -1;
    if (start >= 0 && start < this.checkpoints.length) {
      const cp = this.checkpoints[start];
      for (let i = 0; i <= start; i++) this.checkpoints[i].lit = true;
      this.checkpointIndex = start;
      this.checkpointTide = cp.tideCap * 0.8;
      this.tide.setTime(this.checkpointTide);
      this.player.x = this.player.prevX = cp.x;
      this.player.y = this.player.prevY = cp.y;
    }
    this.waterY = this.tide.level;
    resetFish(this);
  }

  /** Registers the entities of a level (or of a streamed Drift chunk). */
  addEntities(level: LevelData, owned: ReadonlySet<string>): void {
    for (const d of level.platforms) this.platforms.push({ ...d, lit: 0, litT: 0, solid: d.kind !== 'moonglass', timer: -1, fallen: 0 });
    for (const d of level.currents) this.currents.push({ ...d, power: 0 });
    for (const d of level.plants) this.plants.push({ x: d.x, y: d.y, cd: 0 });
    for (const d of level.fireflies) this.fireflies.push({ x: d.x, y: d.y, taken: false });
    for (const d of level.geysers) this.geysers.push({ ...d, phaseNow: 0, fired: false });
    for (const d of level.gates) this.gates.push({ ...d, open: false, prog: 0 });
    for (const d of level.stones) this.stones.push({ ...d, cy: d.y, vy: 0, mode: 'hang', t: 0 });
    for (const d of level.shells) this.shells.push({ ...d, taken: false, revealed: !d.hidden, owned: owned.has(d.id) });
    for (const d of level.checkpoints) {
      if (d.gentleOnly && this.difficulty !== 'gentle') continue;
      this.checkpoints.push({ ...d, lit: false });
    }
    let slot = this.kin.length;
    for (const d of level.kin) this.kin.push({ ...d, awake: false, cx: d.x, cy: d.y, vx: 0, vy: 0, life: 0, gone: false, slot: slot++ });
    for (const d of level.fish) {
      this.fish.push({
        kind: d.kind,
        x: d.x,
        y: d.y,
        prevX: d.x,
        prevY: d.y,
        vx: 0,
        vy: 0,
        hx1: d.x,
        hy1: d.y,
        hx2: d.x2,
        hy2: d.y2,
        leg: 1,
        mode: 'patrol',
        t: 0,
        tx: d.x,
        ty: d.y,
        lx: 1,
        ly: 0,
        alert: 0,
        curiosity: 0,
        missed: false,
        rippleT: 0,
      });
    }
  }

  private makePlayer(x: number, y: number): PlayerState {
    return {
      x,
      y,
      prevX: x,
      prevY: y,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: false,
      onPlatform: null,
      swim: false,
      wading: false,
      lumen: this.diff.lumenMax,
      glowOn: false,
      glow: 0,
      glowLocked: false,
      pulseCd: 0,
      pulseFlash: 0,
      invuln: 0,
      hidden: false,
      crouch: false,
      dashT: 0,
      dashCd: 0,
      dashDir: 1,
      airDashed: false,
      coyote: 0,
      buffer: 0,
      jumping: false,
      leapArm: 0,
      dropT: 0,
      fadeT: 0,
      inKelp: false,
      inPool: false,
      inSafe: false,
      danger: 0,
      status: 'alive',
      statusT: 0,
    };
  }

  emit(type: EventType, x: number, y: number, v = 0): void {
    if (this.eventCount >= MAX_EVENTS) return;
    const e = this.events[this.eventCount++];
    e.type = type;
    e.x = x;
    e.y = y;
    e.v = v;
  }

  /** Call after the frame's events have been consumed. */
  clearEvents(): void {
    this.eventCount = 0;
  }

  get lumenFrac(): number {
    return this.player.lumen / this.diff.lumenMax;
  }

  /** Radius the creature's own light reaches right now. */
  get lightRadius(): number {
    const p = this.player;
    const f = 0.62 + 0.38 * Math.min(1, this.lumenFrac * 1.6);
    return P.ambientRadius * (0.7 + 0.3 * f) + (P.glowRadius - P.ambientRadius) * p.glow * f;
  }

  get tideRate(): number {
    return this.diff.tideRate * this.tideScale * (this.assist ? 0.78 : 1);
  }

  get fishSpeedScale(): number {
    return this.diff.fishSpeed * (this.assist ? 0.85 : 1);
  }

  /** Advances the simulation by one fixed step. */
  step(intent: Intent, dt: number): void {
    this.clock += dt;
    if (this.status === 'playing') {
      this.time += dt;
      this.tide.update(dt * this.tideRate);
    }
    this.waterY = this.tide.level;
    updateProps(this, dt);
    updatePlayer(this, intent, dt);
    if (this.status !== 'playing') return;
    updateFish(this, dt);
    updateLumen(this, dt);
    this.checkProgress();
  }

  /** A Lumen Pulse: pushes fish, wakes moonglass, gates and kin. */
  pulse(x: number, y: number): void {
    pulseProps(this, x, y);
  }

  private checkProgress(): void {
    const p = this.player;
    for (let i = this.checkpointIndex + 1; i < this.checkpoints.length; i++) {
      const cp = this.checkpoints[i];
      if (p.x >= cp.x - 14 && Math.abs(p.y - cp.y) < 160) {
        this.checkpointIndex = i;
        cp.lit = true;
        for (let j = 0; j < i; j++) this.checkpoints[j].lit = true;
        this.checkpointTide = Math.min(this.tide.time, cp.tideCap);
        this.failsHere = 0;
        this.assist = false;
        p.lumen = Math.min(this.diff.lumenMax, p.lumen + this.diff.lumenMax * 0.45);
        this.emit('checkpoint', cp.x, cp.y, i);
      }
    }
    if (this.mode !== 'drift' && this.mode !== 'title' && p.x >= this.level.goalX) {
      this.status = 'complete';
      this.emit('goal', p.x, p.y, 0);
    }
  }

  fail(kind: 'caught' | 'swept'): void {
    if (this.status !== 'playing' || this.mode === 'drift' || this.mode === 'title') return;
    const p = this.player;
    this.status = 'failed';
    p.status = kind;
    p.statusT = 0;
    p.glowOn = false;
    this.failsHere++;
    this.totalFails++;
    this.emit(kind, p.x, p.y, 0);
  }

  /** Returns the player to the last checkpoint with the world gently reset. */
  respawn(): void {
    const cp = this.checkpointIndex >= 0 ? this.checkpoints[this.checkpointIndex] : null;
    const sx = cp ? cp.x : this.level.spawn.x;
    const sy = cp ? cp.y : this.level.spawn.y;
    const keepFacing = this.player.facing;
    this.player = this.makePlayer(sx, sy);
    this.player.facing = keepFacing >= 0 ? 1 : -1;
    this.player.invuln = 1.2;
    const wasAssist = this.assist;
    this.assist = this.failsHere >= ASSIST_AFTER_FAILS;
    const rewind = this.checkpointTide * (this.assist ? 0.85 : 1);
    this.tide.setTime(rewind);
    this.waterY = this.tide.level;
    resetProps(this);
    resetFish(this);
    this.status = 'playing';
    this.emit('respawn', sx, sy, 0);
    if (this.assist && !wasAssist) this.emit('assist', sx, sy, 0);
  }

  /** Shell ids collected during this run (including ones owned before). */
  collectedShellIds(): string[] {
    const out: string[] = [];
    for (const s of this.shells) if (s.taken) out.push(s.id);
    return out;
  }
}
