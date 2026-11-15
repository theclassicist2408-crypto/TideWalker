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

export const SCORES: Record<BiomeId, BiomeScore> = {
  storm: {
    root: 73.42,
    scale: AEOLIAN,
    chords: [
      [0, 4, 9],
      [5, 9, 11],
      [3, 7, 9],
      [4, 8, 11],
    ],
    chordTime: 9,
    bellGap: 5.5,
  },
  pools: {
    root: 82.41,
    scale: DORIAN,
    chords: [
      [0, 4, 8],
      [3, 7, 9],
      [0, 4, 9],
      [6, 8, 11],
    ],
    chordTime: 8,
    bellGap: 3.4,
  },
  kelp: {
    root: 65.41,
    scale: MINOR_PENT,
    chords: [
      [0, 2, 5],
      [1, 3, 6],
      [0, 3, 7],
      [2, 4, 6],
    ],
    chordTime: 10,
    bellGap: 4.6,
  },
  ruins: {
    root: 69.3,
    scale: AEOLIAN,
    chords: [
      [0, 2, 9],
      [5, 7, 11],
      [3, 5, 9],
      [6, 8, 11],
    ],
    chordTime: 10,
    bellGap: 5,
  },
  sanctuary: {
    root: 87.31,
    scale: LYDIAN,
    chords: [
      [0, 4, 8],
      [3, 7, 9],
      [4, 8, 11],
      [0, 5, 9],
    ],
    chordTime: 8,
    bellGap: 2.4,
  },
};

/** Frequency of a scale degree above a root. Degrees beyond the scale wrap up an octave. */
export function degreeHz(root: number, scale: number[], degree: number): number {
  const n = scale.length;
  const octave = Math.floor(degree / n);
  const semi = scale[((degree % n) + n) % n] + octave * 12;
  return root * Math.pow(2, semi / 12);
}
