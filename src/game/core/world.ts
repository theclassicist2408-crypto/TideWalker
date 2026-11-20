import { ASSIST_AFTER_FAILS, BASE_ESSENCE, BASE_HP, BASE_LUMEN, DIFF, DRILL_REPS, DRILLS, P, type DifficultyTuning } from './constants';
import type {
  AbilityId,
  ArenaDef,
  ChestDef,
  DrillId,
  BlockDef,
  CheckpointDef,
  CurrentDef,
  Difficulty,
  EnemyKind,
  EventType,
  GameEvent,
  GameMode,
  GateDef,
  GeyserDef,
  GrantDef,
  Intent,
  KinDef,
  LevelData,
  Loadout,
  PlatformDef,
  RelicId,
  RewardId,
  ShellDef,
  StoneDef,
  StyleId,
  SwordId,
} from './types';
import { Heightfield, OPEN_SKY } from '../systems/terrain';
import { Tide } from '../systems/tide';
import { updatePlayer } from '../entities/player';
import { resetEnemies, spawnEnemy, updateEnemies } from '../entities/enemies';
import { resetBoss, updateBoss, type BossState } from '../entities/bosses';
import { resetProps, updateProps } from '../entities/props';
import { updateArenas, updateHazards, updateRules, updateTrials } from '../systems/combat';

export type SlashDir = 'side' | 'up' | 'down';

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
  hp: number;
  lumen: number;
  essence: number;
  glowOn: boolean;
  glow: number;
  pulseCd: number;
  pulseFlash: number;
  invuln: number;
  dashT: number;
  dashCd: number;
  dashDir: number;
  airDashed: boolean;
  jumpsLeft: number;
  coyote: number;
  buffer: number;
  jumping: boolean;
  gliding: boolean;
  /** Side of the wall being touched (-1 left, 1 right) while `wallT` > 0. */
  wallDir: number;
  wallT: number;
  clingT: number;
  sliding: boolean;
  /** Steering is ignored briefly after a wall jump or a hit. */
  lockT: number;
  leapArm: number;
  dropT: number;
  slashT: number;
  slashCd: number;
  slashDir: SlashDir;
  slashId: number;
  charged: boolean;
  chargeT: number;
  healT: number;
  abilityCd: number;
  veilT: number;
  shield: number;
  emberT: number;
  bloomT: number;
  crownT: number;
  hookT: number;
  hookX: number;
  hookY: number;
  slamming: boolean;
  inPool: boolean;
  inSafe: boolean;
  /** 0..1 nearness of anything hostile, for music and feedback. */
  danger: number;
  status: 'alive' | 'dead';
  statusT: number;
  /** Last place the creature stood safely (spikes return it here). */
  safeX: number;
  safeY: number;
  /** Quick side strikes in a row (the Third Cut technique), and time left to continue the run. */
  comboN: number;
  comboT: number;
  /** A strike pressed early, waiting for the blade to come back. */
  attackBuf: number;
  /** Seconds since the last dash ended (Dash Strike). */
  sinceDash: number;
  /** Damage and reach multipliers of the swing in progress. */
  slashMul: number;
  slashReach: number;
}

export type EnemyMode = 'idle' | 'windup' | 'attack' | 'rest' | 'stun' | 'hidden';

export interface EnemyState {
  kind: EnemyKind;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  homeX: number;
  homeY: number;
  x0: number;
  x1: number;
  hp: number;
  hpMax: number;
  facing: number;
  mode: EnemyMode;
  t: number;
  /** Free per-kind scratch values (aim, counters). */
  a: number;
  b: number;
  elite: boolean;
  arena: number;
  wave: number;
  /** Waiting for its arena wave. */
  active: boolean;
  alive: boolean;
  onGround: boolean;
  flash: number;
  burn: number;
  lastHit: number;
  /** Seconds since spawn-in began; enemies fade in before they can act. */
  spawnT: number;
}

export interface Projectile {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  r: number;
  life: number;
  dmg: number;
  hostile: boolean;
  /** orb: free flight. wave: hugs the floor. echo: the player's sound line. */
  kind: 'orb' | 'wave' | 'echo';
  hitId: number;
}

export interface Zone {
  alive: boolean;
  circle: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Warning time left; the zone only hurts once this reaches zero. */
  warn: number;
  warn0: number;
  dur: number;
  dmg: number;
  struck: boolean;
}

export interface ArenaState extends ArenaDef {
  state: 'idle' | 'active' | 'done';
  waveNow: number;
  timer: number;
}

