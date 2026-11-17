import { Container, type Sprite } from 'pixi.js';
import type { EnemyKind } from '../core/types';
import type { EnemyState } from '../core/world';
import type { Gfx } from './gfx';

/** What a pose function knows about the creature this frame. */
interface PoseState {
  t: number;
  /** Stride phase from distance travelled: legs only move when the creature does. */
  walk: number;
  idle: boolean;
  windup: boolean;
  attack: boolean;
  rest: boolean;
  stun: boolean;
  hidden: boolean;
  /** 0..1 tremble while winding up. */
  shake: number;
  vx: number;
  vy: number;
}

interface Part {
  f: string;
  ax?: number;
  ay?: number;
  /** body, accent, dark, eye (never tinted), glow (additive), or a fixed colour. */
  c?: 'body' | 'accent' | 'dark' | 'eye' | 'glow' | number;
}

interface Rig {
  body: number;
  accent: number;
  parts: Part[];
  pose: (p: Sprite[], s: PoseState, set: Setter) => void;
}

type Setter = (sp: Sprite, x: number, y: number, rot?: number, sx?: number, sy?: number) => void;

const PI = Math.PI;
const sin = Math.sin;
const cos = Math.cos;

const leg = (c: Part['c'] = 'dark'): Part => ({ f: 'p_leg', ax: 0.5, ay: 0, c });
const eye: Part = { f: 'p_eye', c: 'eye' };
const seg = (c: Part['c'] = 'body'): Part => ({ f: 'p_seg', c });

/** Crab: four legs, a ridged shell, eyes on stalks, a big claw that rises before it snaps. */
function crab(body: number, accent: number): Rig {
  return {
    body,
    accent,
    parts: [leg(), leg(), leg(), leg(), { f: 'p_claw', ax: 0.15, ay: 0.5, c: 'accent' }, { f: 'p_shell', c: 'body' }, leg('body'), leg('body'), eye, eye, { f: 'p_claw', ax: 0.15, ay: 0.5, c: 'accent' }],
    pose: (p, s, set) => {
      const bob = Math.abs(sin(s.walk)) * 1.4;
      for (let i = 0; i < 4; i++) {
        const side = i < 2 ? -1 : 1;
        set(p[i], -9 + i * 6, 2 - bob, side * 0.5 + sin(s.walk + i * PI * 0.5) * 0.55, 0.9, 0.75);
      }
      const raise = s.windup ? -1.1 : s.attack ? 0.35 : s.rest ? 0.5 : -0.2 + sin(s.t * 3) * 0.08;
      const reach = s.attack ? 6 : 0;
      set(p[4], 6, 2 - bob, raise * 0.7, 0.6);
      set(p[5], 0, -2 - bob, s.stun ? sin(s.t * 12) * 0.15 : 0, 0.78, 0.8);
      set(p[6], -3, -8 - bob, -0.2 + sin(s.t * 2) * 0.1, 0.8, 0.45);
      set(p[7], 3, -8 - bob, 0.2 + sin(s.t * 2 + 1) * 0.1, 0.8, 0.45);
      set(p[8], -3.5, -12 - bob, 0, 0.7);
      set(p[9], 3.5, -12.5 - bob, 0, 0.75);
      set(p[10], 9 + reach, -1 - bob, raise, 0.85);
    },
  };
}

/** Pufferfish: spines that stand up as it inflates to spit. */
function puffer(body: number, accent: number): Rig {
  const spines: Part[] = Array.from({ length: 8 }, () => ({ f: 'p_spike', ax: 0.5, ay: 1, c: 'accent' as const }));
  return {
    body,
    accent,
    parts: [{ f: 'p_fin', ax: 0, ay: 0.5, c: 'accent' }, ...spines, { f: 'p_round', c: 'body' }, { f: 'p_fin', ax: 0, ay: 0.5, c: 'accent' }, eye],
    pose: (p, s, set) => {
      const puff = s.windup ? 1.22 + sin(s.t * 30) * 0.03 : s.attack ? 0.85 : 1;
      const bob = sin(s.t * 2.2) * 1.5;
      set(p[0], -11 * puff, bob, PI + sin(s.t * 9) * 0.35, 0.8);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI * 2;
        const r = 11 * puff;
        set(p[1 + i], cos(a) * r, sin(a) * r + bob, a + PI / 2, 0.8, s.windup ? 1.1 : 0.7);
      }
      set(p[9], 0, bob, 0, 0.8 * puff, 0.8 * puff * (s.attack ? 1.15 : 1));
      set(p[10], 0, 4 + bob, 0.4 + sin(s.t * 7) * 0.4, 0.55);
      set(p[11], 6 * puff, -3 + bob, 0, 0.85);
    },
  };
}

