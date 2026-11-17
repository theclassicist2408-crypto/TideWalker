import { ALL_ABILITIES, ALL_REWARDS, BASE_ESSENCE, BASE_HP, BASE_LUMEN } from '../core/constants';
import type { AbilityId, Loadout, RewardId } from '../core/types';

/** Where each lost ability is found again: the level whose shrine or guardian returns it. */
export const ABILITY_SCHEDULE: { ability: AbilityId; area: number; level: number }[] = [
  { ability: 'dash', area: 1, level: 2 },
  { ability: 'wall', area: 1, level: 5 },
  { ability: 'double', area: 2, level: 2 },
  { ability: 'pulse', area: 2, level: 6 },
  { ability: 'dive', area: 3, level: 1 },
  { ability: 'airdash', area: 3, level: 5 },
  { ability: 'charge', area: 4, level: 2 },
  { ability: 'glide', area: 4, level: 6 },
];

/** The boss gift of each area, in order. */
export const AREA_REWARD: RewardId[] = ALL_REWARDS;

/** Abilities a player is guaranteed to hold on entering a level. Levels may only require these. */
export function abilitiesAt(area: number, level: number): Set<AbilityId> {
  const out = new Set<AbilityId>();
  for (const s of ABILITY_SCHEDULE) if (area > s.area || (area === s.area && level > s.level)) out.add(s.ability);
  return out;
}

/** The weakest loadout a player can have at a level: scheduled abilities, earlier boss gifts, no upgrades. */
export function minimumLoadout(area: number, level: number): Loadout {
  const rewards = new Set<RewardId>(AREA_REWARD.slice(0, Math.max(0, area - 1)));
  return {
    abilities: abilitiesAt(area, level),
    rewards,
    equipped: area > 1 ? AREA_REWARD[area - 2] : null,
    hpMax: BASE_HP,
    lumenMax: BASE_LUMEN,
    essenceMax: BASE_ESSENCE,
    pulseLevel: 0,
  };
}

/** Everything, as the Tideborn was before the fall (the tutorial). */
export function fullLoadout(): Loadout {
  return { abilities: new Set(ALL_ABILITIES), rewards: new Set(), equipped: null, hpMax: BASE_HP, lumenMax: BASE_LUMEN, essenceMax: BASE_ESSENCE, pulseLevel: 0 };
}

/** What a level's author may rely on; shrines inside the level add to it as they are placed. */
export class Stage {
  private readonly set: Set<AbilityId>;
  constructor(
    readonly area: number,
    readonly level: number,
    all = false,
  ) {
    this.set = all ? new Set(ALL_ABILITIES) : abilitiesAt(area, level);
  }
  has(a: AbilityId): boolean {
    return this.set.has(a);
  }
  add(a: AbilityId): void {
    this.set.add(a);
  }
}
