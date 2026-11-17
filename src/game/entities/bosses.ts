import { LOOT, P } from '../core/constants';
import type { EnemyKind, RewardId } from '../core/types';
import { approach, clamp, makeRng } from '../core/util';
import type { World } from '../core/world';
import { hurtPlayer } from '../systems/combat';
import { spawnEnemy } from './enemies';

export type AttackId = 'charge' | 'slam' | 'fan' | 'rain' | 'spikes' | 'beam' | 'summon' | 'blink' | 'spiral' | 'dive' | 'pull' | 'shrink' | 'sweep';

export interface AttackSpec {
  a: AttackId;
  /** Count: shots in a fan, columns of rain, beams in a row, volleys. */
  n?: number;
  adds?: EnemyKind;
}

export interface PhaseDef {
  /** Phase begins once health falls to this fraction. */
  at: number;
  /** Seconds of breathing room between attacks. */
  gap: number;
  attacks: AttackSpec[];
}

export interface BossDef {
  id: string;
  name: string;
  title: string;
  area: number;
  mini: boolean;
  /** Which painted body to use, and its tint. */
  look: number;
  tint: number;
  hp: number;
  r: number;
  move: 'ground' | 'fly';
  phases: PhaseDef[];
  reward?: RewardId;
}

export type BossMode = 'idleOut' | 'intro' | 'idle' | 'tele' | 'act' | 'recover' | 'dead';

export interface BossState {
  def: BossDef;
  arena: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  hp: number;
  hpMax: number;
  phase: number;
  mode: BossMode;
  t: number;
  spec: AttackSpec | null;
  step: number;
  sub: number;
  seq: number;
  facing: number;
  flash: number;
  lastHit: number;
  burn: number;
  ax: number;
  ay: number;
  angle: number;
  rng: () => number;
}

const A = (a: AttackId, n?: number, adds?: EnemyKind): AttackSpec => ({ a, n, adds });

function boss(id: string, name: string, title: string, area: number, look: number, tint: number, hp: number, r: number, move: 'ground' | 'fly', reward: RewardId, phases: PhaseDef[]): BossDef {
  return { id, name, title, area, mini: false, look, tint, hp, r, move, phases, reward };
}

function mini(id: string, name: string, area: number, look: number, tint: number, move: 'ground' | 'fly', attacks: AttackSpec[], late: AttackSpec[]): BossDef {
  return {
    id,
    name,
    title: 'Guardian',
    area,
    mini: true,
    look,
    tint,
    hp: Math.round((240 + area * 34) * (move === 'fly' ? 0.8 : 1)),
    r: 20,
    move,
    phases: [
      { at: 1, gap: 1.5, attacks },
      { at: 0.45, gap: 1.1, attacks: [...attacks, ...late] },
    ],
  };
}

