import { describe, expect, it } from 'vitest';
import { SAVE_KEY } from '../src/game/core/constants';
import { DEFAULT_SETTINGS, defaultSave, sanitize, SaveStore } from '../src/game/save/save';
import { MemoryStorage } from './helpers';

describe('save system', () => {
  it('starts fresh when nothing is stored', () => {
    const store = new SaveStore(new MemoryStorage());
    expect(store.data).toEqual(defaultSave());
    expect(store.recovered).toBe(false);
  });

  it('round-trips progress through storage', () => {
    const mem = new MemoryStorage();
    const a = new SaveStore(mem);
    a.addShell('ch01-1');
    a.setCheckpoint(2, 1);
    a.updateSettings({ difficulty: 'gentle', handed: 'left', textScale: 1.2 });
    a.markTutorial('glow');
    a.recordDrift(321.6);
    const b = new SaveStore(mem);
    expect(b.data.shells).toEqual(['ch01-1']);
    expect(b.data.checkpoint).toEqual({ chapter: 2, index: 1 });
    expect(b.data.settings.difficulty).toBe('gentle');
    expect(b.data.settings.handed).toBe('left');
    expect(b.data.settings.textScale).toBe(1.2);
    expect(b.data.tutorial.glow).toBe(true);
    expect(b.data.driftBest).toBe(322);
  });

  it('recovers from corrupted JSON without throwing', () => {
    const mem = new MemoryStorage();
    mem.setItem(SAVE_KEY, '{"version":1,"shells":[');
    const store = new SaveStore(mem);
    expect(store.recovered).toBe(true);
    expect(store.data).toEqual(defaultSave());
  });

  it('sanitises wrong types, out-of-range values and junk', () => {
    const d = sanitize({
      currentChapter: 99,
      shells: ['ch01-1', 'ch01-1', 5, null, 'x'.repeat(200)],
      settings: { master: 7, music: 'loud', handed: 'both', difficulty: 'impossible', textScale: -3, haptics: 'yes' },
      chapters: { '1': { completed: true, bestTime: -5, routes: 'no' }, '77': { completed: true }, banana: 3 },
      daily: { lastCompleted: 'yesterday', streak: -4, bestTimes: { '2026-01-01': 30, nope: 3, '2026-01-02': 'x' } },
      checkpoint: { chapter: 3, index: -2 },
      tutorial: { glow: true, jump: 'true', hack: true },
      driftBest: Number.NaN,
      endingSeen: 'maybe',
    });
    expect(d.currentChapter).toBe(10);
    expect(d.shells).toEqual(['ch01-1']);
    expect(d.settings.master).toBe(1);
    expect(d.settings.music).toBe(DEFAULT_SETTINGS.music);
    expect(d.settings.handed).toBe('right');
    expect(d.settings.difficulty).toBe('standard');
    expect(d.settings.textScale).toBe(0.85);
    expect(d.settings.haptics).toBe(true);
    expect(d.chapters).toEqual({ '1': { completed: true, bestTime: null, routes: [] } });
    expect(d.daily).toEqual({ lastCompleted: null, streak: 0, bestTimes: { '2026-01-01': 30 } });
    expect(d.checkpoint).toBeNull();
    expect(d.tutorial).toEqual({ glow: true });
    expect(d.driftBest).toBe(0);
    expect(d.endingSeen).toBe(false);
    for (const junk of [null, undefined, 42, 'text', [], true]) expect(sanitize(junk)).toEqual(defaultSave());
  });

  it('completing a chapter unlocks the next, keeps the best time and clears the checkpoint', () => {
    const store = new SaveStore(new MemoryStorage());
    store.setCheckpoint(1, 2);
    expect(store.isUnlocked(2)).toBe(false);
    expect(store.completeChapter(1, 80, ['ch01-high'])).toBe(true);
    expect(store.isUnlocked(2)).toBe(true);
    expect(store.data.checkpoint).toBeNull();
    expect(store.completeChapter(1, 95, [])).toBe(false);
    expect(store.chapter(1).bestTime).toBe(80);
    expect(store.completeChapter(1, 70, ['ch01-low'])).toBe(true);
    expect(store.chapter(1)).toEqual({ completed: true, bestTime: 70, routes: ['ch01-high', 'ch01-low'] });
    // Replaying an early chapter never re-locks later ones.
    store.completeChapter(4, 100, []);
    store.completeChapter(1, 60, []);
    expect(store.data.currentChapter).toBe(5);
    store.completeChapter(10, 100, []);
    expect(store.data.currentChapter).toBe(10);
    expect(store.data.endingSeen).toBe(true);
  });

  it('tracks Daily Tide bests and streaks', () => {
    const store = new SaveStore(new MemoryStorage());
    expect(store.completeDaily('2026-03-01', 50)).toBe(true);
    expect(store.data.daily.streak).toBe(1);
    expect(store.completeDaily('2026-03-01', 60)).toBe(false);
    expect(store.data.daily.streak).toBe(1);
    store.completeDaily('2026-03-02', 40);
    expect(store.data.daily.streak).toBe(2);
    store.completeDaily('2026-03-05', 40);
    expect(store.data.daily.streak).toBe(1);
    expect(store.data.daily.bestTimes['2026-03-01']).toBe(50);
  });

  it('reset wipes progress but keeps settings', () => {
    const mem = new MemoryStorage();
    const store = new SaveStore(mem);
    store.updateSettings({ reducedMotion: true, master: 0.3 });
    store.completeChapter(1, 50, []);
    store.addShell('ch01-2');
    store.resetProgress();
    expect(store.data.currentChapter).toBe(1);
    expect(store.data.shells).toEqual([]);
    expect(store.data.settings.reducedMotion).toBe(true);
    expect(new SaveStore(mem).data.settings.master).toBe(0.3);
  });

  it('keeps working from memory when storage is missing or refuses writes', () => {
    const none = new SaveStore(null);
    none.addShell('ch02-1');
    expect(none.data.shells).toEqual(['ch02-1']);
    const mem = new MemoryStorage();
    mem.failWrites = true;
    const store = new SaveStore(mem);
    expect(() => store.completeChapter(1, 10, [])).not.toThrow();
    expect(store.chapter(1).completed).toBe(true);
  });

  it('does not duplicate shells or lower the drift record', () => {
    const store = new SaveStore(new MemoryStorage());
    expect(store.addShell('ch03-1')).toBe(true);
    expect(store.addShell('ch03-1')).toBe(false);
    expect(store.recordDrift(100)).toBe(true);
    expect(store.recordDrift(50)).toBe(false);
    expect(store.data.driftBest).toBe(100);
  });
});