/** Manta ray: wings beat as it glides; raised high before it dives. */
function manta(body: number, accent: number): Rig {
  return {
    body,
    accent,
    parts: [{ f: 'p_wing', ax: 0, ay: 1, c: 'dark' }, { f: 'p_leg', ax: 0.5, ay: 0, c: 'dark' }, { f: 'p_round', c: 'body' }, { f: 'p_wing', ax: 0, ay: 1, c: 'accent' }, eye],
    pose: (p, s, set) => {
      const flap = s.windup ? -0.9 + sin(s.t * 30) * 0.05 : s.attack ? 0.5 : sin(s.t * 7) * 0.6;
      const tilt = s.attack ? 0.45 : s.rest ? -0.1 : 0;
      set(p[0], -2, -1, -flap * 0.8 - 0.3 + tilt, 0.85, 0.8);
      set(p[1], -10, 1, PI / 2 + sin(s.t * 4) * 0.25 + tilt, 0.8, 1.1);
      set(p[2], 0, 0, tilt, 0.85, 0.42);
      set(p[3], -4, 0, flap - 0.2 + tilt, 0.85);
      set(p[4], 9, -2 + tilt * 6, 0, 0.7);
    },
  };
}

/** Needlefish: draws back like a bowstring, then darts. */
function needle(body: number, accent: number): Rig {
  return {
    body,
    accent,
    parts: [{ f: 'p_fin', ax: 0, ay: 0.5, c: 'accent' }, { f: 'p_fin', ax: 0, ay: 0.5, c: 'accent' }, { f: 'p_fish', c: 'body' }, { f: 'p_bill', ax: 0, ay: 0.5, c: 'accent' }, eye],
    pose: (p, s, set) => {
      const sx = s.windup ? 0.82 : s.attack ? 1.15 : 1;
      const wag = sin(s.t * (s.windup ? 22 : 10)) * 0.4;
      set(p[0], -13 * sx, 0, PI + wag, 0.75);
      set(p[1], -3, -4, -PI / 2 - 0.6, 0.45);
      set(p[2], 0, 0, 0, 0.8 * sx, 0.85);
      set(p[3], 13 * sx, 0, 0, 0.7 * sx, 0.8);
      set(p[4], 8 * sx, -1.5, 0, 0.6);
    },
  };
}

/** Sand eel: a mound with eyes, then a column of body bursting out of the floor. */
function eel(body: number, accent: number): Rig {
  return {
    body,
    accent,
    parts: [seg(), seg(), seg(), seg(), { f: 'p_jaw', ax: 0, ay: 0.2, c: 'accent' }, { f: 'p_round', c: 'body' }, eye, eye],
    pose: (p, s, set) => {
      const up = s.hidden ? 0.05 : s.windup ? 0.45 + sin(s.t * 30) * 0.03 : s.attack ? 1 : s.rest ? 0.6 : 0.8;
      for (let i = 0; i < 4; i++) set(p[i], sin(s.t * 6 - i) * 2 * up, 12 - i * 7 * up, sin(s.t * 6 - i) * 0.2, 1.05 - i * 0.05, 1);
      const hy = 12 - 30 * up;
      const hx = sin(s.t * 6 - 4) * 2 * up;
      set(p[4], hx + 2, hy + 4, s.attack || s.windup ? 0.6 : 0.1, 0.5);
      set(p[5], hx, hy, 0, 0.5, 0.48);
      set(p[6], hx + 2, hy - 3, 0, 0.55);
      set(p[7], hx + 6, hy - 2.5, 0, 0.5);
    },
  };
}

/** Anglerfish: a lure that sways, a jaw that gapes before it snaps shut. */
function angler(body: number, accent: number): Rig {
  return {
    body,
    accent,
    parts: [{ f: 'p_fin', ax: 0, ay: 0.5, c: 'dark' }, { f: 'p_jaw', ax: 0, ay: 0.2, c: 'dark' }, { f: 'p_angler', c: 'body' }, { f: 'p_leg', ax: 0.5, ay: 1, c: 'accent' }, { f: 'dot', c: 'glow' }, eye],
    pose: (p, s, set) => {
      const lunge = s.attack ? 5 : 0;
      const gape = s.windup ? 0.75 + sin(s.t * 25) * 0.05 : s.attack ? 0.05 : s.rest ? 0.25 : 0.15 + sin(s.t * 1.5) * 0.05;
      set(p[0], -13 + lunge, 2, PI + sin(s.t * 5) * 0.3, 0.8);
      set(p[1], -6 + lunge, 3, gape, 0.8);
      set(p[2], lunge, -2, 0, 0.8);
      const sway = 0.7 + sin(s.t * 2) * 0.25;
      set(p[3], 2 + lunge, -10, sway, 0.8, 0.9);
      set(p[4], 2 + lunge + sin(sway) * 13, -10 - cos(sway) * 13, 0, 0.3 + (s.windup ? 0.1 : 0));
      set(p[5], 8 + lunge, -5, 0, 0.8);
    },
  };
}

