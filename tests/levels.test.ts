import { describe, expect, it } from 'vitest';
import { ALL_ABILITIES } from '../src/game/core/constants';
import { ENEMY_KINDS } from '../src/game/entities/enemies';
import { allAreas, allLevels, getLevel, getTutorial } from '../src/game/levels';
import { ABILITY_SCHEDULE, abilitiesAt, minimumLoadout } from '../src/game/levels/progress';

const AREA_NAMES = ['The Shallows', 'Moonlit Pools', 'Kelp Abyss', 'Drowned Ruins', 'Storm Reach', 'Coral Cathedral', 'Sunken Forge', 'Abyssal Gardens', 'The Silent Deep', "Tide King's Throne"];
const levels = allLevels();

describe('structure', () => {
  it('exactly ten areas of ten levels, named as designed', () => {
    expect(allAreas().map((a) => a.name)).toEqual(AREA_NAMES);
    expect(levels.length).toBe(100);
    for (let a = 1; a <= 10; a++) expect(levels.filter((l) => l.area === a).map((l) => l.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(new Set(levels.map((l) => l.id)).size).toBe(100);
  });

  it('every level has a name, a line and its own twist', () => {
    for (const l of levels) {
      expect(l.name.length).toBeGreaterThan(2);
      expect(l.twist.length).toBeGreaterThan(5);
    }
    expect(new Set(levels.map((l) => l.twist)).size).toBe(100);
  });

  it('levels are built the same way every time', () => {
    expect(JSON.stringify(getLevel(4, 7))).toBe(JSON.stringify(getLevel(4, 7)));
  });

  it('at least twelve enemy kinds, all of them used', () => {
    expect(ENEMY_KINDS.length).toBeGreaterThanOrEqual(12);
    const used = new Set(levels.flatMap((l) => l.enemies.map((e) => e.kind)));
    for (const k of ENEMY_KINDS) if (k !== 'mite') expect(used.has(k)).toBe(true);
  });

  it('two Memory Shells per area with ids aNN-1 / aNN-2, at least one hidden', () => {
    for (let a = 1; a <= 10; a++) {
      const shells = levels.filter((l) => l.area === a).flatMap((l) => l.shells);
      const id = (n: number) => `a${String(a).padStart(2, '0')}-${n}`;
      expect(shells.map((s) => s.id).sort()).toEqual([id(1), id(2)]);
      expect(shells.some((s) => s.hidden)).toBe(true);
    }
  });

  it('lanterns never sit more than 2700 px apart, and every boss has one at its door', () => {
    // Chases are short sprints that restart from the top by design.
    for (const l of levels.filter((x) => !x.rules.chase)) {
      const xs = [l.spawn.x, ...l.checkpoints.map((c) => c.x), l.goalX].sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1], `${l.id} gap at ${xs[i - 1]}`).toBeLessThanOrEqual(2700);
      for (const a of l.arenas.filter((x) => x.boss)) expect(l.checkpoints.some((c) => c.x < a.x0 && a.x0 - c.x < 500), l.id).toBe(true);
    }
  });

  it('levels last a sensible length', () => {
    for (const l of levels) {
      expect(l.goalX, l.id).toBeGreaterThan(1800);
      expect(l.goalX, l.id).toBeLessThan(9000);
    }
  });
});

describe('progression', () => {
  it('every ability is restored once, by a shrine or guardian in the scheduled level', () => {
    expect(ABILITY_SCHEDULE.map((s) => s.ability).sort()).toEqual([...ALL_ABILITIES].sort());
    for (const s of ABILITY_SCHEDULE) {
      const l = getLevel(s.area, s.level);
      expect(l.grants.some((g) => g.ability === s.ability), `${s.ability} in ${l.id}`).toBe(true);
    }
    const granted = levels.flatMap((l) => l.grants.filter((g) => g.ability).map((g) => g.ability));
    expect(granted.sort()).toEqual([...ALL_ABILITIES].sort());
  });

  it('a level never asks for an ability that is not yet held', () => {
    for (const l of levels) {
      const held = abilitiesAt(l.area, l.index);
      for (const g of l.grants) if (g.ability) held.add(g.ability);
      for (const wp of l.waypoints) {
        if (wp.optional || !wp.act) continue;
        const need = wp.act === 'climb' ? 'wall' : wp.act;
        if ((ALL_ABILITIES as string[]).includes(need)) expect(held.has(need as never), `${l.id} needs ${need}`).toBe(true);
      }
    }
  });

  it('optional guardians grant upgrades', () => {
    const ups = levels.flatMap((l) => l.grants.filter((g) => g.upgrade && g.after));
    expect(ups.length).toBeGreaterThanOrEqual(12);
  });

  it('the minimum loadout grows with each area', () => {
    expect(minimumLoadout(1, 1).abilities.size).toBe(0);
    expect(minimumLoadout(5, 1).abilities.size).toBe(ALL_ABILITIES.length);
    expect(minimumLoadout(10, 1).rewards.size).toBe(9);
  });

  it('the tutorial teaches every mechanic', () => {
    const t = getTutorial();
    const kinds = new Set(t.hints.map((h) => h.kind));
    for (const k of ['move', 'jump', 'double', 'wall', 'dash', 'attack', 'downstrike', 'charge', 'pulse', 'heal', 'bench', 'pause', 'boss', 'rematch', 'dive', 'glide']) expect(kinds.has(k as never), k).toBe(true);
    expect(t.arenas.some((a) => a.miniboss === 'echo' || a.boss === 'echo')).toBe(true);
  });
});