export interface PlatformState extends PlatformDef {
  x0: number;
  y0: number;
  lit: number;
  litT: number;
  solid: boolean;
  timer: number;
  fallen: number;
  mvx: number;
  mvy: number;
}

export interface BlockState extends BlockDef {
  broken: boolean;
}

export interface CurrentState extends CurrentDef {
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

export interface GrantState extends GrantDef {
  taken: boolean;
}

export interface ChestState extends ChestDef {
  opened: boolean;
}

export interface MutableLoadout {
  abilities: Set<AbilityId>;
  rewards: Set<RewardId>;
  equipped: RewardId | null;
  hpMax: number;
  lumenMax: number;
  essenceMax: number;
  pulseLevel: number;
  sword: SwordId;
  blade: number;
  styles: Set<StyleId>;
  relics: Record<RelicId, number>;
  relic: RelicId | null;
}

export interface WorldOptions {
  difficulty: Difficulty;
  mode: GameMode;
  loadout?: Loadout;
  ownedShells?: ReadonlySet<string>;
  /** Guardians already beaten: their arenas stay open and their shrines are free. */
  defeated?: ReadonlySet<string>;
  /** Grant ids (`level:index`) already taken. */
  taken?: ReadonlySet<string>;
  /** Chest ids already opened in this save. */
  openedChests?: ReadonlySet<string>;
  startCheckpoint?: number;
}

export const emptyLoadout = (): Loadout => ({
  abilities: new Set(),
  rewards: new Set(),
  equipped: null,
  hpMax: BASE_HP,
  lumenMax: BASE_LUMEN,
  essenceMax: BASE_ESSENCE,
  pulseLevel: 0,
});

const MAX_EVENTS = 128;
const MAX_PROJECTILES = 96;
const MAX_ZONES = 48;

/** The whole simulation for one level. Pure logic: no rendering, audio or DOM. */
export class World {
  readonly level: LevelData;
  readonly mode: GameMode;
  readonly difficulty: Difficulty;
  readonly diff: DifficultyTuning;
  readonly ground: Heightfield;
  readonly ceil: Heightfield;
  readonly tide: Tide;
  /** Enemy strength tier, from the area (1–10). */
  readonly tier: number;
  readonly load: MutableLoadout;
  readonly defeated: Set<string>;
  private readonly takenGrants: ReadonlySet<string>;
  private readonly openedChests: ReadonlySet<string>;

  player: PlayerState;
  enemies: EnemyState[] = [];
  boss: BossState | null = null;
  readonly projectiles: Projectile[] = [];
  readonly zones: Zone[] = [];
  arenas: ArenaState[] = [];
  platforms: PlatformState[] = [];
  blocks: BlockState[] = [];
  currents: CurrentState[] = [];
  plants: PlantState[] = [];
  fireflies: FireflyState[] = [];
  geysers: GeyserState[] = [];
  gates: GateState[] = [];
  stones: StoneState[] = [];
  shells: ShellState[] = [];
  checkpoints: CheckpointState[] = [];
  chests: ChestState[] = [];
  /** Plasma picked up since the last lantern: banked at a lantern or the goal, lost on a fall. */
  plasma = 0;
  /** Index of the trial being fought, or -1 on the main route. */
  trialIndex = -1;
  /** Training: how many times each move has been done (tutorial only). */
  readonly drills: Record<DrillId, number> = Object.fromEntries(DRILLS.map((d) => [d.id, 0])) as Record<DrillId, number>;
  private glideT = 0;
  private deep = false;
  private wasSwim = false;
  /** Seconds before a portal can be used again. */
  portalCd = 0;
  kin: KinState[] = [];
  grants: GrantState[] = [];
  secretsFound = new Set<string>();

  waterY = 0;
  /** Extra water height a boss can summon into its arena (px, positive = higher). */
  flood = 0;
  floodTarget = 0;
  time = 0;
  clock = 0;
  /** Frames of impact freeze requested by a hit; the game loop honours it. */
  hitstop = 0;
  status: 'playing' | 'failed' | 'complete' = 'playing';
  checkpointIndex = -1;
  checkpointTide = 0;
  failsHere = 0;
  totalFails = 0;
  assist = false;
  kinAwake = 0;
  minX = 10;
  /** Right edge the creature can reach: the goal on the main route, the trial's wall inside one. */
  maxX = 0;
  /** Chase levels: x of the advancing dark. */
  chaseX = -600;
  /** Timed levels: seconds left. */
  timeLeft = 0;
  hitsTaken = 0;
  private slashSeq = 0;
  private ached = false;

