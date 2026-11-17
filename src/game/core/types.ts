/** Shared data shapes. Level data is immutable; runtime state lives in World. */

export type BiomeId = 'shallows' | 'pools' | 'kelp' | 'ruins' | 'storm' | 'coral' | 'forge' | 'gardens' | 'deep' | 'throne';
export type Difficulty = 'gentle' | 'standard' | 'intense';
export type GameMode = 'story' | 'tutorial' | 'rematch' | 'drift' | 'title';

/** Movement and combat skills. All are held in the tutorial, lost, then regained through the areas. */
export type AbilityId = 'dash' | 'wall' | 'double' | 'pulse' | 'dive' | 'airdash' | 'charge' | 'glide';
/** One per major boss. Exactly one is equipped at a time. */
export type RewardId = 'tidebreaker' | 'veil' | 'vinehook' | 'echo' | 'stormstep' | 'shield' | 'ember' | 'bloom' | 'void' | 'crown';
export type UpgradeId = 'health' | 'lumen' | 'essence' | 'pulse';

export type EnemyKind =
  | 'skitter'
  | 'spitter'
  | 'gloomwing'
  | 'needlefish'
  | 'burrower'
  | 'lurker'
  | 'shellback'
  | 'broodmother'
  | 'mite'
  | 'stormjelly'
  | 'emberhusk'
  | 'thornbloom'
  | 'voidling'
  | 'sentinel';

export type HintKind =
  | 'move'
  | 'jump'
  | 'double'
  | 'wall'
  | 'dash'
  | 'airdash'
  | 'swim'
  | 'dive'
  | 'glide'
  | 'attack'
  | 'downstrike'
  | 'charge'
  | 'pulse'
  | 'heal'
  | 'glow'
  | 'danger'
  | 'bench'
  | 'pause'
  | 'boss'
  | 'rematch'
  | 'ability'
  | 'chest'
  | 'trial';

export interface PlatformDef {
  x: number;
  y: number;
  w: number;
  /** rock: always solid. moonglass: solid only while lit. crumble: falls shortly after being stood on. */
  kind: 'rock' | 'moonglass' | 'crumble';
  /** Moving platforms travel dx/dy and back over `period` seconds. */
  dx?: number;
  dy?: number;
  period?: number;
}

/** Solid rectangle: walls to cling to, pillars, shaft sides. `cracked` breaks to a heavy blow. */
export interface BlockDef {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'rock' | 'cracked';
}