/** The ten area bosses. Each adds attacks and tightens its rhythm as it weakens. */
export const BOSSES: BossDef[] = [
  boss('warden', 'The Drowned Warden', 'Keeper of the Shallows', 1, 0, 0x7fa8c8, 900, 28, 'ground', 'tidebreaker', [
    { at: 1, gap: 1.7, attacks: [A('charge'), A('slam'), A('fan', 3)] },
    { at: 0.5, gap: 1.2, attacks: [A('slam'), A('rain', 3), A('charge'), A('fan', 5)] },
  ]),
  boss('mooneater', 'The Moon-Eater', 'Thief of the Pools', 2, 1, 0xc8d8ff, 800, 26, 'fly', 'veil', [
    { at: 1, gap: 1.6, attacks: [A('dive'), A('fan', 5), A('sweep')] },
    { at: 0.5, gap: 1.15, attacks: [A('dive'), A('spiral'), A('blink'), A('sweep')] },
  ]),
  boss('sovereign', 'The Kelp Sovereign', 'Root of the Abyss', 3, 2, 0x6fd0a0, 1120, 30, 'ground', 'vinehook', [
    { at: 1, gap: 1.6, attacks: [A('rain', 3), A('spikes'), A('summon', 2, 'skitter')] },
    { at: 0.55, gap: 1.2, attacks: [A('beam', 2), A('pull'), A('spikes'), A('rain', 4)] },
  ]),
  boss('choir', 'The Abyss Choir', 'Voice of the Ruins', 4, 3, 0xc0a8ff, 990, 26, 'fly', 'echo', [
    { at: 1, gap: 1.5, attacks: [A('beam', 2), A('fan', 5), A('summon', 2, 'gloomwing')] },
    { at: 0.6, gap: 1.2, attacks: [A('spiral'), A('beam', 3), A('dive')] },
    { at: 0.25, gap: 0.95, attacks: [A('blink'), A('beam', 3), A('spiral'), A('fan', 7)] },
  ]),
  boss('squall', 'Squallmother', 'Guardian of Storm Reach', 5, 4, 0xa0c0f0, 1080, 27, 'fly', 'stormstep', [
    { at: 1, gap: 1.45, attacks: [A('dive'), A('rain', 4), A('sweep')] },
    { at: 0.6, gap: 1.1, attacks: [A('blink'), A('rain', 5), A('spiral'), A('dive')] },
    { at: 0.25, gap: 0.9, attacks: [A('sweep'), A('blink'), A('rain', 6), A('dive')] },
  ]),
  boss('pontiff', 'The Reef Pontiff', 'Guardian of the Coral Cathedral', 6, 5, 0xff9fb0, 1460, 30, 'ground', 'shield', [
    { at: 1, gap: 1.4, attacks: [A('spikes'), A('charge'), A('fan', 5)] },
    { at: 0.6, gap: 1.1, attacks: [A('summon', 2, 'thornbloom'), A('beam', 2), A('charge'), A('spikes')] },
    { at: 0.25, gap: 0.9, attacks: [A('shrink'), A('beam', 3), A('slam'), A('fan', 7)] },
  ]),
  boss('smith', 'The Cinder Smith', 'Guardian of the Sunken Forge', 7, 6, 0xffa060, 1570, 30, 'ground', 'ember', [
    { at: 1, gap: 1.35, attacks: [A('slam'), A('charge'), A('rain', 4)] },
    { at: 0.6, gap: 1.05, attacks: [A('spikes'), A('slam'), A('fan', 5), A('rain', 5)] },
    { at: 0.25, gap: 0.85, attacks: [A('charge'), A('slam'), A('spikes'), A('rain', 6)] },
  ]),
  boss('rootmother', 'The Rootmother', 'Guardian of the Abyssal Gardens', 8, 7, 0xd890e0, 1680, 30, 'ground', 'bloom', [
    { at: 1, gap: 1.3, attacks: [A('summon', 3, 'mite'), A('pull'), A('spikes')] },
    { at: 0.6, gap: 1.05, attacks: [A('rain', 5), A('spiral'), A('pull'), A('summon', 2, 'thornbloom')] },
    { at: 0.25, gap: 0.85, attacks: [A('beam', 3), A('spikes'), A('spiral'), A('pull')] },
  ]),
  boss('hush', 'The Hush', 'Guardian of the Silent Deep', 9, 8, 0x8080c0, 1440, 26, 'fly', 'void', [
    { at: 1, gap: 1.25, attacks: [A('blink'), A('dive'), A('fan', 5)] },
    { at: 0.6, gap: 1.0, attacks: [A('spiral'), A('pull'), A('beam', 2), A('blink')] },
    { at: 0.25, gap: 0.8, attacks: [A('dive'), A('blink'), A('beam', 3), A('spiral')] },
  ]),
  boss('tideking', 'The Tide King', 'He Who Drowned the Moon', 10, 9, 0xffd98a, 1800, 32, 'ground', 'crown', [
    { at: 1, gap: 1.25, attacks: [A('charge'), A('slam'), A('fan', 5), A('rain', 4)] },
    { at: 0.66, gap: 1.0, attacks: [A('beam', 3), A('spikes'), A('blink'), A('slam')] },
    { at: 0.33, gap: 0.9, attacks: [A('shrink'), A('spiral'), A('charge'), A('rain', 5), A('slam'), A('beam', 2)] },
  ]),
];