/** Hermit knight: a claw held up as a shield, a spiral shell on its back. */
function hermit(body: number, accent: number): Rig {
  return {
    body,
    accent,
    parts: [leg(), leg(), leg(), { f: 'p_seg', c: 'body' }, { f: 'p_spiral', c: 'accent' }, leg('body'), eye, { f: 'p_claw', ax: 0.15, ay: 0.5, c: 'body' }],
    pose: (p, s, set) => {
      const bob = Math.abs(sin(s.walk)) * 1.2;
      for (let i = 0; i < 3; i++) set(p[i], -4 + i * 5, 4 - bob, sin(s.walk + i * 2) * 0.5, 0.9, 0.7);
      const droop = s.rest || s.stun ? 0.25 : 0;
      set(p[3], 3, -1 - bob, 0, 1.2, 1.1);
      set(p[4], -6, -5 - bob + droop * 6, droop, 0.8);
      set(p[5], 6, -7 - bob, 0.3, 0.8, 0.45);
      set(p[6], 7, -11 - bob, 0, 0.7);
      // The guard: claw up and forward, lowered when it is spent.
      const guard = s.attack ? 0.2 : s.windup ? -0.4 : s.rest || s.stun ? 0.9 : -1.2;
      set(p[7], 9 + (s.attack ? 5 : 0), -1 - bob, guard, 0.9);
    },
  };
}

/** Octopus mother: a pulsing head, six tentacles that flare when she calls her brood. */
function octopus(body: number, accent: number): Rig {
  const tent: Part[] = Array.from({ length: 12 }, () => seg('accent'));
  return {
    body,
    accent,
    parts: [...tent, { f: 'p_round', c: 'body' }, eye, eye],
    pose: (p, s, set) => {
      const flare = s.windup ? 1.6 : s.attack ? 1.3 : 1;
      for (let k = 0; k < 6; k++) {
        const base = -9 + k * 3.6;
        const spread = (k - 2.5) * 0.25 * flare;
        for (let j = 0; j < 2; j++) {
          const d = 5 + j * 5;
          const wave = sin(s.t * 3 + k + j) * 0.3;
          set(p[k * 2 + j], base + sin(spread + wave) * d, 6 + cos(spread + wave) * d, spread + wave, 0.55 - j * 0.12, 0.6 - j * 0.12);
        }
      }
      const pulse = 1 + sin(s.t * (s.windup ? 12 : 2)) * 0.05;
      set(p[12], 0, -5, 0, 0.75 * pulse, 0.85 * pulse);
      set(p[13], -3, -5, 0, 0.75);
      set(p[14], 4, -5, 0, 0.75);
    },
  };
}

/** Jellyfish: a beating bell and trailing tentacles; it brightens before it discharges. */
function jelly(body: number, accent: number): Rig {
  const tent: Part[] = Array.from({ length: 12 }, () => seg('accent'));
  return {
    body,
    accent,
    parts: [...tent, { f: 'p_bell', c: 'body' }, eye, eye],
    pose: (p, s, set) => {
      const beat = sin(s.t * 3);
      const spread = s.windup ? 1.6 : 1;
      for (let k = 0; k < 4; k++) {
        const bx = (-6 + k * 4) * spread;
        for (let j = 0; j < 3; j++) set(p[k * 3 + j], bx + sin(s.t * 2.5 + k + j * 0.8) * (1 + j) * 1.2, 2 + j * 5.5 - beat, 0, 0.45, 0.55);
      }
      set(p[12], 0, -6 - beat * 1.5, 0, 0.8 * (1 - beat * 0.06), 0.8 * (1 + beat * 0.08));
      set(p[13], -3, -5 - beat * 1.5, 0, 0.6);
      set(p[14], 3, -5 - beat * 1.5, 0, 0.6);
    },
  };
}