  readonly events: GameEvent[] = [];
  eventCount = 0;

  constructor(level: LevelData, opts: WorldOptions) {
    this.level = level;
    this.mode = opts.mode;
    this.difficulty = opts.difficulty;
    this.diff = DIFF[opts.difficulty];
    this.tier = Math.max(1, level.area);
    this.ground = new Heightfield(level.groundX.slice(), level.groundY.slice());
    this.ceil = new Heightfield(level.ceilX.slice(), level.ceilY.slice(), OPEN_SKY);
    this.tide = new Tide(level.tide);
    this.defeated = new Set(opts.defeated ?? []);
    this.takenGrants = opts.taken ?? new Set();
    const l = opts.loadout ?? emptyLoadout();
    this.load = {
      abilities: new Set(l.abilities),
      rewards: new Set(l.rewards),
      equipped: l.equipped,
      hpMax: Math.max(2, l.hpMax + this.diff.hpBonus),
      lumenMax: l.lumenMax,
      essenceMax: l.essenceMax,
      pulseLevel: l.pulseLevel,
      sword: l.sword ?? 'tide',
      blade: l.blade ?? 0,
      styles: new Set(l.styles ?? []),
      relics: { thunder: 0, frost: 0, draught: 0, nova: 0, ...l.relics },
      relic: l.relic ?? null,
    };
    this.openedChests = opts.openedChests ?? new Set();
    for (let i = 0; i < MAX_EVENTS; i++) this.events.push({ type: 'jump', x: 0, y: 0, v: 0 });
    for (let i = 0; i < MAX_PROJECTILES; i++) this.projectiles.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, gravity: 0, r: 6, life: 0, dmg: 1, hostile: true, kind: 'orb', hitId: 0 });
    for (let i = 0; i < MAX_ZONES; i++) this.zones.push({ alive: false, circle: false, x: 0, y: 0, w: 0, h: 0, warn: 0, warn0: 1, dur: 0, dmg: 1, struck: false });

    this.addEntities(level, opts.ownedShells ?? new Set<string>());
    this.player = this.makePlayer(level.spawn.x, level.spawn.y);
    this.maxX = this.mainMaxX;
    this.timeLeft = (level.rules.timeLimit ?? 0) * this.diff.mercy;