/** Twenty lesser guardians, two per area. */
export const MINIBOSSES: BossDef[] = [
  mini('brinehound', 'Brine Hound', 1, 10, 0x9fb8c8, 'ground', [A('charge'), A('slam')], [A('fan', 3)]),
  mini('clatterjaw', 'Old Clatterjaw', 1, 11, 0xb0c8a0, 'ground', [A('fan', 3), A('charge')], [A('rain', 2)]),
  mini('lanternthief', 'Lantern Thief', 2, 12, 0xd8e4ff, 'fly', [A('blink'), A('fan', 3)], [A('dive')]),
  mini('paleheron', 'Pale Heron', 2, 13, 0xf0f4ff, 'fly', [A('dive'), A('rain', 3)], [A('sweep')]),
  mini('knotfin', 'Knotfin', 3, 12, 0x70d0b0, 'fly', [A('dive'), A('spiral')], [A('fan', 5)]),
  mini('weepingfloat', 'The Weeping Float', 3, 13, 0x90e0d0, 'fly', [A('rain', 3), A('pull')], [A('sweep')]),
  mini('gatescribe', 'Gate Scribe', 4, 11, 0xc0b0f0, 'ground', [A('beam', 2), A('summon', 2, 'skitter')], [A('fan', 5)]),
  mini('belldiver', 'Bell Diver', 4, 10, 0xa898e0, 'ground', [A('slam'), A('spikes')], [A('charge')]),
  mini('galewing', 'Galewing', 5, 13, 0xb0d0ff, 'fly', [A('dive'), A('sweep')], [A('rain', 4)]),
  mini('thundercalf', 'Thunder Calf', 5, 10, 0x90a8e0, 'ground', [A('charge'), A('rain', 3)], [A('slam')]),
  mini('choirurchin', 'Choir Urchin', 6, 11, 0xff90a8, 'ground', [A('spiral'), A('spikes')], [A('beam', 2)]),
  mini('rosarycrab', 'Rosary Crab', 6, 10, 0xffb0a0, 'ground', [A('charge'), A('fan', 5)], [A('slam')]),
  mini('slagback', 'Slagback', 7, 10, 0xff8a50, 'ground', [A('slam'), A('rain', 4)], [A('spikes')]),
  mini('bellowseel', 'Bellows Eel', 7, 12, 0xffb070, 'fly', [A('beam', 2), A('dive')], [A('spiral')]),
  mini('sporequeen', 'Sporeling Queen', 8, 11, 0xe090e8, 'ground', [A('summon', 3, 'mite'), A('fan', 5)], [A('pull')]),
  mini('thornknight', 'Thorn Knight', 8, 10, 0xc878d8, 'ground', [A('charge'), A('spikes')], [A('blink')]),
  mini('mutetwin', 'Mute Twin', 9, 12, 0x8888d0, 'fly', [A('blink'), A('dive')], [A('fan', 5)]),
  mini('lightlessmaw', 'Lightless Maw', 9, 13, 0x7070b8, 'fly', [A('pull'), A('spiral')], [A('beam', 2)]),
  mini('crownguard', 'Crown Guard', 10, 10, 0xffd070, 'ground', [A('charge'), A('beam', 2)], [A('fan', 7)]),
  mini('herald', 'The Herald', 10, 12, 0xffe8a0, 'fly', [A('blink'), A('rain', 5)], [A('dive')]),
];

/** The tutorial's sparring partner: slow, soft, and there to show what a guardian's health bar means. */
export const TUTORIAL_GUARDIAN: BossDef = {
  ...mini('echo', 'Echo of the Deep', 1, 10, 0xbfe9ff, 'ground', [A('charge'), A('fan', 3)], []),
  hp: 160,
};

const BY_ID = new Map<string, BossDef>([...BOSSES, ...MINIBOSSES, TUTORIAL_GUARDIAN].map((d) => [d.id, d]));

