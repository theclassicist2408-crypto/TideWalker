import { describe, expect, it } from 'vitest';
import { BASE_HP, SAVE_KEY } from '../src/game/core/constants';
import { SaveStore, defaultSave, levelOrder, sanitize } from '../src/game/save/save';
import { MemoryStorage } from './helpers';

describe('save', () => {
  it('starts fresh: tutorial pending, only the first level open, standard difficulty', () => {
    const s = new SaveStore(new MemoryStorage());
    expect(s.data.version).toBe(2);
    expect(s.data.tutorialDone).toBe(false);
    expect(s.isOpen(1, 1)).toBe(false);
    s.completeTutorial();
    expect(s.isOpen(1, 1)).toBe(true);
    expect(s.isOpen(1, 2)).toBe(false);
    expect(s.data.settings.difficulty).toBe('standard');
  });

  it('finishing a level opens the next and keeps the best time', () => {
    const st = new MemoryStorage();
    const s = new SaveStore(st);
    s.completeTutorial();
    expect(s.completeLevel('a01-01', 1, 1, 90, ['nook'])).toBe(true);
    expect(s.isOpen(1, 2)).toBe(true);
    expect(s.completeLevel('a01-01', 1, 1, 120, [])).toBe(false);
    expect(s.level('a01-01').bestTime).toBe(90);
    expect(s.completeLevel('a01-01', 1, 1, 70, [])).toBe(true);
    s.completeLevel('a01-10', 1, 10, 200, []);
    expect(s.isOpen(2, 1)).toBe(true);
    expect(s.data.secrets).toEqual(['nook']);
    expect(new SaveStore(st).data.levels['a01-01'].bestTime).toBe(70);
  });

  it('records abilities, upgrades, guardians and gifts; the loadout reflects them', () => {
    const s = new SaveStore(new MemoryStorage());
    expect(s.takeGrant('a01-02:0', { ability: 'dash' })).toBe(true);
    expect(s.takeGrant('a01-02:0', { ability: 'dash' })).toBe(false);
    s.takeGrant('a01-04:0', { upgrade: 'health' });
    expect(s.defeat('brinehound')).toBe(true);
    expect(s.defeat('brinehound')).toBe(false);
    s.defeat('warden', 'tidebreaker');
    s.defeat('mooneater', 'veil');
    const l = s.loadout();
    expect([...l.abilities]).toEqual(['dash']);
    expect(l.hpMax).toBe(BASE_HP + 1);
    expect(l.equipped).toBe('veil');
    expect(s.cycleReward()).toBe('tidebreaker');
    expect(s.cycleReward()).toBe('veil');
  });

  it('shells, checkpoints and hints persist', () => {
    const st = new MemoryStorage();
    const s = new SaveStore(st);
    expect(s.addShell('a01-1')).toBe(true);
    expect(s.addShell('a01-1')).toBe(false);
    s.setCheckpoint('a03-04', 2);
    s.markHint('dash');
    const again = new SaveStore(st);
    expect(again.data.shells).toEqual(['a01-1']);
    expect(again.data.checkpoint).toEqual({ level: 'a03-04', index: 2 });
    expect(again.data.hints.dash).toBe(true);
  });

  it('settings persist and survive a progress reset', () => {
    const st = new MemoryStorage();
    const s = new SaveStore(st);
    s.updateSettings({ difficulty: 'intense', handed: 'left', master: 0.3 });
    s.completeTutorial();
    s.resetProgress();
    const again = new SaveStore(st);
    expect(again.data.settings.difficulty).toBe('intense');
    expect(again.data.settings.handed).toBe('left');
    expect(again.data.tutorialDone).toBe(false);
  });

  it('corrupt or hostile data is repaired, never trusted', () => {
    const st = new MemoryStorage();
    st.setItem(SAVE_KEY, '{not json');
    const s = new SaveStore(st);
    expect(s.recovered).toBe(true);
    expect(s.data).toEqual(defaultSave());
    const d = sanitize({
      unlocked: 9999,
      abilities: ['dash', 'fly', 3],
      rewards: ['veil', 'laser'],
      equipped: 'laser',
      upgrades: { health: 99, pulse: -4 },
      levels: { 'a01-01': { done: true, bestTime: -5 }, hack: { done: true } },
      settings: { master: 7, difficulty: 'nightmare', handed: 'up' },
      checkpoint: { level: '../x', index: 1 },
    });
    expect(d.unlocked).toBe(100);
    expect(d.abilities).toEqual(['dash']);
    expect(d.rewards).toEqual(['veil']);
    expect(d.equipped).toBe('veil');
    expect(d.upgrades.health).toBe(6);
    expect(d.upgrades.pulse).toBe(0);
    expect(d.levels['a01-01']).toEqual({ done: true, bestTime: null });
    expect(d.levels.hack).toBeUndefined();
    expect(d.settings.master).toBe(1);
    expect(d.settings.difficulty).toBe('standard');
    expect(d.settings.handed).toBe('right');
    expect(d.checkpoint).toBeNull();
  });

  it('keeps playing from memory when storage refuses writes or is missing', () => {
    const st = new MemoryStorage();
    st.failWrites = true;
    const s = new SaveStore(st);
    expect(() => s.addShell('a01-1')).not.toThrow();
    expect(s.data.shells).toEqual(['a01-1']);
    const none = new SaveStore(null);
    expect(() => none.completeTutorial()).not.toThrow();
  });

  it('level order runs area by area', () => {
    expect(levelOrder(1, 1)).toBe(0);
    expect(levelOrder(2, 1)).toBe(10);
    expect(levelOrder(10, 10)).toBe(99);
  });
});
