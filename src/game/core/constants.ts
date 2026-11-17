import type { AbilityId, Difficulty, RelicId, RewardId, StyleId, SwordId } from './types';

/** Width of the virtual viewport in world units. Height follows the screen aspect ratio. */
/** World width that fits a portrait phone screen: smaller means a closer camera. */
export const VIEW_W = 280;
export const VIEW_MIN_H = 470;
export const FIXED_DT = 1 / 60;
export const MAX_STEPS_PER_FRAME = 5;

/** Tideborn tuning. Distances in px, time in seconds. */
export const P = {
  halfW: 9,
  halfH: 9,
  runSpeed: 215,
  accel: 2800,
  friction: 3400,
  airAccel: 2100,
  /** Fraction of a level's wind (px/s) added to the air-control target. */
  windPush: 0.3,
  /** How far below a basin's rim its still water sits. */
  lakeDrop: 14,
  gravity: 1750,
  jumpVel: 570,
  jumpCut: 0.45,
  doubleVel: 520,
  maxFall: 780,
  coyote: 0.1,
  buffer: 0.13,
  stepUp: 6,
  wallSlide: 70,
  wallJumpX: 190,
  wallJumpY: 530,
  wallLock: 0.1,
  wallGrace: 0.09,
  glideFall: 78,
  swimSpeed: 175,
  swimRate: 9,
  buoyancy: 40,
  leapVel: 520,
  leapArm: 1.2,
  dashSpeed: 560,
  dashTime: 0.16,
  dashCooldown: 0.42,
  glowRadius: 170,
  ambientRadius: 58,
  // Light-blade.
  slashTime: 0.12,
  slashCooldown: 0.27,
  slashReach: 48,
  slashHeight: 44,
  slashDamage: 10,
  pogoVel: 480,
  chargeTime: 0.55,
  chargeDamage: 34,
  chargeCost: 18,
  chargeReach: 78,
  // Lumen Pulse.
  pulseRadius: 150,
  pulseCost: 30,
  pulseCooldown: 1.1,
  pulseStun: 1.4,
  pulseSafe: 0.55,
  pulseDamage: 5,
  pulseReveal: 2.6,
  // Health and healing.
  healTime: 0.8,
  essencePerHit: 0.25,
  invuln: 1.2,
  knockX: 250,
  knockY: 300,
  hitstop: 0.05,
  lumenRegen: 7,
  glowDrain: 5,
} as const;

export interface DifficultyTuning {
  /** Extra health masks. */
  hpBonus: number;
  /** Multiplies enemy health. */
  enemyHp: number;
  /** Multiplies guardian health. Intense bosses hit harder and faster rather than lasting longer. */
  bossHp: number;
  /** Multiplies enemy speed and shortens their rests. */
  enemySpeed: number;
  /** Multiplies telegraph durations: Gentle gives more warning. */
  telegraph: number;
  tideRate: number;
  /** Health restored per heal. */
  healAmount: number;
  /** Multiplies time limits and slows chases. */
  mercy: number;
}

export const DIFF: Record<Difficulty, DifficultyTuning> = {
  gentle: { hpBonus: 2, enemyHp: 0.7, bossHp: 0.7, enemySpeed: 0.82, telegraph: 1.45, tideRate: 0.75, healAmount: 2, mercy: 1.3 },
  standard: { hpBonus: 0, enemyHp: 0.88, bossHp: 0.88, enemySpeed: 0.94, telegraph: 1.15, tideRate: 1, healAmount: 1, mercy: 1 },
  intense: { hpBonus: 0, enemyHp: 1.05, bossHp: 0.95, enemySpeed: 1.02, telegraph: 0.96, tideRate: 1.25, healAmount: 1, mercy: 0.85 },
};

export const BASE_HP = 6;
export const BASE_LUMEN = 100;
export const BASE_ESSENCE = 3;

export const ALL_ABILITIES: AbilityId[] = ['dash', 'wall', 'double', 'pulse', 'dive', 'airdash', 'charge', 'glide'];
export const ALL_REWARDS: RewardId[] = ['tidebreaker', 'veil', 'vinehook', 'echo', 'stormstep', 'shield', 'ember', 'bloom', 'void', 'crown'];

/** Boss rewards: every one has a cost and a cooldown, so none replaces skill. */
export const REWARDS: Record<RewardId, { name: string; line: string; cost: number; cooldown: number }> = {
  tidebreaker: { name: 'Tidebreaker', line: 'Slam down. A shockwave stuns and breaks cracked stone.', cost: 20, cooldown: 4 },
  veil: { name: 'Eclipse Veil', line: 'Dim your light. Harder to see — and to be seen.', cost: 15, cooldown: 9 },
  vinehook: { name: 'Vinehook', line: 'Hook the nearest wall or foe and pull yourself to it.', cost: 10, cooldown: 1.6 },
  echo: { name: 'Echo Wave', line: 'A line of sound that wounds and shows hidden ways.', cost: 28, cooldown: 2.2 },
  stormstep: { name: 'Storm Step', line: 'Blink a short way through harm.', cost: 22, cooldown: 3.2 },
  shield: { name: 'Coral Shield', line: 'A shell that takes one blow, then breaks.', cost: 35, cooldown: 11 },
  ember: { name: 'Ember Fang', line: 'Your next strikes burn.', cost: 30, cooldown: 8 },
  bloom: { name: 'Bloom Burst', line: 'Spores that mend you — slowly.', cost: 45, cooldown: 16 },
  void: { name: 'Void Current', line: 'Drag nearby foes toward you.', cost: 25, cooldown: 6 },
  crown: { name: 'Tide Crown', line: 'For a few breaths, everything quickens.', cost: 50, cooldown: 20 },
};

