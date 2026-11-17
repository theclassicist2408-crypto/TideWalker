import type { AbilityId, UpgradeId } from './types';

/** Display names and one-line descriptions for what the Tideborn regains and gains. */
export const ABILITY_NAMES: Record<AbilityId, [string, string]> = {
  dash: ['Dash', 'A burst of speed. Leap out of it to cross wide gaps.'],
  wall: ['Wall Cling', 'Hold to a wall, then kick off it. Climb anything.'],
  double: ['Double Jump', 'A second leap in mid-air.'],
  pulse: ['Lumen Pulse', 'Stuns what is near, clears shots, and keeps you safe for a breath.'],
  dive: ['Dive', 'Go under. The deep water is open to you.'],
  airdash: ['Air Dash', 'Dash without the ground.'],
  charge: ['Lumen Strike', 'Hold the blade, then release: a heavy blow that breaks cracked stone.'],
  glide: ['Glide', 'Hold the jump while falling to drift a long way.'],
};

export const UPGRADE_NAMES: Record<UpgradeId, [string, string]> = {
  health: ['Thicker Shell', 'One more life before the dark.'],
  lumen: ['Deeper Light', 'A larger store of Lumen.'],
  essence: ['Tide Vial', 'Carry one more measure of Tide Essence.'],
  pulse: ['Wider Pulse', 'Your Lumen Pulse reaches farther and hits harder.'],
};
