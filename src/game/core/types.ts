/** Shared data shapes. Level data is immutable; runtime state lives in World. */

export type BiomeId = 'storm' | 'pools' | 'kelp' | 'ruins' | 'sanctuary';
export type Difficulty = 'gentle' | 'standard' | 'intense';
export type GameMode = 'story' | 'daily' | 'drift' | 'title';
export type FishKind = 'drifter' | 'angler' | 'hush';
export type HintKind = 'move' | 'jump' | 'glow' | 'pulse' | 'dive' | 'hide' | 'dash' | 'stop';

export interface PlatformDef {
  x: number;
  y: number;
  w: number;
  /** rock: always solid. moonglass: solid only while lit. crumble: falls shortly after being stood on. */
  kind: 'rock' | 'moonglass' | 'crumble';
}

export interface CurrentDef {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Acceleration applied to anything inside, px/s². */
  fx: number;
  fy: number;
  /** Safe currents glow cyan and restore Lumen. */
  safe: boolean;
  /** always: constant. rising/falling: only while the tide moves that way. flip: reverses with the tide. beat: on/off timer. */
  mode: 'always' | 'rising' | 'falling' | 'flip' | 'beat';
  period?: number;
  duty?: number;
  phase?: number;
  /** Whirlpool: pulls toward the centre instead of along (fx, fy); strength = |fx|. */
  radial?: boolean;
}

export interface KelpDef {
  x: number;
  w: number;
  /** Base (root) y and height of the fronds. */
  y: number;
  h: number;
}

export interface PoolDef {
  x: number;
  y: number;
  r: number;
}

export interface PointDef {
  x: number;
  y: number;
}

export interface UrchinDef extends PointDef {
  r: number;
}

export interface GeyserDef extends PointDef {
  period: number;
  phase: number;
  /** Upward launch speed. */
  power: number;
}

export interface GateDef extends PointDef {
  /** Gate spans from y - h (top) to y (bottom). */
  h: number;
  /** bloom: opens when lit. tide: opens while the water surface is above (`openAbove`) or below (`openBelow`) a level. */
  kind: 'bloom' | 'tide';
  openAbove?: number;
  openBelow?: number;
}

export interface StoneDef extends PointDef {
  /** y the stone comes to rest at. */
  restY: number;
}

export interface ShellDef extends PointDef {
  id: string;
  /** Hidden shells only shimmer into view when lit. */
  hidden: boolean;
}

export interface CheckpointDef extends PointDef {
  /** Tide clock is rewound to at most this value when respawning here. */
  tideCap: number;
  gentleOnly?: boolean;
}

export interface FishDef {
  kind: FishKind;
  x: number;
  y: number;
  x2: number;
  y2: number;
}

export interface HintDef {
  x: number;
  w: number;
  kind: HintKind;
}

export interface SecretDef {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface KinDef extends PointDef {
  /** Fleeing kin wake, then swim ahead and vanish. Others follow the player. */
  flee?: boolean;
}

export interface Waypoint {
  x: number;
  y: number;
  /** Bot should glow while approaching (moonglass, gates, kin). */
  glow?: boolean;
  /** Bot should stand still until the tide surface is above / below this y. */
  waitTideAbove?: number;
  waitTideBelow?: number;
  /** Bot waits this many seconds on arrival. */
  pause?: number;
  /** Bot should arrive via water (swim target) rather than by jumping. */
  swim?: boolean;
  /** Detour only taken by the collector bot. */
  optional?: boolean;
  /** Bot should dash-jump toward this point. */
  dash?: boolean;
  /** Bot stands here until something (a geyser) throws it upward. */
  ride?: boolean;
}

export interface TideDef {
  /** [time seconds, surface y] keyframes. Smaller y is higher water. */
  keys: [number, number][];
  /** Swell amplitude and period layered over the keyframes. */
  amp: number;
  period: number;
  /** Optional slow rise-and-fall ("breathing") added to the keyframes; it drives current reversals. */
  breathAmp?: number;
  breathPeriod?: number;
}

export interface WeatherDef {
  rain: number;
  wind: number;
  lightning: boolean;
  fog: number;
  /** 0 new … 1 full. */
  moon: number;
  fireflies: number;
}

export interface LevelData {
  id: string;
  index: number;
  name: string;
  /** One short poetic line shown on the chapter card. */
  line: string;
  biome: BiomeId;
  width: number;
  groundX: number[];
  groundY: number[];
  ceilX: number[];
  ceilY: number[];
  platforms: PlatformDef[];
  currents: CurrentDef[];
  kelp: KelpDef[];
  pools: PoolDef[];
  plants: PointDef[];
  fireflies: PointDef[];
  urchins: UrchinDef[];
  geysers: GeyserDef[];
  gates: GateDef[];
  stones: StoneDef[];
  shells: ShellDef[];
  checkpoints: CheckpointDef[];
  fish: FishDef[];
  hints: HintDef[];
  secrets: SecretDef[];
  kin: KinDef[];
  waypoints: Waypoint[];
  tide: TideDef;
  weather: WeatherDef;
  spawn: PointDef;
  goalX: number;
  /** Mechanic introduced by this chapter (documentation + chapter card icon). */
  teaches: string;
}

/** What the player wants this step. Produced by input (or the bot), consumed by the simulation. */
export interface Intent {
  mx: number;
  my: number;
  jump: boolean;
  jumpHeld: boolean;
  glow: boolean;
  pulse: boolean;
  down: boolean;
  dash: boolean;
}

export const newIntent = (): Intent => ({
  mx: 0,
  my: 0,
  jump: false,
  jumpHeld: false,
  glow: false,
  pulse: false,
  down: false,
  dash: false,
});

export type EventType =
  | 'jump'
  | 'land'
  | 'splashIn'
  | 'splashOut'
  | 'glowOn'
  | 'glowOff'
  | 'pulse'
  | 'pulseFail'
  | 'dash'
  | 'sting'
  | 'bite'
  | 'caught'
  | 'swept'
  | 'fading'
  | 'pickup'
  | 'plant'
  | 'shell'
  | 'checkpoint'
  | 'goal'
  | 'gateOpen'
  | 'crumble'
  | 'geyserWarn'
  | 'geyser'
  | 'fishAlert'
  | 'fishWindup'
  | 'fishLunge'
  | 'fishRipple'
  | 'nearMiss'
  | 'stoneWarn'
  | 'stoneLand'
  | 'kin'
  | 'secret'
  | 'assist'
  | 'respawn'
  | 'lowLumen';

export interface GameEvent {
  type: EventType;
  x: number;
  y: number;
  /** Event-specific magnitude (impact speed, amount…). */
  v: number;
}