export function bossDef(id: string): BossDef {
  const d = BY_ID.get(id);
  if (!d) throw new Error(`Unknown boss ${id}`);
  return d;
}

export function resetBoss(w: World): void {
  w.boss = null;
}

/** Wakes the guardian of an arena with a short, readable entrance. */
export function startBoss(w: World, arena: number): void {
  const a = w.arenas[arena];
  const id = a.boss ?? a.miniboss;
  if (!id) return;
  const def = bossDef(id);
  const hp = Math.round(def.hp * w.diff.bossHp);
  const x = a.x1 - 110;
  const y = def.move === 'fly' ? a.y - 130 : a.y - def.r;
  w.boss = {
    def,
    arena,
    x,
    y,
    prevX: x,
    prevY: y,
    vx: 0,
    vy: 0,
    hp,
    hpMax: hp,
    phase: 0,
    mode: 'intro',
    t: def.mini ? 1.0 : 1.9,
    spec: null,
    step: 0,
    sub: 0,
    seq: 0,
    facing: -1,
    flash: 0,
    lastHit: 0,
    burn: 0,
    ax: x,
    ay: y,
    angle: 0,
    rng: makeRng(def.id.length * 7919 + arena * 31 + w.totalFails * 13),
  };
  w.emit('bossIntro', x, y, def.mini ? 1 : 2);
}

export function hitBoss(w: World, dmg: number, burn: boolean): void {
  const b = w.boss;
  if (!b || b.mode === 'dead') return;
  b.hp -= dmg;
  b.flash = 0.12;
  if (burn) b.burn = 3;
  w.emit('hit', b.x, b.y, dmg);
  if (b.hp <= 0) {
    b.hp = 0;
    b.mode = 'dead';
    b.t = 0;
    b.vx = 0;
    const first = !w.defeated.has(b.def.id);
    w.defeated.add(b.def.id);
    const area = Math.max(1, b.def.area);
    w.addPlasma(b.def.mini ? LOOT.miniboss + LOOT.minibossPerArea * area : LOOT.boss + LOOT.bossPerArea * area, b.x, b.y);
    // Diamonds only the first time a guardian falls: rematches are for glory and plasma.
    if (first && b.def.id !== 'echo') w.emit('diamond', b.x, b.y, b.def.mini ? LOOT.minibossDiamonds : LOOT.bossDiamonds);
    for (const e of w.enemies) if (e.arena === b.arena && e.alive) e.alive = false;
    for (const z of w.zones) z.alive = false;
    for (const s of w.projectiles) if (s.hostile) s.alive = false;
    w.emit(b.def.mini ? 'minibossDown' : 'bossDown', b.x, b.y, b.arena);
    return;
  }
  const next = b.def.phases[b.phase + 1];
  if (next && b.hp / b.hpMax <= next.at) {
    // A new phase: the guardian staggers (a window to heal), then comes back harder.
    b.phase++;
    b.mode = 'recover';
    b.t = 1.5;
    b.spec = null;
    b.vx = 0;
    for (const z of w.zones) z.alive = false;
    for (const s of w.projectiles) if (s.hostile) s.alive = false;
    w.emit('bossPhase', b.x, b.y, b.phase);
  }
}

function fan(w: World, b: BossState, n: number, speed: number, width: number): void {
  const p = w.player;
  const a0 = Math.atan2(p.y - b.y, p.x - b.x);
  for (let i = 0; i < n; i++) {
    const off = n === 1 ? 0 : (i / (n - 1) - 0.5) * width;
    w.spawnProjectile(b.x, b.y, Math.cos(a0 + off) * speed, Math.sin(a0 + off) * speed, 7, 2.6, true);
  }
  w.emit('shot', b.x, b.y, 1);
}

