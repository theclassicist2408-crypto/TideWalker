import { describe, expect, it } from 'vitest';
import { degreeHz, SCORES } from '../src/assets/audio/patches';
import { AudioDirector, SILENT_MIX, targetMix, type AudioInputs } from '../src/game/audio/director';
import { AudioEngine } from '../src/game/audio/engine';
import { HAPTIC_PATTERNS, Haptics } from '../src/game/effects/haptics';

const base: AudioInputs = { mode: 'story', biome: 'storm', danger: 0, tide: 0, lumen: 1, glow: 0, submerged: false, rain: 0.5, wind: 0.5, paused: false, menu: false };

describe('audio state', () => {
  it('is calm exploration at low tide with no danger', () => {
    const m = targetMix(base, 0, { ...SILENT_MIX });
    expect(m.explore).toBe(1);
    expect(m.tension).toBe(0);
    expect(m.danger).toBe(0);
    expect(m.sanctuary).toBe(0);
    expect(m.cutoff).toBe(18000);
  });

  it('builds tension as the tide rises and light runs low', () => {
    const high = targetMix({ ...base, tide: 1 }, 0, { ...SILENT_MIX });
    expect(high.tension).toBeGreaterThan(0.6);
    const dim = targetMix({ ...base, lumen: 0.05 }, 0, { ...SILENT_MIX });
    expect(dim.tension).toBeGreaterThan(0.25);
  });

  it('gets quieter and more tense as danger rises, never louder', () => {
    const safe = targetMix(base, 0, { ...SILENT_MIX });
    const near = targetMix({ ...base, danger: 0.9 }, 0, { ...SILENT_MIX });
    expect(near.danger).toBeGreaterThan(0.9);
    expect(near.explore).toBeLessThan(safe.explore * 0.5);
    expect(near.explore).toBeGreaterThan(0);
  });

  it('muffles the world under water and when paused', () => {
    expect(targetMix({ ...base, submerged: true }, 0, { ...SILENT_MIX }).cutoff).toBeLessThan(1200);
    expect(targetMix({ ...base, submerged: true }, 0, { ...SILENT_MIX }).deep).toBeGreaterThan(0.5);
    expect(targetMix({ ...base, paused: true }, 0, { ...SILENT_MIX }).cutoff).toBeLessThan(700);
  });

  it('uses the sanctuary layer at home and in Drift, with no danger there', () => {
    const home = targetMix({ ...base, biome: 'sanctuary' }, 0, { ...SILENT_MIX });
    expect(home.sanctuary).toBeGreaterThan(0.9);
    const drift = targetMix({ ...base, mode: 'drift', danger: 1, tide: 1 }, 0, { ...SILENT_MIX });
    expect(drift.sanctuary).toBe(1);
    expect(drift.danger).toBe(0);
    expect(drift.tension).toBe(0);
  });

  it('smooths changes over time instead of jumping', () => {
    const d = new AudioDirector();
    d.update({ ...base, danger: 1 }, 0.016);
    expect(d.mix.danger).toBeLessThan(0.1);
    for (let i = 0; i < 200; i++) d.update({ ...base, danger: 1 }, 0.016);
    expect(d.mix.danger).toBeCloseTo(1, 1);
  });

  it('swells with relief after an escape and when triggered, then fades', () => {
    const d = new AudioDirector();
    for (let i = 0; i < 120; i++) d.update({ ...base, danger: 0.9 }, 0.016);
    for (let i = 0; i < 60; i++) d.update({ ...base, danger: 0.05 }, 0.016);
    expect(d.mix.relief).toBeGreaterThan(0.3);
    for (let i = 0; i < 700; i++) d.update(base, 0.016);
    expect(d.mix.relief).toBe(0);
    d.triggerRelief(1);
    d.update(base, 0.5);
    expect(d.mix.relief).toBeGreaterThan(0.4);
  });

  it('keeps weather beds in range for every input', () => {
    for (const rain of [0, 1]) {
      for (const submerged of [false, true]) {
        for (const menu of [false, true]) {
          const m = targetMix({ ...base, rain, wind: 1, submerged, menu, tide: 1, danger: 1 }, 1, { ...SILENT_MIX });
          for (const v of [m.explore, m.tension, m.danger, m.relief, m.sanctuary, m.wind, m.rain, m.waves, m.deep, m.glowHum]) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });
});

describe('audio engine and haptics without a device', () => {
  it('is silent and safe before the first gesture unlocks it', () => {
    const engine = new AudioEngine();
    expect(engine.state).toBe('locked');
    expect(() => {
      engine.update({ ...SILENT_MIX });
      engine.play('pulse');
      engine.relief();
      engine.thunder();
      engine.ui('tap');
      engine.setVolumes(0.5, 0.5, 0.5);
      engine.setBiome('ruins');
      engine.suspend();
      engine.resume();
    }).not.toThrow();
    expect(engine.mix).not.toBeNull();
  });

  it('has a score for every biome and maps scale degrees to rising pitches', () => {
    for (const score of Object.values(SCORES)) {
      expect(score.chords.length).toBeGreaterThan(2);
      expect(degreeHz(score.root, score.scale, score.scale.length)).toBeCloseTo(score.root * 2, 5);
      expect(degreeHz(score.root, score.scale, 3)).toBeGreaterThan(degreeHz(score.root, score.scale, 2));
    }
  });

  it('haptics respect the toggle and never throw where vibration is missing', () => {
    const h = new Haptics();
    expect(() => h.play('pulse')).not.toThrow();
    h.enabled = false;
    expect(() => h.danger(1, 10)).not.toThrow();
    expect(HAPTIC_PATTERNS.pulse.length).toBeGreaterThan(HAPTIC_PATTERNS.glow.length);
    expect(HAPTIC_PATTERNS.danger).not.toEqual(HAPTIC_PATTERNS.land);
  });
});
