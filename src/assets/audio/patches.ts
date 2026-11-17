import type { BiomeId } from '../../game/core/types';

/**
 * Score for the generative soundtrack. All music is synthesised at runtime from this data —
 * there are no audio files, so nothing can be missing and nothing is copyrighted.
 */

export interface BiomeScore {
  /** Root note frequency in Hz. */
  root: number;
  /** Scale as semitone offsets from the root. */
  scale: number[];
  /** Chord progression: each chord is a list of scale degrees (may exceed the octave). */
  chords: number[][];
  /** Seconds each chord sustains. */
  chordTime: number;
  /** Average seconds between bell notes. */
  bellGap: number;
}

const MINOR_PENT = [0, 3, 5, 7, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];

const score = (root: number, scale: number[], chords: number[][], chordTime: number, bellGap: number): BiomeScore => ({ root, scale, chords, chordTime, bellGap });
const DARK = [[0, 4, 9], [5, 9, 11], [3, 7, 9], [4, 8, 11]];
const OPEN = [[0, 4, 8], [3, 7, 9], [0, 4, 9], [6, 8, 11]];
const PENT = [[0, 2, 5], [1, 3, 6], [0, 3, 7], [2, 4, 6]];

export const SCORES: Record<BiomeId, BiomeScore> = {
  shallows: score(73.42, AEOLIAN, DARK, 8, 4.6),
  pools: score(82.41, DORIAN, OPEN, 8, 3.4),
  kelp: score(65.41, MINOR_PENT, PENT, 9, 4.2),
  ruins: score(69.3, AEOLIAN, [[0, 2, 9], [5, 7, 11], [3, 5, 9], [6, 8, 11]], 9, 4.6),
  storm: score(61.74, AEOLIAN, DARK, 7, 4),
  coral: score(77.78, DORIAN, OPEN, 8, 3),
  forge: score(58.27, MINOR_PENT, PENT, 7, 3.6),
  gardens: score(69.3, DORIAN, [[0, 4, 8], [2, 6, 9], [3, 7, 11], [0, 5, 9]], 8, 3.2),
  deep: score(55, AEOLIAN, [[0, 2, 9], [5, 7, 11], [1, 5, 9], [6, 8, 11]], 11, 6),
  throne: score(87.31, LYDIAN, [[0, 4, 8], [3, 7, 9], [4, 8, 11], [0, 5, 9]], 7, 2.4),
};

/** Frequency of a scale degree above a root. Degrees beyond the scale wrap up an octave. */
export function degreeHz(root: number, scale: number[], degree: number): number {
  const n = scale.length;
  const octave = Math.floor(degree / n);
  const semi = scale[((degree % n) + n) % n] + octave * 12;
  return root * Math.pow(2, semi / 12);
}