/** Magma lobster: two great claws raised high, then brought down. */
function lobster(body: number, accent: number): Rig {
  return {
    body,
    accent,
    parts: [leg(), leg(), leg(), leg(), seg('accent'), seg('accent'), { f: 'p_claw', ax: 0.15, ay: 0.5, c: 'accent' }, { f: 'p_shell', c: 'body' }, leg('body'), eye, { f: 'p_claw', ax: 0.15, ay: 0.5, c: 'accent' }],
    pose: (p, s, set) => {
      const bob = Math.abs(sin(s.walk)) * 1.2;
      for (let i = 0; i < 4; i++) set(p[i], -8 + i * 5, 3 - bob, sin(s.walk + i * PI * 0.5) * 0.5, 0.9, 0.8);
      set(p[4], -13, -1 - bob, 0.2, 0.9, 0.8);
      set(p[5], -19, 1 - bob, 0.4, 0.7, 0.65);
      const lift = s.windup ? -1.4 + sin(s.t * 28) * 0.05 : s.attack ? 0.7 : s.rest ? 0.6 : -0.3;
      set(p[6], 5, -4 - bob, lift * 0.85, 1);
      set(p[7], 0, -3 - bob, 0, 0.95, 0.85);
      set(p[8], 6, -10 - bob, 0.3, 0.8, 0.45);
      set(p[9], 7, -14 - bob, 0, 0.75);
      set(p[10], 10, -3 - bob, lift, 1.15);
    },
  };
}

/** Anemone: petals folded shut (armoured), opening to fire. */
function anemone(body: number, accent: number): Rig {
  const petals: Part[] = Array.from({ length: 7 }, () => ({ f: 'p_petal', ax: 0.5, ay: 1, c: 'accent' as const }));
  return {
    body,
    accent,
    parts: [{ f: 'p_seg', c: 'body' }, eye, ...petals],
    pose: (p, s, set) => {
      const open = s.idle ? 0.12 + sin(s.t * 2) * 0.03 : s.windup ? 1.1 : s.attack ? 1.25 : 0.9;
      set(p[0], 0, 8, 0, 1.7, 1.2);
      set(p[1], 0, 1, 0, open > 0.5 ? 0.8 : 0.01);
      for (let i = 0; i < 7; i++) {
        const a = ((i - 3) / 3) * open + sin(s.t * 2 + i) * 0.05;
        set(p[2 + i], sin(a) * 2, 6, a, 0.9, open > 0.5 ? 1 : 0.85);
      }
    },
  };
}

/** Ghost squid: a drifting mantle trailing thin arms. */
function squid(body: number, accent: number): Rig {
  const arms: Part[] = Array.from({ length: 10 }, () => seg('accent'));
  return {
    body,
    accent,
    parts: [...arms, { f: 'p_mantle', c: 'body' }, eye, eye],
    pose: (p, s, set) => {
      const bob = sin(s.t * 2) * 2;
      for (let k = 0; k < 5; k++) {
        for (let j = 0; j < 2; j++) set(p[k * 2 + j], -5 + k * 2.5 + sin(s.t * 3 + k + j) * (1 + j) * 1.5, 6 + j * 5 + bob, 0, 0.35, 0.6);
      }
      const squeeze = s.windup ? 0.85 : 1;
      set(p[10], 0, -7 + bob, sin(s.t * 1.5) * 0.08, 0.8 * squeeze, 0.75 / squeeze);
      set(p[11], -2.5, -2 + bob, 0, 0.6);
      set(p[12], 2.5, -2 + bob, 0, 0.6);
    },
  };
}

/** Swordfish knight: upright, a fin crest, a spear drawn back and thrust. */
function swordfish(body: number, accent: number): Rig {
  return {
    body,
    accent,
    parts: [leg(), leg(), { f: 'p_fin', ax: 0, ay: 0.5, c: 'accent' }, { f: 'p_fish', c: 'body' }, { f: 'p_bill', ax: 0, ay: 0.5, c: 'accent' }, eye, { f: 'p_bill', ax: 0.1, ay: 0.5, c: 0xe8e8f0 }],
    pose: (p, s, set) => {
      const bob = Math.abs(sin(s.walk)) * 1.3;
      set(p[0], -2, 3 - bob, sin(s.walk) * 0.6, 1, 0.8);
      set(p[1], 3, 3 - bob, -sin(s.walk) * 0.6, 1, 0.8);
      set(p[2], -5, -8 - bob, PI + 0.9, 0.6);
      set(p[3], 0, -6 - bob, -PI / 2 + 0.15, 0.55, 0.9);
      set(p[4], 3, -15 - bob, -0.1, 0.45, 0.7);
      set(p[5], 2, -13 - bob, 0, 0.6);
      const draw = s.windup ? -6 : s.attack ? 9 : 0;
      const rot = s.windup ? 0.25 : s.attack ? 0 : -0.35 + sin(s.t * 2) * 0.05;
      set(p[6], 3 + draw, -6 - bob, rot, 1.3, 0.75);
    },
  };
}

