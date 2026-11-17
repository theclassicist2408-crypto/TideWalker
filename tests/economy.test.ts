import { describe, expect, it } from 'vitest';
import { ALL_SWORDS, FORGE, LOOT, P, SWORDS } from '../src/game/core/constants';
import type { SwordId } from '../src/game/core/types';
import { spawnEnemy } from '../src/game/entities/enemies';
import { allLevels, getLevel } from '../src/game/levels';
import { minimumLoadout } from '../src/game/levels/progress';
import { SaveStore, sanitize } from '../src/game/save/save';
import { strikeMul, useRelic } from '../src/game/systems/combat';
import { World } from '../src/game/core/world';
import { flatLevel, loadout, makeWorld, MemoryStorage, run, settle } from './helpers';

function foe(w: World, x: number, elite = false) {
  const e = spawnEnemy(w, 'skitter', x, -14, x - 40, x + 40, elite, -1, 0);
  e.spawnT = 0;
  return e;
}

describe('plasma', () => {
  it('a kill drops plasma scaled by area and elite rank', () => {
    const w = makeWorld(flatLevel());
    settle(w);
    const e = foe(w, 400, true);
    const ev = run(w, 0.01);
    void ev;
    e.hp = 1;
    w.player.x = 380;
    w.player.facing = 1;
    run(w, 0.05, { attack: true });
    expect(e.alive).toBe(false);
    expect(w.plasma).toBe(LOOT.enemy * LOOT.eliteMul);
  });

  it('is banked at a lantern and at the goal, and lost on a fall', () => {
    const level = flatLevel((b) => b.flat(100).checkpoint(20).flat(300));
    const w = makeWorld(level);
    settle(w);
    w.addPlasma(40, 0, 0);
    w.player.x = level.checkpoints[0].x + 2;
    const ev = run(w, 0.05);
    expect(ev).toContain('bank');
    expect(w.plasma).toBe(0);
    w.addPlasma(25, 0, 0);
    w.kill();
    expect(w.plasma).toBe(0);
  });

  it('only story and rematch journeys earn it', () => {
    const w = makeWorld(flatLevel(), { mode: 'tutorial' });
    w.addPlasma(50, 0, 0);
    expect(w.plasma).toBe(0);
  });
});

