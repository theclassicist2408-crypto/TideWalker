import { describe, expect, it } from 'vitest';
import { AudioDirector, SILENT_MIX, targetMix, type AudioInputs } from '../src/game/audio/director';

const base: AudioInputs = { mode: 'story', biome: 'shallows', danger: 0, tide: 0.3, lumen: 1, glow: 0, submerged: false, rain: 0, wind: 0.2, paused: false, menu: false, boss: false };
const mix = (patch: Partial<AudioInputs>) => targetMix({ ...base, ...patch }, 0, { ...SILENT_MIX });

describe('audio director', () => {
  it('a guardian brings in its theme at full strength', () => {
    expect(mix({ boss: true }).danger).toBe(1);
    expect(mix({}).danger).toBe(0);
  });

  it('danger thins the melody instead of making it louder', () => {
    expect(mix({ danger: 0.9 }).explore).toBeLessThan(mix({}).explore);
  });

  it('under water the world is muffled; paused it is quieter still', () => {
    expect(mix({ submerged: true }).cutoff).toBeLessThan(2000);
    expect(mix({ paused: true }).cutoff).toBeLessThan(mix({ submerged: true }).cutoff);
  });

  it('menus and Drift Mode carry no danger', () => {
    expect(mix({ menu: true, danger: 1, boss: true }).danger).toBe(0);
    expect(mix({ mode: 'drift', danger: 1 }).danger).toBe(0);
    expect(mix({ mode: 'drift' }).sanctuary).toBeGreaterThan(0);
  });

  it('escaping real danger brings a swell of relief that fades', () => {
    const d = new AudioDirector();
    for (let i = 0; i < 120; i++) d.update({ ...base, danger: 0.9 }, 1 / 60);
    for (let i = 0; i < 60; i++) d.update({ ...base, danger: 0 }, 1 / 60);
    expect(d.mix.relief).toBeGreaterThan(0.3);
    for (let i = 0; i < 60 * 10; i++) d.update({ ...base, danger: 0 }, 1 / 60);
    expect(d.mix.relief).toBeLessThan(0.1);
  });
});