/** Every regular foe, as a sea creature. Colours pair with shapes: no two read alike. */
export const RIGS: Record<EnemyKind, Rig> = {
  skitter: crab(0xe0705a, 0xf0a080),
  mite: crab(0xf0a0b0, 0xffc8d0),
  spitter: puffer(0xe8c870, 0xfff0c0),
  gloomwing: manta(0x7a6ab0, 0xa898e0),
  needlefish: needle(0x9ab8d8, 0xdce8f4),
  burrower: eel(0xc8a878, 0xe8d0a0),
  lurker: angler(0x5a4a72, 0x8a7aa0),
  shellback: hermit(0xd88a6a, 0xd8c8b0),
  broodmother: octopus(0xb860a8, 0xd890c8),
  stormjelly: jelly(0xb0e0ff, 0x90c8f0),
  emberhusk: lobster(0xd8502e, 0xff9a48),
  thornbloom: anemone(0x7a4a8a, 0xff80b8),
  voidling: squid(0xa898d8, 0xc8b8f0),
  sentinel: swordfish(0x5a7ab0, 0xb8c8e8),
};

/** A sea creature built from atlas parts and posed every frame from its foe's state. */
export class FoeRig {
  readonly root = new Container();
  private parts: Sprite[] = [];
  private tints: number[] = [];
  private flashing = false;
  private kind: EnemyKind | null = null;
  private readonly st: PoseState = { t: 0, walk: 0, idle: true, windup: false, attack: false, rest: false, stun: false, hidden: false, shake: 0, vx: 0, vy: 0 };
  private readonly set: Setter;

  constructor(private readonly gfx: Gfx) {
    const inv = gfx.inv;
    this.set = (sp, x, y, rot = 0, sx = 1, sy = sx) => {
      sp.position.set(x, y);
      sp.rotation = rot;
      sp.scale.set(inv * sx, inv * sy);
    };
  }

  private build(kind: EnemyKind): void {
    this.kind = kind;
    for (const p of this.parts) p.destroy();
    this.parts = [];
    this.tints = [];
    this.flashing = false;
    const rig = RIGS[kind];
    for (const part of rig.parts) {
      const sp = this.gfx.sprite(part.f, part.ax ?? 0.5, part.ay ?? 0.5);
      if (part.c === 'glow') {
        sp.blendMode = 'add';
        sp.tint = 0xfff0a0;
      } else if (part.c !== 'eye') {
        sp.tint = part.c === 'accent' ? rig.accent : part.c === 'dark' ? darken(rig.body) : typeof part.c === 'number' ? part.c : rig.body;
      }
      this.parts.push(sp);
      this.tints.push(sp.tint);
      this.root.addChild(sp);
    }
  }

  /**
   * Places and poses the creature. `size` scales the whole rig (radius and elite rank); the
   * flash squashes it away from a blow.
   */
  update(e: EnemyState, x: number, y: number, t: number, offset: number, size: number, hitK: number): void {
    if (e.kind !== this.kind) this.build(e.kind);
    const s = this.st;
    s.t = t + offset;
    s.walk = e.x * 0.16;
    s.idle = e.mode === 'idle';
    s.windup = e.mode === 'windup';
    s.attack = e.mode === 'attack';
    s.rest = e.mode === 'rest';
    s.stun = e.mode === 'stun';
    s.hidden = e.mode === 'hidden';
    s.vx = e.vx;
    s.vy = e.vy;
    RIGS[e.kind].pose(this.parts, s, this.set);
    const shake = s.windup ? sin(s.t * 70) * 1.2 : 0;
    this.root.position.set(x + shake, y);
    const f = e.facing >= 0 ? 1 : -1;
    this.root.scale.set(size * f * (1 + 0.3 * hitK), size * (1 - 0.22 * hitK));
    this.root.rotation = s.stun ? sin(s.t * 8) * 0.12 : 0;
  }

  /** Flashes white when struck, warmer when burning, cooler when stunned, paler when elite. */
  shade(flash: boolean, burn: boolean, stun: boolean, elite: boolean): void {
    if (flash !== this.flashing) {
      this.flashing = flash;
      for (let i = 0; i < this.parts.length; i++) this.parts[i].tint = flash ? 0xffffff : this.tints[i];
    }
    this.root.tint = burn ? 0xffc090 : stun ? 0xb8c8ff : elite ? 0xffd8f0 : 0xffffff;
  }
}

function darken(c: number): number {
  const r = ((c >> 16) & 255) * 0.6;
  const g = ((c >> 8) & 255) * 0.6;
  const b = (c & 255) * 0.6;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