describe('chests', () => {
  it('every level has a chest; chest ids are unique', () => {
    const ids = allLevels().flatMap((l) => l.chests.map((c) => c.id));
    expect(allLevels().every((l) => l.chests.length >= 1)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('a strike opens a chest once; an opened chest stays open in a new world', () => {
    const level = flatLevel((b) => b.flat(100).chest(40, { plasma: 50, diamonds: 1, relic: 'thunder' }));
    const w = makeWorld(level);
    settle(w);
    const c = w.chests[0];
    w.player.x = c.x - 20;
    w.player.facing = 1;
    expect(run(w, 0.05, { attack: true })).toContain('chest');
    expect(c.opened).toBe(true);
    const save = new SaveStore(new MemoryStorage());
    expect(save.openChest(c)).toBe(true);
    expect(save.openChest(c)).toBe(false);
    expect(save.data.diamonds).toBe(1);
    expect(save.data.relics.thunder).toBe(1);
    const again = makeWorld(level, {});
    expect(new World(level, { difficulty: 'standard', mode: 'story', openedChests: new Set([c.id]) }).chests[0].opened).toBe(true);
    expect(again.chests[0].opened).toBe(false);
  });
});

describe('trials', () => {
  const withTrial = () => getLevel(1, 2);

  it('appear on levels 2, 5 and 8 where the route allows, built past the goal', () => {
    const levels = allLevels();
    const trials = levels.flatMap((l) => l.trials);
    expect(trials.length).toBeGreaterThanOrEqual(24);
    for (const l of levels) for (const t of l.trials) {
      expect(t.x0).toBeGreaterThan(l.goalX);
      expect(t.portalX).toBeLessThan(l.goalX);
      expect(l.chests.some((c) => c.grand && c.x > t.x0 && c.x < t.x1)).toBe(true);
    }
  });

  it('push up at the arch to enter; the world is fenced to the trial; a fall returns to the lantern', () => {
    const l = withTrial();
    const w = new World(l, { difficulty: 'standard', mode: 'story', loadout: minimumLoadout(1, 2) });
    const t = l.trials[0];
    settle(w);
    w.player.x = t.portalX;
    w.player.y = t.portalY;
    run(w, 0.3);
    expect(run(w, 0.05, { my: -1 })).toContain('trialEnter');
    expect(w.trialIndex).toBe(0);
    expect(w.minX).toBe(t.x0);
    expect(w.maxX).toBe(t.x1);
    run(w, 1, { mx: -1 });
    expect(w.player.x).toBeGreaterThanOrEqual(t.x0);
    w.kill();
    w.respawn();
    expect(w.trialIndex).toBe(-1);
    expect(w.player.x).toBeLessThan(l.goalX);
  });

  it('the exit only opens once the fight is won, and returns you to the arch', () => {
    const l = withTrial();
    const w = new World(l, { difficulty: 'standard', mode: 'story', loadout: minimumLoadout(1, 2) });
    const t = l.trials[0];
    settle(w);
    w.player.x = t.portalX;
    w.player.y = t.portalY;
    run(w, 0.3);
    run(w, 0.05, { my: -1 });
    w.player.x = t.exitX;
    w.player.y = t.exitY;
    w.player.invuln = 99;
    run(w, 0.9);
    expect(run(w, 0.05, { my: -1 })).not.toContain('trialExit');
    for (const a of w.arenas) if (a.x0 >= t.x0) a.state = 'done';
    expect(run(w, 0.05, { my: -1 })).toContain('trialExit');
    expect(w.trialIndex).toBe(-1);
    expect(Math.abs(w.player.x - t.portalX)).toBeLessThan(1);
  });

  it('the goal does not count from inside a trial', () => {
    const l = withTrial();
    const w = new World(l, { difficulty: 'standard', mode: 'story', loadout: minimumLoadout(1, 2) });
    w.trialIndex = 0;
    w.player.x = l.goalX + 50;
    run(w, 0.05);
    expect(w.status).toBe('playing');
  });
});

describe('swords, techniques and relics', () => {
  it.each(ALL_SWORDS)('%s: its charged art fires and its strikes scale with the Forge', (id: SwordId) => {
    const w = makeWorld(flatLevel((b) => b.flat(200)), { load: { ...loadout(), sword: id, blade: 3 } });
    settle(w);
    w.player.x = 600;
    w.player.facing = 1;
    foe(w, 650);
    foe(w, 720);
    expect(strikeMul(w)).toBeCloseTo(SWORDS[id].dmg * (1 + FORGE.blade.step * 3), 5);
    run(w, P.chargeTime + 0.05, { attackHeld: true });
    const ev = run(w, 0.4);
    expect(ev).toContain('chargeSlash');
    expect(ev).toContain('art');
    expect(ev).toContain('hit');
  });

  it('Third Cut: the third quick side strike is a stronger finisher', () => {
    const w = makeWorld(flatLevel(), { load: { ...loadout(), styles: new Set(['combo'] as const) } });
    settle(w);
    const events: string[] = [];
    for (let i = 0; i < 3; i++) {
      events.push(...run(w, 0.02, { attack: true }));
      run(w, P.slashCooldown + 0.02);
    }
    expect(events.filter((e) => e === 'finisher').length).toBe(1);
  });

  it('Rising Cut lifts; without it an upward strike does not', () => {
    const lift = (styles: Set<'rising'>) => {
      const w = makeWorld(flatLevel(), { load: { ...loadout(), styles } });
      settle(w);
      run(w, 0.02, { attack: true, my: -1 });
      return w.player.vy;
    };
    expect(lift(new Set(['rising']))).toBeLessThan(-200);
    expect(lift(new Set())).toBeGreaterThanOrEqual(0);
  });

  it('relics: Thunder hurts every foe in sight, Draught heals fully, and each is spent once', () => {
    const w = makeWorld(flatLevel((b) => b.flat(200)), { load: { ...loadout(), relics: { thunder: 1, frost: 0, draught: 1, nova: 0 }, relic: 'thunder' } });
    settle(w);
    w.player.x = 600;
    const a = foe(w, 700);
    const hp = a.hp;
    useRelic(w);
    expect(a.hp).toBeLessThan(hp);
    expect(w.load.relics.thunder).toBe(0);
    let ev = run(w, 0.02, { item: true });
    expect(ev).toContain('relicFail');
    w.load.relic = 'draught';
    w.player.hp = 1;
    ev = run(w, 0.02, { item: true });
    expect(ev).toContain('relic');
    expect(w.player.hp).toBe(w.load.hpMax);
  });
});

describe('forge and save', () => {
  it('upgrades cost plasma (and diamonds later), cap at their maximum, and change the loadout', () => {
    const s = new SaveStore(new MemoryStorage());
    expect(s.buyForge('armor')).toBe('plasma');
    s.addPlasma(5000);
    s.addDiamonds(10);
    expect(s.buyForge('armor')).toBeNull();
    for (let i = 0; i < 5; i++) s.buyForge('armor');
    expect(s.data.forge.armor).toBe(FORGE.armor.max);
    expect(s.buyForge('armor')).toBe('max');
    expect(s.loadout().hpMax).toBe(6 + FORGE.armor.max);
    s.buyForge('blade');
    expect(s.loadout().blade).toBe(1);
  });

  it('swords and techniques unlock by area, are bought once and equip', () => {
    const s = new SaveStore(new MemoryStorage());
    s.addPlasma(99999);
    s.addDiamonds(99);
    expect(s.buySword('storm')).toBe('locked');
    s.data.unlocked = 31;
    expect(s.buySword('storm')).toBeNull();
    expect(s.buySword('storm')).toBe('owned');
    expect(s.loadout().sword).toBe('storm');
    s.equipSword('tide');
    expect(s.loadout().sword).toBe('tide');
    expect(s.buyStyle('combo')).toBeNull();
    expect(s.loadout().styles?.has('combo')).toBe(true);
  });

  it('relic choice falls to what is owned, and cycling skips empty ones', () => {
    const s = new SaveStore(new MemoryStorage());
    expect(s.relicInHand()).toBeNull();
    s.data.relics.frost = 2;
    s.data.relics.nova = 1;
    expect(s.relicInHand()).toBe('frost');
    expect(s.cycleRelic()).toBe('frost');
    expect(s.cycleRelic()).toBe('nova');
    s.spendRelic('nova');
    expect(s.relicInHand()).toBe('frost');
  });

  it('economy fields are sanitised', () => {
    const d = sanitize({ plasma: -5, diamonds: 'x', forge: { blade: 99, armor: -1 }, swords: ['ember', 'laser'], sword: 'laser', styles: ['combo', 'fly'], relics: { thunder: 500 }, relic: 'bomb' });
    expect(d.plasma).toBe(0);
    expect(d.diamonds).toBe(0);
    expect(d.forge.blade).toBe(FORGE.blade.max);
    expect(d.forge.armor).toBe(0);
    expect(d.swords).toEqual(['tide', 'ember']);
    expect(d.sword).toBe('tide');
    expect(d.styles).toEqual(['combo']);
    expect(d.relics.thunder).toBe(99);
    expect(d.relic).toBeNull();
  });
});