/** Hurts on touch. A downward strike bounces off it. */
export interface SpikeDef {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CurrentDef {
  x: number;
  y: number;
  w: number;
  h: number;
  fx: number;
  fy: number;
  /** Safe currents glow cyan and restore Lumen. */
  safe: boolean;
  mode: 'always' | 'rising' | 'falling' | 'flip' | 'beat';
  period?: number;
  duty?: number;
  phase?: number;
  radial?: boolean;
}

export interface KelpDef {
  x: number;
  w: number;
  y: number;
  h: number;
}

/** Still water held in a basin or pit, independent of the sea. */
export interface LakeDef {
  x0: number;
  x1: number;
  /** Surface height. */
  y: number;
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
  power: number;
}

export interface GateDef extends PointDef {
  h: number;
  /** bloom: opens when lit. tide: follows the water. arena: closed while its arena is fought. */
  kind: 'bloom' | 'tide' | 'arena';
  openAbove?: number;
  openBelow?: number;
  arena?: number;
}

export interface StoneDef extends PointDef {
  restY: number;
}

export interface ShellDef extends PointDef {
  id: string;
  hidden: boolean;
}

export interface CheckpointDef extends PointDef {
  tideCap: number;
  gentleOnly?: boolean;
}

export interface EnemyDef {
  kind: EnemyKind;
  x: number;
  y: number;
  /** Leash: the enemy never leaves [x0, x1]. */
  x0: number;
  x1: number;
  elite?: boolean;
  /** Belongs to arena `arena`, wave `wave`: spawned when that wave begins. */
  arena?: number;
  wave?: number;
}

export interface ArenaDef {
  x0: number;
  x1: number;
  /** Floor height, for spawning and telegraphs. */
  y: number;
  waves: number;
  /** Unlocked arenas can be run through; their guardian is optional. */
  lock: boolean;
  /** Survive this long instead of clearing (enemies keep coming). */
  survive?: number;
  miniboss?: string;
  boss?: string;
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
  flee?: boolean;
}

/** A shrine that restores one lost ability, or a permanent upgrade. */
export interface GrantDef extends PointDef {
  ability?: AbilityId;
  upgrade?: UpgradeId;
  /** Only given once a guardian (miniboss id) has fallen. */
  after?: string;
}

/** Rules that make a level play differently: every level has at least one twist. */
export interface LevelRules {
  /** Ambient light multiplier; below ~0.5 the level is a darkness challenge. */
  dark?: number;
  /** Seconds to reach the goal. */
  timeLimit?: number;
  /** Healing is impossible here. */
  noHeal?: boolean;
  /** Glowing calls voidlings out of the dark. */
  glowHunted?: boolean;
  /** A wall of black water advances from the left at this speed (px/s). */
  chase?: number;
  /** Fog hides enemies until they are close. */
  fog?: boolean;
  /** Extra tide speed. */
  tideRush?: number;
  /** Everything is under water. */
  flooded?: boolean;
  /** Gravity scale (low-gravity or heavy levels). */
  gravity?: number;
  /** Constant sideways push (storm wind / deep current), px/s². */
  wind?: number;
}

export interface Waypoint {
  x: number;
  y: number;
  glow?: boolean;
  waitTideAbove?: number;
  waitTideBelow?: number;
  pause?: number;
  swim?: boolean;
  optional?: boolean;
  /** Bot hint: how the stretch to this point is meant to be crossed. */
  act?: 'dash' | 'double' | 'climb' | 'glide';
  /** Bot must win this arena before moving on. */
  arena?: number;
  ride?: boolean;
}

export interface TideDef {
  keys: [number, number][];
  amp: number;
  period: number;
  breathAmp?: number;
  breathPeriod?: number;
}

export interface WeatherDef {
  rain: number;
  wind: number;
  lightning: boolean;
  fog: number;
  moon: number;
  fireflies: number;
}

export interface LevelData {
  id: string;
  /** Area 1–10 (0 for tutorial, drift and title). */
  area: number;
  /** Level 1–10 within its area. */
  index: number;
  name: string;
  line: string;
  biome: BiomeId;
  /** Short name of what makes this level different. */
  twist: string;
  rules: LevelRules;
  width: number;
  groundX: number[];
  groundY: number[];
  ceilX: number[];
  ceilY: number[];
  platforms: PlatformDef[];
  blocks: BlockDef[];
  spikes: SpikeDef[];
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
  enemies: EnemyDef[];
  arenas: ArenaDef[];
  grants: GrantDef[];
  hints: HintDef[];
  secrets: SecretDef[];
  kin: KinDef[];
  waypoints: Waypoint[];
  tide: TideDef;
  lakes: LakeDef[];
  chests: ChestDef[];
  trials: TrialDef[];
  weather: WeatherDef;
  spawn: PointDef;
  goalX: number;
}

/** What the player wants this step. Produced by input (or the bot), consumed by the simulation. */
export interface Intent {
  mx: number;
  my: number;
  jump: boolean;
  jumpHeld: boolean;
  attack: boolean;
  attackHeld: boolean;
  dash: boolean;
  pulse: boolean;
  glow: boolean;
  heal: boolean;
  ability: boolean;
  /** Use the selected relic. */
  item: boolean;
}

export const newIntent = (): Intent => ({
  mx: 0,
  my: 0,
  jump: false,
  jumpHeld: false,
  attack: false,
  attackHeld: false,
  dash: false,
  pulse: false,
  glow: false,
  heal: false,
  ability: false,
  item: false,
});

export type SwordId = 'tide' | 'ember' | 'storm' | 'coral' | 'void' | 'crown';
/** Fighting techniques bought at the Forge. */
export type StyleId = 'combo' | 'rising' | 'dashcut' | 'plunge';
/** One-time attacks and remedies, found in chests. */
export type RelicId = 'thunder' | 'frost' | 'draught' | 'nova';

/** What the Tideborn currently owns. Built from the save; the tutorial grants everything. */
export interface Loadout {
  abilities: ReadonlySet<AbilityId>;
  rewards: ReadonlySet<RewardId>;
  equipped: RewardId | null;
  hpMax: number;
  lumenMax: number;
  essenceMax: number;
  pulseLevel: number;
  /** Sword in hand (default: the Tide Blade). */
  sword?: SwordId;
  /** Forge blade level: each adds to every strike. */
  blade?: number;
  styles?: ReadonlySet<StyleId>;
  /** Relics carried into the level. */
  relics?: Readonly<Record<RelicId, number>>;
  /** Relic the item button uses. */
  relic?: RelicId | null;
}

/** A chest: strike it open. Loot is paid once per save. */
export interface ChestDef {
  id: string;
  x: number;
  y: number;
  plasma: number;
  diamonds: number;
  relic?: RelicId;
  /** Trial chests are grander and hold more. */
  grand?: boolean;
}

/**
 * A trial: a side challenge reached through a portal on the main route. It is built beyond the
 * goal; inside it the world is bounded to [x0, x1]. Falling there returns you to your lantern.
 */
export interface TrialDef {
  id: string;
  name: string;
  portalX: number;
  portalY: number;
  x0: number;
  x1: number;
  spawnX: number;
  spawnY: number;
  exitX: number;
  exitY: number;
}

export type EventType =
  | 'jump'
  | 'doubleJump'
  | 'wallJump'
  | 'land'
  | 'splashIn'
  | 'splashOut'
  | 'glowOn'
  | 'glowOff'
  | 'pulse'
  | 'pulseFail'
  | 'dash'
  | 'slash'
  | 'chargeReady'
  | 'chargeSlash'
  | 'hit'
  | 'clang'
  | 'pogo'
  | 'kill'
  | 'hurt'
  | 'death'
  | 'healStart'
  | 'heal'
  | 'essence'
  | 'pickup'
  | 'plant'
  | 'shell'
  | 'checkpoint'
  | 'goal'
  | 'gateOpen'
  | 'gateClose'
  | 'crumble'
  | 'break'
  | 'geyserWarn'
  | 'geyser'
  | 'enemyWindup'
  | 'enemyAttack'
  | 'shot'
  | 'zoneWarn'
  | 'zoneHit'
  | 'spawn'
  | 'bossIntro'
  | 'bossPhase'
  | 'bossDown'
  | 'minibossDown'
  | 'arenaStart'
  | 'arenaClear'
  | 'grant'
  | 'ability'
  | 'abilityFail'
  | 'stoneWarn'
  | 'stoneLand'
  | 'kin'
  | 'secret'
  | 'assist'
  | 'respawn'
  | 'lowLumen'
  | 'timeLow'
  | 'plasma'
  | 'plasmaLost'
  | 'bank'
  | 'diamond'
  | 'chest'
  | 'relic'
  | 'relicFail'
  | 'art'
  | 'finisher'
  | 'trialEnter'
  | 'trialExit';

export interface GameEvent {
  type: EventType;
  x: number;
  y: number;
  v: number;
}
