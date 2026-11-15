import { describe, expect, it } from 'vitest';
import { VIGNETTE_COUNT, shellForVignette, vignetteForShell } from '../src/assets/data/vignettes';
import { TOTAL_CHAPTERS } from '../src/game/core/constants';
import { validateLevel } from '../src/game/levels/builder';
import { DAILY_LAYOUTS, getDailyLayout } from '../src/game/levels/daily';
import { DRIFT_LENGTH, makeDriftLevel, titleLevel } from '../src/game/levels/drift';
import { allChapters, CHAPTER_COUNT, getChapter } from '../src/game/levels';
import { applyCondition, DAILY_CONDITIONS, dailyFor, dateKey } from '../src/game/systems/daily';
import { makeWorld } from './helpers';

const chapters = allChapters();

describe('level loading', () => {
  it('has ten valid chapters in order', () => {
    expect(CHAPTER_COUNT).toBe(TOTAL_CHAPTERS);
    chapters.forEach((l, i) => {
      expect(l.index).toBe(i + 1);
      expect(l.name.length).toBeGreaterThan(2);
      expect(l.line.length).toBeGreaterThan(8);
      expect(() => validateLevel(l)).not.toThrow();
      expect(getChapter(i + 1)).toBe(l);
    });
    expect(() => getChapter(0)).toThrow();
    expect(() => getChapter(11)).toThrow();
  });

  it('covers at least four biomes plus the sanctuary', () => {
    const biomes = new Set(chapters.map((l) => l.biome));
    expect(biomes.size).toBe(5);
    expect(chapters[9].biome).toBe('sanctuary');
  });

  it('introduces one new mechanic per chapter', () => {
    expect(new Set(chapters.map((l) => l.teaches)).size).toBe(10);
  });

  it('holds exactly twenty uniquely named Memory Shells, each with a vignette', () => {
    const ids = chapters.flatMap((l) => l.shells.map((s) => s.id));
    expect(ids.length).toBe(20);
    expect(new Set(ids).size).toBe(20);
    expect(VIGNETTE_COUNT).toBe(20);
    const seen = new Set<number>();
    for (const id of ids) {
      const v = vignetteForShell(id);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(shellForVignette(v)).toBe(id);
      seen.add(v);
    }
    expect(seen.size).toBe(20);
    expect(vignetteForShell('daily-1')).toBe(-1);
    for (const l of chapters) expect(l.shells.some((s) => s.hidden)).toBe(true);
  });

  it('uses all three shadow-fish and at least six kinds of hazard or puzzle', () => {
    const kinds = new Set(chapters.flatMap((l) => l.fish.map((f) => f.kind)));
    expect([...kinds].sort()).toEqual(['angler', 'drifter', 'hush']);
    const has = {
      moonglass: chapters.some((l) => l.platforms.some((p) => p.kind === 'moonglass')),
      crumble: chapters.some((l) => l.platforms.some((p) => p.kind === 'crumble')),
      currents: chapters.some((l) => l.currents.some((c) => !c.safe)),
      whirlpool: chapters.some((l) => l.currents.some((c) => c.radial)),
      urchins: chapters.some((l) => l.urchins.length > 0),
      geysers: chapters.some((l) => l.geysers.length > 0),
      bloomGates: chapters.some((l) => l.gates.some((g) => g.kind === 'bloom')),
      tideGates: chapters.some((l) => l.gates.some((g) => g.kind === 'tide')),
      stones: chapters.some((l) => l.stones.length > 0),
    };
    expect(Object.values(has).filter(Boolean).length).toBeGreaterThanOrEqual(6);
    expect(has).toEqual({ moonglass: true, crumble: true, currents: true, whirlpool: true, urchins: true, geysers: true, bloomGates: true, tideGates: true, stones: true });
  });

  it('keeps the first chapter free of anything that hunts', () => {
    expect(chapters[0].fish.length).toBe(0);
    expect(chapters[0].hints.map((h) => h.kind)).toEqual(expect.arrayContaining(['move', 'jump', 'glow']));
  });

  it('places lanterns so a failure never costs more than about 25 seconds', () => {
    for (const l of chapters) {
      const w = makeWorld(l);
      const marks = [l.spawn.x, ...w.checkpoints.map((c) => c.x), l.goalX];
      for (let i = 1; i < marks.length; i++) {
        // 2700 px is ~25 s at an unhurried 105 px/s.
        expect(marks[i] - marks[i - 1], `${l.id} gap ${i}`).toBeLessThanOrEqual(2700);
      }
      expect(w.checkpoints.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('never asks for a leap beyond the creature', () => {
    for (const l of chapters) {
      // Required ledges: every vertical step up in the ground is climbable directly or has rocks beside it.
      for (let i = 1; i < l.groundX.length; i++) {
        if (l.groundX[i] !== l.groundX[i - 1]) continue;
        const rise = l.groundY[i - 1] - l.groundY[i];
        if (rise <= 60) continue;
        const x = l.groundX[i];
        const top = l.groundY[i];
        const help = l.platforms.some((p) => p.x + p.w >= x - 80 && p.x <= x + 4 && p.y > top && p.y - top <= 62) || l.geysers.some((g) => Math.abs(g.x - x) < 60);
        expect(help, `${l.id} wall of ${rise}px at x=${x}`).toBe(true);
      }
    }
  });

  it('rises: every chapter ends with the sea higher than it began', () => {
    for (const l of chapters.slice(1)) {
      const first = l.tide.keys[0][1];
      const last = l.tide.keys[l.tide.keys.length - 1][1];
      expect(last, l.id).toBeLessThan(first);
    }
  });
});

describe('Daily Tide', () => {
  it('picks the same shore and night for everyone on a given date', () => {
    const a = dailyFor(new Date(2026, 10, 16), DAILY_LAYOUTS);
    const b = dailyFor(new Date(2026, 10, 16, 23, 59), DAILY_LAYOUTS);
    expect(a).toEqual(b);
    expect(a.key).toBe('2026-11-16');
    expect(dateKey(new Date(2027, 0, 5))).toBe('2027-01-05');
  });

  it('varies across a month and uses every condition and layout', () => {
    const conditions = new Set<string>();
    const layouts = new Set<number>();
    for (let d = 1; d <= 60; d++) {
      const p = dailyFor(new Date(2026, 0, d), DAILY_LAYOUTS);
      conditions.add(p.condition.id);
      layouts.add(p.layout);
    }
    expect(conditions.size).toBe(DAILY_CONDITIONS.length);
    expect(layouts.size).toBe(DAILY_LAYOUTS);
  });

  it('applies a condition without mutating the handcrafted layout', () => {
    const base = getDailyLayout(0);
    const snapshot = JSON.stringify(base.tide);
    for (const c of DAILY_CONDITIONS) {
      const l = applyCondition(base, c);
      expect(() => validateLevel(l)).not.toThrow();
      expect(l.name).toBe(c.name);
      if (c.reverseTide) expect(l.tide.keys[0][1]).toBeLessThan(l.tide.keys[l.tide.keys.length - 1][1]);
      if (c.swellScale === 0) expect(l.tide.amp).toBe(0);
    }
    expect(JSON.stringify(base.tide)).toBe(snapshot);
    expect(getDailyLayout(DAILY_LAYOUTS)).toBe(base);
  });
});

describe('Drift Mode', () => {
  it('generates long, valid, harmless shores from any seed', () => {
    for (const seed of [1, 2, 3, 77, 4242, 99999]) {
      const l = makeDriftLevel(seed);
      expect(() => validateLevel(l)).not.toThrow();
      expect(l.goalX).toBeGreaterThan(DRIFT_LENGTH);
      expect(l.fish.length).toBe(0);
      expect(l.urchins.length).toBe(0);
      expect(l.stones.length).toBe(0);
      expect(l.currents.length).toBe(0);
      const ys = l.groundY;
      expect(Math.min(...ys)).toBeGreaterThan(-400);
    }
  });

  it('is deterministic per seed and different between seeds', () => {
    expect(makeDriftLevel(5).groundY).toEqual(makeDriftLevel(5).groundY);
    expect(makeDriftLevel(5).groundY).not.toEqual(makeDriftLevel(6).groundY);
  });

  it('has a valid title scene', () => {
    expect(() => validateLevel(titleLevel())).not.toThrow();
  });
});