/**
 * Swords. `dmg` multiplies every strike, `reach` the blade's range, `speed` the time between
 * swings (lower is faster). The art is what a charged strike becomes with this sword.
 */
export const SWORDS: Record<SwordId, { name: string; line: string; art: string; artLine: string; dmg: number; reach: number; speed: number; plasma: number; diamonds: number; area: number }> = {
  tide: { name: 'Tide Blade', line: 'The blade you woke with. Honest and quick.', art: 'Tide Wave', artLine: 'A charged strike sends a wave along the ground.', dmg: 1, reach: 1, speed: 1, plasma: 0, diamonds: 0, area: 1 },
  ember: { name: 'Ember Fang', line: 'Forged hot. Every cut keeps burning.', art: 'Flame Arc', artLine: 'A charged strike sets everything it touches alight.', dmg: 1.15, reach: 1, speed: 1, plasma: 300, diamonds: 2, area: 2 },
  storm: { name: 'Stormcaller', line: 'Long and light. It hums before rain.', art: 'Chain Bolt', artLine: 'A charged strike calls lightning onto the nearest foes.', dmg: 1.05, reach: 1.15, speed: 0.82, plasma: 600, diamonds: 3, area: 4 },
  coral: { name: 'Reefbreaker', line: 'Heavy coral. Slow, and it breaks things.', art: 'Thorn Spin', artLine: 'A charged strike spins, cutting all around you.', dmg: 1.35, reach: 0.95, speed: 1.12, plasma: 900, diamonds: 4, area: 5 },
  void: { name: 'Hollow Edge', line: 'It cuts the dark itself.', art: 'Rift', artLine: 'A charged strike drags foes in, then cuts them all.', dmg: 1.45, reach: 1.1, speed: 1, plasma: 1400, diamonds: 6, area: 7 },
  crown: { name: 'Moonbrand', line: 'Made from what he stole. It wants to go home.', art: 'Radiance', artLine: 'A charged strike throws three crescents of moonlight.', dmg: 1.7, reach: 1.2, speed: 0.9, plasma: 2500, diamonds: 10, area: 9 },
};
export const ALL_SWORDS = Object.keys(SWORDS) as SwordId[];

/** Techniques learned at the Forge. */
export const STYLES: Record<StyleId, { name: string; line: string; plasma: number; diamonds: number; area: number }> = {
  combo: { name: 'Third Cut', line: 'The third quick strike in a row lands half again as hard, and wider.', plasma: 150, diamonds: 0, area: 1 },
  rising: { name: 'Rising Cut', line: 'An upward strike on the ground lifts you with it and hits harder.', plasma: 280, diamonds: 0, area: 2 },
  dashcut: { name: 'Dash Strike', line: 'Strike out of a dash: a piercing cut at speed, half again as hard.', plasma: 450, diamonds: 1, area: 3 },
  plunge: { name: 'Plunge', line: 'A downward strike hits twice as hard and bursts on landing.', plasma: 650, diamonds: 2, area: 5 },
};
export const ALL_STYLES = Object.keys(STYLES) as StyleId[];

export const RELICS: Record<RelicId, { name: string; line: string }> = {
  thunder: { name: 'Thunder Seal', line: 'Lightning strikes every foe in sight.' },
  frost: { name: 'Frost Seal', line: 'Every foe in sight freezes for a while.' },
  draught: { name: 'Tide Draught', line: 'Restores all your health at once.' },
  nova: { name: 'Nova Shard', line: 'A blast of light all around you.' },
};
export const ALL_RELICS = Object.keys(RELICS) as RelicId[];

/** Forge upgrades: plasma cost of each level (diamonds from the level noted). */
export const FORGE = {
  blade: { name: 'Blade', line: 'Every strike hits harder.', max: 8, plasma: [60, 120, 200, 320, 480, 700, 950, 1250], diamonds: [0, 0, 0, 0, 1, 1, 2, 2], step: 0.12 },
  armor: { name: 'Armour', line: 'One more mask of health.', max: 4, plasma: [100, 260, 520, 900], diamonds: [0, 1, 2, 3] },
  core: { name: 'Lumen Core', line: 'More Lumen for glow, Pulse, arts and gifts.', max: 4, plasma: [80, 180, 340, 560], diamonds: [0, 0, 1, 2], step: 20 },
  flask: { name: 'Essence Flask', line: 'One more vial of Tide Essence for healing.', max: 3, plasma: [150, 400, 800], diamonds: [0, 1, 2] },
} as const;
export type ForgeId = keyof typeof FORGE;

/** Plasma and diamonds. Drops scale with the area so prices keep pace with the journey. */
export const LOOT = {
  enemy: 3,
  enemyPerTier: 1.5,
  eliteMul: 3,
  miniboss: 60,
  minibossPerArea: 20,
  boss: 150,
  bossPerArea: 50,
  bossDiamonds: 2,
  minibossDiamonds: 1,
};

/** Fails at one checkpoint before the game quietly helps. */
export const ASSIST_AFTER_FAILS = 3;
export const SAVE_KEY = 'tidewalker.save.v2';
export const AREA_COUNT = 10;
export const LEVELS_PER_AREA = 10;