    const start = opts.startCheckpoint ?? -1;
    if (start >= 0 && start < this.checkpoints.length) {
      const cp = this.checkpoints[start];
      for (let i = 0; i <= start; i++) this.checkpoints[i].lit = true;
      this.checkpointIndex = start;
      this.checkpointTide = cp.tideCap * 0.8;
      this.tide.setTime(this.checkpointTide);
      this.player.x = this.player.prevX = this.player.safeX = cp.x;
      this.player.y = this.player.prevY = this.player.safeY = cp.y;
      // Anything behind the lantern has already been dealt with.
      for (const a of this.arenas) if (a.x1 < cp.x) a.state = 'done';
    }
    this.waterY = this.tide.level;
    resetEnemies(this);
    resetBoss(this);
  }

  private addEntities(level: LevelData, owned: ReadonlySet<string>): void {
    for (const d of level.platforms) this.platforms.push({ ...d, x0: d.x, y0: d.y, lit: 0, litT: 0, solid: d.kind !== 'moonglass', timer: -1, fallen: 0, mvx: 0, mvy: 0 });
    for (const d of level.blocks) this.blocks.push({ ...d, broken: false });
    for (const d of level.chests) this.chests.push({ ...d, opened: this.openedChests.has(d.id) });
    for (const d of level.currents) this.currents.push({ ...d, power: 0 });
    for (const d of level.plants) this.plants.push({ x: d.x, y: d.y, cd: 0 });
    for (const d of level.fireflies) this.fireflies.push({ x: d.x, y: d.y, taken: false });
    for (const d of level.geysers) this.geysers.push({ ...d, phaseNow: 0, fired: false });
    for (const d of level.gates) this.gates.push({ ...d, open: d.kind === 'arena', prog: d.kind === 'arena' ? 1 : 0 });
    for (const d of level.stones) this.stones.push({ ...d, cy: d.y, vy: 0, mode: 'hang', t: 0 });
    for (const d of level.shells) this.shells.push({ ...d, taken: false, revealed: !d.hidden, owned: owned.has(d.id) });
    for (const d of level.checkpoints) {
      if (d.gentleOnly && this.difficulty !== 'gentle') continue;
      this.checkpoints.push({ ...d, lit: false });
    }
    let slot = 0;
    for (const d of level.kin) this.kin.push({ ...d, awake: false, cx: d.x, cy: d.y, vx: 0, vy: 0, life: 0, gone: false, slot: slot++ });
    level.grants.forEach((d, i) => this.grants.push({ ...d, taken: this.takenGrants.has(`${level.id}:${i}`) }));
    for (const d of level.arenas) {
      const beaten = (d.miniboss !== undefined && this.defeated.has(d.miniboss)) || (d.boss !== undefined && this.defeated.has(d.boss) && this.mode !== 'rematch');
      this.arenas.push({ ...d, state: beaten ? 'done' : 'idle', waveNow: -1, timer: 0 });
    }
    for (const d of level.enemies) spawnEnemy(this, d.kind, d.x, d.y, d.x0, d.x1, d.elite ?? false, d.arena ?? -1, d.wave ?? 0);
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
      hp: this.load.hpMax,
      lumen: this.load.lumenMax,
      essence: 0,
      glowOn: false,
      glow: 0,
      pulseCd: 0,
      pulseFlash: 0,
      invuln: 0,
      dashT: 0,
      dashCd: 0,
      dashDir: 1,
      airDashed: false,
      jumpsLeft: 1,
      coyote: 0,
      buffer: 0,
      jumping: false,
      gliding: false,
      wallDir: 0,
      wallT: 0,
      clingT: 0,
      sliding: false,
      lockT: 0,
      leapArm: 0,
      dropT: 0,
      slashT: 0,
      slashCd: 0,
      slashDir: 'side',
      slashId: 0,
      charged: false,
      chargeT: 0,
      healT: 0,
      abilityCd: 0,
      veilT: 0,
      shield: 0,
      emberT: 0,
      bloomT: 0,
      crownT: 0,
      hookT: 0,
      hookX: 0,
      hookY: 0,
      slamming: false,
      inPool: false,
      inSafe: false,
      danger: 0,
      status: 'alive',
      statusT: 0,
      safeX: x,
      safeY: y,
      comboN: 0,
      comboT: 0,
      attackBuf: 0,
      sinceDash: 9,
      slashMul: 1,
      slashReach: 1,
    };
  }

  /** Water surface at `x`: the sea, or a basin's still water where that stands higher. */
  waterAt(x: number): number {
    let y = this.waterY;
    const lakes = this.level.lakes;
    for (let i = 0; i < lakes.length; i++) {
      const l = lakes[i];
      if (x >= l.x0 && x <= l.x1 && l.y < y) y = l.y;
    }
    return y;
  }

  has(ability: AbilityId): boolean {
    return this.load.abilities.has(ability);
  }

  nextSlashId(): number {
    return ++this.slashSeq;
  }

  emit(type: EventType, x: number, y: number, v = 0): void {
    if (this.mode === 'tutorial') this.countDrill(type, v);
    if (this.eventCount >= MAX_EVENTS) return;
    const e = this.events[this.eventCount++];
    e.type = type;
    e.x = x;
    e.y = y;
    e.v = v;
  }

  clearEvents(): void {
    this.eventCount = 0;
  }

  get lumenFrac(): number {
    return this.player.lumen / this.load.lumenMax;
  }

  get lightRadius(): number {
    const p = this.player;
    const veil = p.veilT > 0 ? 0.55 : 1;
    return (P.ambientRadius + (P.glowRadius - P.ambientRadius) * p.glow) * veil;
  }

  get tideRate(): number {
    return this.diff.tideRate * (this.level.rules.tideRush ?? 1) * (this.assist ? 0.78 : 1);
  }

  /** Multiplier on enemy speed and attack cadence. */
  get pace(): number {
    return this.diff.enemySpeed * (1 + 0.028 * (this.tier - 1)) * (this.assist ? 0.88 : 1);
  }

  /** Multiplier on telegraph time. */
  get warnScale(): number {
    return this.diff.telegraph * (this.assist ? 1.2 : 1);
  }

  /** How far enemies notice the creature: light carries, the veil hides. */
  get noticeScale(): number {
    const p = this.player;
    return (p.glowOn ? 1.6 : 1) * (p.veilT > 0 ? 0.45 : 1);
  }

  spawnProjectile(x: number, y: number, vx: number, vy: number, r: number, life: number, hostile: boolean, kind: Projectile['kind'] = 'orb', gravity = 0, dmg = 1): Projectile | null {
    for (let i = 0; i < this.projectiles.length; i++) {
      const s = this.projectiles[i];
      if (s.alive) continue;
      s.alive = true;
      s.x = x;
      s.y = y;
      s.vx = vx;
      s.vy = vy;
      s.r = r;
      s.life = life;
      s.hostile = hostile;
      s.kind = kind;
      s.gravity = gravity;
      s.dmg = dmg;
      s.hitId = 0;
      return s;
    }
    return null;
  }

  /** A telegraphed danger area: shown for `warn` seconds, then harmful for `dur`. */
  spawnZone(circle: boolean, x: number, y: number, w: number, h: number, warn: number, dur: number, dmg = 1): Zone | null {
    for (let i = 0; i < this.zones.length; i++) {
      const z = this.zones[i];
      if (z.alive) continue;
      z.alive = true;
      z.circle = circle;
      z.x = x;
      z.y = y;
      z.w = w;
      z.h = h;
      z.warn = warn * this.warnScale;
      z.warn0 = z.warn;
      z.dur = dur;
      z.dmg = dmg;
      z.struck = false;
      this.emit('zoneWarn', circle ? x : x + w / 2, circle ? y : y + h / 2, 0);
      return z;
    }
    return null;
  }

  step(intent: Intent, dt: number): void {
    this.clock += dt;
    if (this.status === 'playing') {
      this.time += dt;
      this.tide.update(dt * this.tideRate);
    }
    this.flood += (this.floodTarget - this.flood) * Math.min(1, dt * 1.2);
    this.waterY = this.tide.level - this.flood;
    updateProps(this, dt);
    updatePlayer(this, intent, dt);
    if (this.status !== 'playing') return;
    updateTrials(this, intent, dt);
    if (this.mode === 'tutorial') this.trackDrills(dt);
    updateArenas(this, dt);
    updateEnemies(this, dt);
    updateBoss(this, dt);
    updateHazards(this, dt);
    updateRules(this, dt);
    this.checkProgress();
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
        p.hp = this.load.hpMax;
        p.lumen = this.load.lumenMax;
        this.emit('checkpoint', cp.x, cp.y, i);
        this.bank();
      }
    }
    if (this.mode === 'tutorial' && (!this.ached || this.drills.heal < DRILL_REPS)) {
      // The healing lesson needs something to heal and something to heal with: an old wound
      // aches here, and the Essence for mending is given. It reaches from the lesson to its
      // training gate, past the lantern that refills health.
      let end = 0;
      for (const g of this.gates) if (g.kind === 'drill' && g.drills?.includes('heal')) end = g.x;
      for (const h of this.level.hints) {
        if (h.kind !== 'heal' || p.x <= h.x || p.x >= Math.max(h.x + h.w, end)) continue;
        this.ached = true;
        if (p.essence < 1) p.essence = this.load.essenceMax;
        if (p.hp >= this.load.hpMax) {
          p.hp -= 2;
          this.emit('hurt', p.x, p.y, 0);
        }
      }
    }
    const story = this.mode === 'story' || this.mode === 'tutorial' || this.mode === 'rematch';
    if (story && this.trialIndex < 0 && p.x >= this.level.goalX) {
      this.bank();
      this.status = 'complete';
      this.emit('goal', p.x, p.y, 0);
    }
  }

  /** The Tideborn's light goes out; the level returns it to the last lantern. */
  kill(): void {
    if (this.status !== 'playing' || this.mode === 'drift' || this.mode === 'title') return;
    const p = this.player;
    this.status = 'failed';
    p.status = 'dead';
    p.statusT = 0;
    p.hp = 0;
    p.glowOn = false;
    this.failsHere++;
    this.totalFails++;
    this.emit('death', p.x, p.y, 0);
    if (this.plasma > 0) this.emit('plasmaLost', p.x, p.y, this.plasma);
    this.plasma = 0;
  }

  respawn(): void {
    const cp = this.checkpointIndex >= 0 ? this.checkpoints[this.checkpointIndex] : null;
    const sx = cp ? cp.x : this.level.spawn.x;
    const sy = cp ? cp.y : this.level.spawn.y;
    this.player = this.makePlayer(sx, sy);
    this.player.invuln = 1;
    this.trialIndex = -1;
    this.minX = 10;
    this.maxX = this.mainMaxX;
    const wasAssist = this.assist;
    this.assist = this.failsHere >= ASSIST_AFTER_FAILS;
    this.tide.setTime(this.checkpointTide * (this.assist ? 0.85 : 1));
    this.flood = this.floodTarget = 0;
    this.waterY = this.tide.level;
    this.chaseX = sx - 520;
    if (this.level.rules.timeLimit) {
      // The clock restarts in proportion to the ground still to cover.
      const left = (this.level.goalX - sx) / Math.max(1, this.level.goalX - this.level.spawn.x);
      this.timeLeft = this.level.rules.timeLimit * this.diff.mercy * (0.15 + 0.85 * left) * (this.assist ? 1.25 : 1);
    }
    for (const z of this.zones) z.alive = false;
    for (const s of this.projectiles) s.alive = false;
    for (const a of this.arenas) {
      if (a.state === 'active') {
        a.state = 'idle';
        a.waveNow = -1;
        a.timer = 0;
      }
    }
    for (const g of this.gates) {
      if (g.kind === 'arena') {
        g.open = true;
        g.prog = 1;
      }
    }
    resetProps(this);
    resetEnemies(this);
    resetBoss(this);
    this.status = 'playing';
    this.emit('respawn', sx, sy, 0);
    if (this.assist && !wasAssist) this.emit('assist', sx, sy, 0);
  }

  /** Training: which move an event shows, if any. */
  private countDrill(type: EventType, v: number): void {
    const p = this.player;
    let d: DrillId | null = null;
    if (type === 'jump' && v === 0) d = 'jump';
    else if (type === 'doubleJump') d = 'double';
    else if (type === 'wallJump') d = 'wall';
    else if (type === 'dash') d = p.onGround || p.swim ? 'dash' : 'airdash';
    else if (type === 'slash') d = v === 1 ? 'upstrike' : v === 2 ? 'downstrike' : 'strike';
    else if (type === 'finisher') d = 'combo';
    else if (type === 'chargeSlash') d = 'charge';
    else if (type === 'glowOn') d = 'glow';
    else if (type === 'pulse') d = 'pulse';
    else if (type === 'heal') d = 'heal';
    if (d) this.addDrill(d);
  }

  addDrill(d: DrillId): void {
    if (this.drills[d] >= DRILL_REPS) return;
    this.drills[d]++;
    // Recorded straight into the queue: a drill is news, not a move.
    if (this.eventCount < MAX_EVENTS) {
      const e = this.events[this.eventCount++];
      e.type = 'drill';
      e.x = this.player.x;
      e.y = this.player.y;
      e.v = DRILLS.findIndex((k) => k.id === d);
    }
  }

  /** Training moves with no event of their own: a held glide, a dive below the surface. */
  private trackDrills(dt: number): void {
    const p = this.player;
    this.glideT = p.gliding ? this.glideT + dt : 0;
    if (this.glideT > 0.3 && this.glideT - dt <= 0.3) this.addDrill('glide');
    if (p.swim && !this.wasSwim) this.addDrill('swim');
    this.wasSwim = p.swim;
    const deep = p.swim && p.y > this.waterAt(p.x) + 40;
    if (deep && !this.deep) this.addDrill('dive');
    this.deep = deep;
    for (const g of this.gates) {
      if (g.kind !== 'drill' || g.open || !g.drills) continue;
      let done = true;
      for (const d of g.drills) if (this.drills[d] < DRILL_REPS) done = false;
      if (done) {
        g.open = true;
        this.emit('gateOpen', g.x, g.y - g.h / 2, 3);
      }
    }
  }

  /** The main route ends a little past the goal; trials are built beyond it. */
  get mainMaxX(): number {
    const t = this.level.trials;
    return (t.length ? t[0].x0 - 200 : this.level.width) - 10;
  }

  /** Plasma from a kill or a pickup. Only journeys that keep progress earn it. */
  addPlasma(n: number, x: number, y: number): void {
    if (n <= 0 || (this.mode !== 'story' && this.mode !== 'rematch')) return;
    this.plasma += n;
    this.emit('plasma', x, y, n);
  }

  /** Moves the plasma carried since the last lantern into the save (the game listens for 'bank'). */
  bank(): void {
    if (this.plasma <= 0) return;
    this.emit('bank', this.player.x, this.player.y, this.plasma);
    this.plasma = 0;
  }

  collectedShellIds(): string[] {
    const out: string[] = [];
    for (const s of this.shells) if (s.taken) out.push(s.id);
    return out;
  }
}