/** Boss brain: wait, announce, act, recover. The recovery is the player's opening. */
export function updateBoss(w: World, dt: number): void {
  const b = w.boss;
  if (!b) return;
  const a = w.arenas[b.arena];
  const p = w.player;
  b.prevX = b.x;
  b.prevY = b.y;
  b.flash = Math.max(0, b.flash - dt);
  if (b.mode === 'dead') {
    b.t += dt;
    b.vy = approach(b.vy, 40, 200 * dt);
    b.y = Math.min(a.y - 6, b.y + b.vy * dt);
    return;
  }
  if (a.state !== 'active') {
    w.boss = null;
    return;
  }
  if (b.burn > 0) {
    b.burn -= dt;
    b.hp = Math.max(1, b.hp - 6 * dt);
  }
  const pace = w.pace;
  const warn = w.warnScale;
  const floor = a.y;
  const left = a.x0 + 34;
  const right = a.x1 - 34;
  const fly = b.def.move === 'fly';
  const restY = fly ? floor - 128 : floor - b.def.r;
  const phase = b.def.phases[b.phase];
  const late = b.phase > 0;
  b.t -= dt;

  if (b.mode === 'intro') {
    if (b.t <= 0) {
      b.mode = 'idle';
      b.t = 0.8;
    }
  } else if (b.mode === 'idle' || b.mode === 'recover') {
    // Drift to a fighting distance; never sit on the creature.
    b.facing = p.x >= b.x ? 1 : -1;
    if (b.mode === 'idle') {
      const want = clamp(p.x - b.facing * (fly ? 130 : 120), left, right);
      b.vx = approach(b.vx, clamp((want - b.x) * 2, -150, 150) * pace, 500 * dt);
    } else {
      b.vx = approach(b.vx, 0, 700 * dt);
    }
    const ty = fly && b.mode === 'idle' ? restY + Math.sin(w.clock * 2.2) * 12 : fly && b.mode === 'recover' ? floor - b.def.r - 6 : restY;
    // A flyer drops to the ground to recover: that is the opening against it.
    b.vy = (ty - b.y) * (b.mode === 'recover' ? 11 : 4);
    if (b.t <= 0) {
      if (b.mode === 'recover') {
        b.mode = 'idle';
        b.t = phase.gap / pace;
      } else {
        b.spec = phase.attacks[b.seq % phase.attacks.length];
        b.seq++;
        b.mode = 'tele';
        b.step = 0;
        b.sub = 0;
        b.vx = 0;
        beginAttack(w, b, warn, floor, left, right);
        w.emit('enemyWindup', b.x, b.y, 1);
      }
    }
  } else if (b.spec) {
    runAttack(w, b, dt, pace, warn, floor, left, right, restY, late);
  }

  b.x = clamp(b.x + b.vx * dt, left - 10, right + 10);
  b.y += b.vy * dt;
  if (b.y > floor - b.def.r) b.y = floor - b.def.r;

  if (b.mode !== 'intro' && b.mode !== 'recover' && Math.hypot(p.x - b.x, p.y - b.y) < b.def.r + P.halfW - 2) hurtPlayer(w, 1, b.x, b.y);
}

function toRecover(b: BossState, time: number): void {
  b.mode = 'recover';
  b.t = time + (b.def.move === 'fly' ? 0.7 : 0);
  b.spec = null;
  b.vx = 0;
}

/** Sets the wind-up length and places any warning marks. */
function beginAttack(w: World, b: BossState, warn: number, floor: number, left: number, right: number): void {
  const p = w.player;
  const s = b.spec as AttackSpec;
  b.facing = p.x >= b.x ? 1 : -1;
  switch (s.a) {
    case 'charge': {
      b.t = 0.7 * warn;
      const x0 = b.facing > 0 ? b.x : left - 30;
      const x1 = b.facing > 0 ? right + 30 : b.x;
      w.spawnZone(false, x0, b.y - b.def.r, x1 - x0, b.def.r * 2, 0.7, 0.05, 0);
      break;
    }
    case 'slam':
      b.t = 0.5 * warn;
      break;
    case 'dive':
      b.t = 0.65 * warn;
      b.ax = p.x;
      b.ay = Math.min(p.y, floor - b.def.r);
      w.spawnZone(true, b.ax, b.ay, b.def.r + 12, 0, 0.65, 0.05, 0);
      break;
    case 'blink':
      b.t = 0.45 * warn;
      break;
    case 'summon':
      b.t = 0.8 * warn;
      break;
    case 'pull':
      b.t = 0.3;
      w.spawnZone(true, b.x, b.y, 108, 0, 1.5, 0.2);
      break;
    case 'shrink':
      b.t = 0.4;
      w.spawnZone(false, left - 34, floor - 260, 96, 260, 1.3, 7);
      w.spawnZone(false, right + 34 - 96, floor - 260, 96, 260, 1.3, 7);
      break;
    default:
      b.t = 0.5 * warn;
  }
}

