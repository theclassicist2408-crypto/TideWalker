import type { Difficulty } from './types';

/** Width of the virtual viewport in world units. Height follows the screen aspect ratio. */
export const VIEW_W = 400;
/** Minimum world height shown; wide screens zoom so at least this much is visible. */
export const VIEW_MIN_H = 620;
export const FIXED_DT = 1 / 60;
export const MAX_STEPS_PER_FRAME = 5;

/** Creature tuning. Distances in px, time in seconds. */
export const P = {
  halfW: 9,
  halfH: 9,
  runSpeed: 150,
  accel: 1150,
  friction: 1400,
  airAccel: 820,
  gravity: 1500,
  jumpVel: 520,
  jumpCut: 0.45,
  maxFall: 640,
  coyote: 0.11,
  buffer: 0.14,
  stepUp: 6,
  swimSpeed: 118,
  swimRate: 6,
  buoyancy: 26,
  leapVel: 450,
  leapArm: 1.5,
  dashSpeed: 280,
  dashTime: 0.3,
  dashCooldown: 0.85,
  glowRadius: 150,
  ambientRadius: 46,
  pulseRadius: 320,
  pulsePush: 175,
  pulseCost: 20,
  pulseCooldown: 2.4,
  pulseReveal: 2.6,
  lowLumen: 0.25,
  lowSpeedScale: 0.72,
  wadeScale: 0.82,
  invuln: 1.4,
} as const;

export interface DifficultyTuning {
  lumenMax: number;
  tideRate: number;
  glowDrain: number;
  waterDrain: number;
  fishSpeed: number;
  fishSense: number;
  bite: number;
  sting: number;
  fadeTime: number;
  /** Lumen slowly returns on land up to this fraction, so the player is never stranded without light. */
  trickleTo: number;
  trickleRate: number;
  anglerPatience: number;
}

export const DIFF: Record<Difficulty, DifficultyTuning> = {
  gentle: {
    lumenMax: 130,
    tideRate: 0.72,
    glowDrain: 6.2,
    waterDrain: 2.0,
    fishSpeed: 0.84,
    fishSense: 0.85,
    bite: 30,
    sting: 9,
    fadeTime: 5.2,
    trickleTo: 0.34,
    trickleRate: 5,
    anglerPatience: 1.3,
  },
  standard: {
    lumenMax: 100,
    tideRate: 1,
    glowDrain: 8,
    waterDrain: 3.1,
    fishSpeed: 1,
    fishSense: 1,
    bite: 45,
    sting: 14,
    fadeTime: 3.6,
    trickleTo: 0.22,
    trickleRate: 3.5,
    anglerPatience: 0.9,
  },
  intense: {
    lumenMax: 80,
    tideRate: 1.25,
    glowDrain: 9.5,
    waterDrain: 4.1,
    fishSpeed: 1.14,
    fishSense: 1.12,
    bite: 55,
    sting: 18,
    fadeTime: 2.8,
    trickleTo: 0.15,
    trickleRate: 3,
    anglerPatience: 0.7,
  },
};

/** Fish tuning shared by all difficulties (scaled by DifficultyTuning.fishSpeed / fishSense). */
export const F = {
  drifter: { patrol: 44, chase: 84, lunge: 330, sense: 185, strike: 66, windup: 0.55, lungeTime: 0.42, hit: 15 },
  angler: { patrol: 0, chase: 40, lunge: 365, sense: 125, strike: 46, windup: 0.45, lungeTime: 0.4, hit: 16 },
  hush: { patrol: 58, chase: 108, lunge: 0, sense: 250, strike: 0, windup: 0, lungeTime: 0, hit: 22 },
  blindSense: 30,
  linger: 1.6,
  recover: 1.1,
  stun: 2.3,
  hushStun: 1.3,
  nearMiss: 30,
} as const;

/** Fails at one checkpoint before the game quietly helps. */
export const ASSIST_AFTER_FAILS = 3;
export const SAVE_KEY = 'tidewalker.save.v1';
export const TOTAL_CHAPTERS = 10;
