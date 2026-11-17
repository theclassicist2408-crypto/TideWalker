import { describe, expect, it } from 'vitest';
import { ALL_REWARDS, DIFF } from '../src/game/core/constants';
import { BOSSES, MINIBOSSES, TUTORIAL_GUARDIAN, bossDef, hitBoss } from '../src/game/entities/bosses';
import { allLevels } from '../src/game/levels';
import { flatLevel, loadout, makeWorld, run, settle } from './helpers';

const AREA_BOSSES = ['warden', 'mooneater', 'sovereign', 'choir', 'squall', 'pontiff', 'smith', 'rootmother', 'hush', 'tideking'];

function bossWorld(id: string, difficulty: 'gentle' | 'standard' | 'intense' = 'standard') {
  const w = makeWorld(flatLevel((b) => b.flat(100).arena(600, [[]], { boss: id }).flat(100)), { difficulty, load: loadout() });
  settle(w);
  w.player.x = 900;
  w.player.invuln = 999;
  return w;
}

describe('guardians', () => {
  it('there are ten area bosses, one per area, each with at least two phases', () => {
    expect(BOSSES.map((b) => b.id)).toEqual(AREA_BOSSES);
    BOSSES.forEach((b, i) => {
      expect(b.area).toBe(i + 1);
      expect(b.mini).toBe(false);
      expect(b.phases.length).toBeGreaterThanOrEqual(2);
      expect(b.phases[0].at).toBe(1);
      for (let k = 1; k < b.phases.length; k++) expect(b.phases[k].at).toBeLessThan(b.phases[k - 1].at);
    });
  });

  it('each boss gives a different gift, in area order', () => {
    expect(BOSSES.map((b) => b.reward)).toEqual(ALL_REWARDS);
  });

  it('bosses grow tougher through the journey', () => {
    expect(BOSSES[9].hp).toBeGreaterThan(BOSSES[0].hp);
    for (const b of BOSSES) expect(b.phases.at(-1)!.gap).toBeLessThan(b.phases[0].gap);
  });

  it('at least twenty minibosses, two or more in every area, each with two phases', () => {
    expect(MINIBOSSES.length).toBeGreaterThanOrEqual(20);
    for (let a = 1; a <= 10; a++) expect(MINIBOSSES.filter((m) => m.area === a).length).toBeGreaterThanOrEqual(2);
    for (const m of MINIBOSSES) expect(m.phases.length).toBeGreaterThanOrEqual(2);
    expect(new Set([...BOSSES, ...MINIBOSSES].map((b) => b.id)).size).toBe(BOSSES.length + MINIBOSSES.length);
  });

  it('every guardian appears in exactly one level arena', () => {
    const placed = allLevels().flatMap((l) => l.arenas.map((a) => a.boss ?? a.miniboss).filter((x): x is string => !!x));
    for (const d of [...BOSSES, ...MINIBOSSES]) expect(placed.filter((p) => p === d.id).length).toBe(1);
  });

  it('each area boss guards the last level of its area', () => {
    for (const l of allLevels().filter((x) => x.index === 10)) expect(l.arenas.some((a) => a.boss === AREA_BOSSES[l.area - 1])).toBe(true);
  });

  it('the tutorial has its own small guardian', () => {
    expect(bossDef('echo')).toBe(TUTORIAL_GUARDIAN);
    expect(TUTORIAL_GUARDIAN.hp).toBeLessThan(MINIBOSSES[0].hp);
  });
});

describe('boss fight flow', () => {
  it('a guardian enters, telegraphs, then acts — never acting without warning', () => {
    const w = bossWorld('warden');
    expect(run(w, 0.05)).toContain('bossIntro');
    const b = w.boss!;
    expect(b.mode).toBe('intro');
    const seen: string[] = [];
    for (let i = 0; i < 60 * 12; i++) {
      run(w, 1 / 60);
      if (seen.at(-1) !== b.mode) seen.push(b.mode);
    }
    const firstAct = seen.indexOf('act');
    expect(firstAct).toBeGreaterThan(0);
    expect(seen.slice(0, firstAct)).toContain('tele');
    for (let i = 0; i < seen.length; i++) if (seen[i] === 'act') expect(seen[i - 1]).toBe('tele');
  });

  it('crossing a health threshold starts the next phase with a stagger', () => {
    const w = bossWorld('warden');
    run(w, 3);
    const b = w.boss!;
    const next = b.def.phases[1];
    hitBoss(w, Math.ceil(b.hpMax * (1 - next.at)) + 1, false);
    expect(b.phase).toBe(1);
    expect(b.mode).toBe('recover');
  });

  it('defeat clears its attacks, records it, and opens the arena', () => {
    const w = bossWorld('warden');
    run(w, 3);
    hitBoss(w, 99999, false);
    expect(w.boss!.mode).toBe('dead');
    expect(w.defeated.has('warden')).toBe(true);
    expect(w.zones.every((z) => !z.alive)).toBe(true);
    const ev = run(w, 0.1);
    expect(ev).toContain('arenaClear');
    expect(w.gates.filter((g) => g.kind === 'arena').every((g) => g.open)).toBe(true);
  });

  it('Gentle gives longer warnings and a weaker guardian; Intense shorter warnings', () => {
    const hp = (d: 'gentle' | 'standard' | 'intense') => {
      const w = bossWorld('squall', d);
      run(w, 0.05);
      return w.boss!.hpMax;
    };
    expect(hp('gentle')).toBeLessThan(hp('standard'));
    expect(DIFF.gentle.telegraph).toBeGreaterThan(DIFF.standard.telegraph);
    expect(DIFF.intense.telegraph).toBeLessThan(DIFF.standard.telegraph);
  });

  it('a failed fight resets the guardian to full health', () => {
    const w = bossWorld('warden');
    run(w, 3);
    hitBoss(w, 100, false);
    w.kill();
    w.respawn();
    expect(w.boss).toBeNull();
    w.player.x = 900;
    run(w, 0.1);
    expect(w.boss!.hp).toBe(w.boss!.hpMax);
  });

  it.each(AREA_BOSSES)('%s runs every phase for a while without breaking', (id) => {
    const w = bossWorld(id);
    run(w, 2.5);
    const b = w.boss!;
    for (let ph = 1; ph < b.def.phases.length; ph++) {
      hitBoss(w, Math.max(1, b.hp - Math.floor(b.hpMax * b.def.phases[ph].at) + 1), false);
      expect(b.phase).toBe(ph);
      run(w, 8);
      expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
      expect(b.mode).not.toBe('dead');
    }
  });
});