function runAttack(w: World, b: BossState, dt: number, pace: number, warn: number, floor: number, left: number, right: number, restY: number, late: boolean): void {
  const p = w.player;
  const s = b.spec as AttackSpec;
  const n = s.n ?? 3;
  const fly = b.def.move === 'fly';
  const teleDone = b.mode === 'tele' && b.t <= 0;
  if (b.mode === 'tele' && !teleDone) {
    b.vy = (restY - b.y) * 4;
    return;
  }
  if (teleDone) {
    b.mode = 'act';
    b.t = 0;
    b.step = 0;
    b.sub = 0;
    w.emit('enemyAttack', b.x, b.y, 3);
  }
  // From here b.t counts up from 0 as the attack plays out.
  const t = -b.t;

  switch (s.a) {
    case 'charge': {
      b.vx = b.facing * 540 * pace;
      b.vy = fly ? (Math.min(p.y, floor - b.def.r) - b.y) * 3 : 0;
      if ((b.facing > 0 && b.x >= right) || (b.facing < 0 && b.x <= left) || t > 1.6) toRecover(b, 1.15);
      break;
    }
    case 'slam': {
      const flight = 0.72;
      if (b.step === 0) {
        b.step = 1;
        b.ax = clamp(p.x, left, right);
        b.ay = b.x;
        w.spawnZone(true, b.ax, floor - 6, 50, 0, flight / w.warnScale, 0.15);
      }
      const k = Math.min(1, t / flight);
      b.vx = 0;
      b.vy = 0;
      b.x = b.ay + (b.ax - b.ay) * k;
      b.y = floor - b.def.r - Math.sin(k * Math.PI) * 170;
      if (k >= 1) {
        for (const d of [-1, 1]) w.spawnProjectile(b.x + d * b.def.r, floor, d * 270 * pace, 0, 11, 1.2, true, 'wave');
        w.emit('zoneHit', b.x, floor, 2);
        toRecover(b, 1.05);
      }
      break;
    }
    case 'fan': {
      const volleys = late ? 2 : 1;
      if (b.step < volleys && t >= b.step * 0.42) {
        fan(w, b, n, 250 * pace, 0.34 + n * 0.1);
        b.step++;
      }
      if (b.step >= volleys && t > volleys * 0.42) toRecover(b, 0.8);
      break;
    }
    case 'rain': {
      if (b.step === 0) {
        b.step = 1;
        const used: number[] = [clamp(p.x, left, right)];
        let guard = 0;
        while (used.length < n && guard++ < 40) {
          const x = left + b.rng() * (right - left);
          if (used.every((u) => Math.abs(u - x) > 64)) used.push(x);
        }
        for (const x of used) w.spawnZone(false, x - 20, floor - 280, 40, 280, 0.95, 0.25);
      }
      if (t > 0.95 * warn + 0.3) toRecover(b, 0.55);
      break;
    }
    case 'spikes': {
      const slot = 56;
      if (b.step < 2 && t >= b.step * 0.75) {
        const parity = (b.seq + b.step) % 2;
        let k = 0;
        for (let x = left - 34; x < right + 34; x += slot, k++) {
          if (k % 2 === parity) w.spawnZone(false, x, floor - 36, slot, 36, 1.0, 0.3);
        }
        b.step++;
      }
      if (t > 0.75 + 1.0 * warn + 0.4) toRecover(b, 0.55);
      break;
    }
    case 'beam': {
      if (b.step < n && t >= b.step * 1.05) {
        const low = (b.seq + b.step) % 2 === 0;
        // Low beams are jumped; high beams are waited out on the ground.
        if (low) w.spawnZone(false, left - 34, floor - 30, right - left + 68, 30, 0.9, 0.28);
        else w.spawnZone(false, left - 34, floor - 150, right - left + 68, 96, 0.9, 0.28);
        b.step++;
      }
      if (t > (n - 1) * 1.05 + 0.9 * warn + 0.35) toRecover(b, 0.65);
      break;
    }
    case 'summon': {
      let alive = 0;
      for (const e of w.enemies) if (e.arena === b.arena && e.alive) alive++;
      for (let i = 0; i < n && alive + i < 3; i++) {
        const x = clamp(b.x + (i % 2 === 0 ? -1 : 1) * (70 + i * 30), left, right);
        const kind = s.adds ?? 'skitter';
        const y = kind === 'gloomwing' ? floor - 120 : floor - 14;
        const e = spawnEnemy(w, kind, x, y, left, right, false, b.arena, -1);
        e.active = true;
        w.emit('spawn', x, y, 0);
      }
      toRecover(b, 0.7);
      break;
    }
    case 'blink': {
      if (b.step === 0) {
        b.step = 1;
        const mid = (left + right) / 2;
        b.x = clamp(p.x + (p.x < mid ? 160 : -160), left, right);
        b.y = fly ? floor - 120 : floor - b.def.r;
        b.prevX = b.x;
        b.prevY = b.y;
        b.facing = p.x >= b.x ? 1 : -1;
        w.emit('enemyWindup', b.x, b.y, 2);
      }
      if (b.step === 1 && t >= 0.45 * warn) {
        fan(w, b, 3, 280 * pace, 0.5);
        b.step = 2;
      }
      if (b.step === 2 && t > 0.45 * warn + 0.2) toRecover(b, 0.85);
      break;
    }
    case 'spiral': {
      b.vy = ((fly ? floor - 150 : restY) - b.y) * 4;
      b.sub -= dt;
      if (b.sub <= 0) {
        b.sub = 0.14;
        b.angle += 0.62;
        for (const off of late ? [0, Math.PI] : [0]) {
          w.spawnProjectile(b.x, b.y, Math.cos(b.angle + off) * 150, Math.sin(b.angle + off) * 150, 6, 3, true);
        }
      }
      if (t > 2.3) toRecover(b, 1.15);
      break;
    }
    case 'dive': {
      if (b.step === 0) {
        b.step = 1;
        const d = Math.hypot(b.ax - b.x, b.ay - b.y) || 1;
        b.vx = ((b.ax - b.x) / d) * 620 * pace;
        b.vy = ((b.ay - b.y) / d) * 620 * pace;
        b.sub = d / (620 * pace) + 0.08;
      }
      if (t > b.sub) {
        b.vy = 0;
        toRecover(b, 0.95);
      }
      break;
    }
    case 'pull': {
      // Everything is dragged inward while the ring fills; dash out.
      p.vx += Math.sign(b.x - p.x) * 620 * dt;
      b.vy = (restY - b.y) * 4;
      if (t > 1.5 * warn + 0.25) toRecover(b, 1.25);
      break;
    }
    case 'shrink':
      toRecover(b, 0.3);
      break;
    case 'sweep': {
      if (b.step === 0) {
        b.step = 1;
        b.facing = b.x < (left + right) / 2 ? 1 : -1;
      }
      b.vx = b.facing * 280 * pace;
      b.vy = (floor - 170 - b.y) * 5;
      b.sub -= dt;
      if (b.sub <= 0) {
        b.sub = 0.24;
        w.spawnProjectile(b.x, b.y + 10, 0, 60, 7, 2, true, 'orb', 500);
      }
      if ((b.facing > 0 && b.x >= right) || (b.facing < 0 && b.x <= left) || t > 2.4) toRecover(b, 0.9);
      break;
    }
  }
}
