import type { BiomeId, GameMode } from '../core/types';
import { approach, clamp } from '../core/util';

/** What the game tells the audio system each frame. */
export interface AudioInputs {
  mode: GameMode;
  biome: BiomeId;
  /** 0..1 proximity/awareness of the nearest shadow-fish. */
  danger: number;
  /** 0 low tide … 1 high tide. */
  tide: number;
  lumen: number;
  glow: number;
  /** True while the creature is under water. */
  submerged: boolean;
  rain: number;
  wind: number;
  paused: boolean;
  /** True on menus (title, chapter select …). */
  menu: boolean;
}

/** Target loudness of every adaptive layer, 0..1. */
export interface AudioMix {
  explore: number;
  tension: number;
  danger: number;
  relief: number;
  sanctuary: number;
  glowHum: number;
  wind: number;
  rain: number;
  waves: number;
  deep: number;
  /** Low-pass cutoff in Hz for the whole world (muffled under water and when paused). */
  cutoff: number;
}

export const SILENT_MIX: AudioMix = { explore: 0, tension: 0, danger: 0, relief: 0, sanctuary: 0, glowHum: 0, wind: 0, rain: 0, waves: 0, deep: 0, cutoff: 18000 };

/** Pure mapping from game state to layer targets. No smoothing, no Web Audio. */
export function targetMix(i: AudioInputs, relief: number, out: AudioMix): AudioMix {
  const sanctuary = i.biome === 'sanctuary' || i.mode === 'drift';
  const calmMode = i.mode === 'drift' || i.mode === 'title' || i.menu;
  const danger = calmMode ? 0 : clamp((i.danger - 0.3) / 0.55, 0, 1);
  const lowLight = i.lumen < 0.3 ? (0.3 - i.lumen) / 0.3 : 0;
  const tension = calmMode ? 0 : clamp(i.tide * 0.65 + lowLight * 0.35 + i.danger * 0.25, 0, 1);

  // As danger rises the melody thins out: quieter and more tense, never louder.
  const melodic = clamp(1 - tension * 0.5 - danger * 0.65, 0.12, 1);
  out.sanctuary = sanctuary ? melodic : 0;
  out.explore = sanctuary ? melodic * 0.7 : melodic;
  out.tension = sanctuary ? tension * 0.3 : tension;
  out.danger = danger;
  out.relief = relief;
  out.glowHum = clamp(i.glow, 0, 1);
  out.wind = i.submerged ? 0.05 : clamp(0.15 + i.wind * 0.6, 0, 1);
  out.rain = i.submerged ? i.rain * 0.12 : i.rain;
  out.waves = i.submerged ? 0.1 : clamp(0.35 + i.tide * 0.4, 0, 1);
  out.deep = i.submerged ? 0.8 : 0;
  out.cutoff = i.paused ? 500 : i.submerged ? 900 : 18000;
  if (i.menu) {
    out.wind *= 0.5;
    out.rain *= 0.4;
  }
  return out;
}

/**
 * Smooths the mix over time and holds the short "relief" swell that follows an escape,
 * a checkpoint or a Memory Shell. Testable without an AudioContext.
 */
export class AudioDirector {
  readonly mix: AudioMix = { ...SILENT_MIX };
  private readonly target: AudioMix = { ...SILENT_MIX };
  private relief = 0;
  private lastDanger = 0;
  private peak = 0;

  /** Call for moments that deserve a breath of relief. */
  triggerRelief(amount = 1): void {
    this.relief = Math.max(this.relief, clamp(amount, 0, 1));
  }

  update(inputs: AudioInputs, dt: number): AudioMix {
    // Escaping real danger is itself a relief.
    this.peak = Math.max(this.peak * (1 - dt * 0.2), inputs.danger);
    if (this.lastDanger > 0.6 && inputs.danger < 0.25 && this.peak > 0.6) {
      this.triggerRelief(0.8);
      this.peak = 0;
    }
    if (inputs.danger >= 0.6 || this.lastDanger < inputs.danger) this.lastDanger = inputs.danger;
    else this.lastDanger = Math.max(inputs.danger, this.lastDanger - dt * 0.25);

    this.relief = Math.max(0, this.relief - dt / 7);
    targetMix(inputs, this.relief, this.target);
    const m = this.mix;
    const t = this.target;
    const slow = dt * 0.45;
    m.explore = approach(m.explore, t.explore, slow);
    m.sanctuary = approach(m.sanctuary, t.sanctuary, slow);
    m.tension = approach(m.tension, t.tension, slow);
    m.danger = approach(m.danger, t.danger, dt * (t.danger > m.danger ? 1.4 : 0.5));
    m.relief = approach(m.relief, t.relief, dt * 1.2);
    m.glowHum = approach(m.glowHum, t.glowHum, dt * 5);
    m.wind = approach(m.wind, t.wind, dt * 0.8);
    m.rain = approach(m.rain, t.rain, dt * 0.8);
    m.waves = approach(m.waves, t.waves, dt * 0.8);
    m.deep = approach(m.deep, t.deep, dt * 2);
    m.cutoff += (t.cutoff - m.cutoff) * Math.min(1, dt * 5);
    return m;
  }
}
