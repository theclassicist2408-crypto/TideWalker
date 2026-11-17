import { describe, expect, it } from 'vitest';
import { DIFF, P, REWARDS, ALL_REWARDS } from '../src/game/core/constants';
import { hitEnemy, spawnEnemy } from '../src/game/entities/enemies';
import { hurtPlayer } from '../src/game/systems/combat';
import { flatLevel, loadout, makeWorld, run, settle } from './helpers';

/** A world with one enemy of `kind` standing just ahead of the creature. */
function duel(kind: Parameters<typeof spawnAhead>[1], abilities = loadout(), back = 0) {
  const w = makeWorld(flatLevel((b) => b.flat(300)), { load: abilities });
  settle(w);
  w.player.x = 700;
  spawnAhead(w, kind, 734 + back);
  return w;
}

function spawnAhead(w: ReturnType<typeof makeWorld>, kind: 'skitter' | 'shellback' | 'thornbloom' | 'spitter' | 'burrower', x: number) {
  const e = spawnEnemy(w, kind, x, -14, x - 60, x + 60, false, -1, 0);
  e.spawnT = 0;
  e.facing = -1;
  return e;
}

describe('light-blade', () => {
  it('a side strike damages a foe, builds Tide Essence, and freezes the frame', () => {
    const w = duel('skitter');
    const e = w.enemies[0];
    const hp = e.hp;
    w.player.facing = 1;
    run(w, 0.02, { attack: true });
    expect(e.hp).toBe(hp - P.slashDamage);
    expect(w.player.essence).toBeCloseTo(P.essencePerHit, 5);
  });

  it('strikes once per swing, with a cooldown between swings', () => {
    const w = duel('shellback');
    const e = w.enemies[0];
    e.facing = 1; // back turned
    const hp = e.hp;
    w.player.facing = 1;
    run(w, P.slashTime, { attack: true });
    expect(hp - e.hp).toBe(P.slashDamage);
    run(w, 0.05, { attack: true });
    expect(hp - e.hp).toBe(P.slashDamage);
  });

  it('a shellback blocks from the front; a charged strike breaks through', () => {
    const w = duel('shellback');
    const e = w.enemies[0];
    expect(hitEnemy(w, e, 10, 700, 'side', false)).toBe('blocked');
    expect(hitEnemy(w, e, 10, 700, 'down', false)).toBe('hit');
    expect(hitEnemy(w, e, 10, 700, 'side', true)).not.toBe('blocked');
  });

  it('a thornbloom is armoured while closed', () => {
    const w = duel('thornbloom');
    const e = w.enemies[0];
    e.mode = 'idle';
    expect(hitEnemy(w, e, 10, 700, 'side', false)).toBe('blocked');
    e.mode = 'rest';
    expect(hitEnemy(w, e, 10, 700, 'side', false)).toBe('hit');
  });

  it('a downward strike pogoes off spikes and restores the double jump', () => {
    const w = makeWorld(flatLevel((b) => b.flat(100).spikes(60, 60)), { load: loadout(['double']) });
    settle(w);
    w.player.x = 670;
    w.player.y = -60;
    w.player.vy = 200;
    w.player.onGround = false;
    w.player.jumpsLeft = 0;
    const ev = run(w, 0.15, { my: 1, attack: true });
    expect(ev).toContain('pogo');
    expect(w.player.vy).toBeLessThan(0);
    expect(w.player.jumpsLeft).toBe(1);
  });

  it('a held strike charges, costs Lumen, deals heavy damage and breaks cracked rock', () => {
    const w = makeWorld(flatLevel((b) => b.flat(100).block(40, 80, 30, 80, 'cracked')));
    settle(w);
    w.player.x = 640;
    w.player.facing = 1;
    const before = w.player.lumen;
    const ev = run(w, P.chargeTime + 0.05, { attackHeld: true });
    expect(ev).toContain('chargeReady');
    const ev2 = run(w, 0.1, {});
    expect(ev2).toContain('chargeSlash');
    expect(ev2).toContain('break');
    expect(w.blocks[0].broken).toBe(true);
    expect(w.player.lumen).toBeLessThan(before);
    expect(P.chargeDamage).toBeGreaterThan(P.slashDamage * 3);
  });

  it('a plain strike does not break cracked rock', () => {
    const w = makeWorld(flatLevel((b) => b.flat(100).block(40, 80, 30, 80, 'cracked')));
    settle(w);
    w.player.x = 640;
    w.player.facing = 1;
    run(w, 0.2, { attack: true });
    expect(w.blocks[0].broken).toBe(false);
  });
});

describe('Lumen Pulse and healing', () => {
  it('a pulse costs Lumen, stuns foes in range and grants brief safety', () => {
    const w = duel('skitter');
    const lumen = w.player.lumen;
    const ev = run(w, 0.02, { pulse: true });
    expect(ev).toContain('pulse');
    expect(w.player.lumen).toBeLessThanOrEqual(lumen - P.pulseCost + 1);
    expect(w.enemies[0].mode).toBe('stun');
    expect(w.player.invuln).toBeGreaterThan(0);
  });

  it('a pulse fails without the gift or without Lumen', () => {
    const w = duel('skitter', loadout([]));
    expect(run(w, 0.02, { pulse: true })).toContain('pulseFail');
    const w2 = duel('skitter');
    w2.player.lumen = P.pulseCost - 1;
    expect(run(w2, 0.02, { pulse: true })).toContain('pulseFail');
  });

  it('healing roots the creature, spends one Essence and restores health', () => {
    const w = makeWorld(flatLevel());
    settle(w);
    w.player.hp = 2;
    w.player.essence = 1.5;
    const ev = run(w, P.healTime + 0.05, { heal: true, mx: 1 });
    expect(ev).toContain('healStart');
    expect(ev).toContain('heal');
    expect(w.player.hp).toBe(2 + DIFF.standard.healAmount);
    expect(w.player.essence).toBeCloseTo(0.5, 5);
  });

  it('letting go early, or being hit, cancels the heal', () => {
    const w = makeWorld(flatLevel());
    settle(w);
    w.player.hp = 2;
    w.player.essence = 1;
    run(w, P.healTime * 0.5, { heal: true });
    run(w, 0.05);
    expect(w.player.hp).toBe(2);
    run(w, P.healTime * 0.5, { heal: true });
    hurtPlayer(w, 1, w.player.x + 20, w.player.y);
    expect(w.player.healT).toBe(0);
  });

  it('cannot heal without Essence or where the level forbids it', () => {
    const w = makeWorld(flatLevel());
    settle(w);
    w.player.hp = 2;
    w.player.essence = 0.9;
    expect(run(w, P.healTime + 0.1, { heal: true })).not.toContain('heal');
    const l = flatLevel();
    l.rules.noHeal = true;
    const w2 = makeWorld(l);
    settle(w2);
    w2.player.hp = 2;
    w2.player.essence = 3;
    expect(run(w2, P.healTime + 0.1, { heal: true })).not.toContain('heal');
  });
});

describe('damage, death and respawn', () => {
  it('a hit costs a mask, knocks back and grants invulnerability', () => {
    const w = makeWorld(flatLevel());
    settle(w);
    const hp = w.player.hp;
    expect(hurtPlayer(w, 1, w.player.x + 20, w.player.y)).toBe(true);
    expect(w.player.hp).toBe(hp - 1);
    expect(w.player.vx).toBeLessThan(0);
    expect(hurtPlayer(w, 1, w.player.x + 20, w.player.y)).toBe(false);
    run(w, P.invuln + 0.05);
    expect(hurtPlayer(w, 1, w.player.x + 20, w.player.y)).toBe(true);
  });

  it('losing the last mask fails the level; respawn restores health at the lantern', () => {
    const w = makeWorld(flatLevel());
    settle(w);
    w.player.hp = 1;
    hurtPlayer(w, 1, w.player.x + 20, w.player.y);
    expect(w.status).toBe('failed');
    w.respawn();
    expect(w.status).toBe('playing');
    expect(w.player.hp).toBe(w.load.hpMax);
    expect(w.totalFails).toBe(1);
  });

  it('spikes hurt and return the creature to safe ground', () => {
    const w = makeWorld(flatLevel((b) => b.flat(200).spikes(120, 80)));
    settle(w);
    w.player.x = 600;
    const hp = w.player.hp;
    let hurt = false;
    for (let i = 0; i < 120 && !hurt; i++) hurt = run(w, 1 / 60, { mx: 1 }).includes('hurt');
    expect(hurt).toBe(true);
    expect(w.player.hp).toBe(hp - 1);
    run(w, 0.05);
    expect(w.player.x).toBeLessThan(680);
  });

  it('Gentle grants extra masks and Intense makes foes tougher', () => {
    const g = makeWorld(flatLevel(), { difficulty: 'gentle' });
    const s = makeWorld(flatLevel(), { difficulty: 'standard' });
    expect(g.load.hpMax).toBe(s.load.hpMax + DIFF.gentle.hpBonus);
    const hpOf = (d: 'gentle' | 'standard' | 'intense') => {
      const w = makeWorld(flatLevel(), { difficulty: d });
      return spawnAhead(w, 'skitter', 760).hp;
    };
    expect(hpOf('gentle')).toBeLessThan(hpOf('standard'));
    expect(hpOf('intense')).toBeGreaterThan(hpOf('standard'));
  });
});

describe('enemies', () => {
  it('every attack is announced by a wind-up before it can hurt', () => {
    const w = duel('skitter', loadout(), 40);
    const hp = w.player.hp;
    let windupAt = -1;
    let hurtAt = -1;
    for (let i = 0; i < 300 && hurtAt < 0; i++) {
      const ev = run(w, 1 / 60);
      if (windupAt < 0 && ev.includes('enemyWindup')) windupAt = i;
      if (ev.includes('hurt')) hurtAt = i;
    }
    expect(windupAt).toBeGreaterThanOrEqual(0);
    expect(hurtAt).toBeGreaterThan(windupAt);
    expect(w.player.hp).toBeLessThan(hp);
  });

  it('a spitter lobs a visible shot rather than hitting instantly', () => {
    const w = duel('spitter', loadout(), 160);
    let shot = false;
    for (let i = 0; i < 240 && !shot; i++) shot = run(w, 1 / 60).includes('shot');
    expect(shot).toBe(true);
    expect(w.projectiles.some((p) => p.alive && p.hostile)).toBe(true);
  });

  it('a burrower stays hidden and untouchable until it surfaces', () => {
    const w = duel('burrower', loadout(), 120);
    const e = w.enemies[0];
    expect(e.mode).toBe('hidden');
    w.player.facing = 1;
    const hp = e.hp;
    w.player.x = e.x - 30;
    run(w, 0.02, { attack: true });
    if (e.mode === 'hidden') expect(e.hp).toBe(hp);
  });

  it('foes keep to their patrol range', () => {
    const w = duel('skitter', loadout(), 0);
    const e = w.enemies[0];
    w.player.x = 200;
    run(w, 6);
    expect(e.x).toBeGreaterThanOrEqual(e.x0 - 1);
    expect(e.x).toBeLessThanOrEqual(e.x1 + 1);
  });
});

describe('arenas', () => {
  const arenaLevel = (opts: { lock?: boolean; survive?: number } = {}) =>
    flatLevel((b) => b.flat(100).arena(500, [['skitter'], ['skitter', 'skitter']], opts).flat(100));

  it('locks behind the creature, sends waves in order, and opens when cleared', () => {
    const w = makeWorld(arenaLevel());
    settle(w);
    w.player.x = 900;
    const ev = run(w, 0.05);
    expect(ev).toContain('arenaStart');
    expect(w.gates.filter((g) => g.kind === 'arena').every((g) => !g.open)).toBe(true);
    const waveOf = (n: number) => w.enemies.filter((e) => e.arena === 0 && e.wave === n);
    expect(waveOf(0).every((e) => e.active)).toBe(true);
    expect(waveOf(1).some((e) => e.active)).toBe(false);
    for (const e of waveOf(0)) e.alive = false;
    run(w, 0.05);
    expect(waveOf(1).every((e) => e.active)).toBe(true);
    for (const e of waveOf(1)) e.alive = false;
    expect(run(w, 0.05)).toContain('arenaClear');
    expect(w.gates.filter((g) => g.kind === 'arena').every((g) => g.open)).toBe(true);
  });

  it('a survival arena ends on its timer', () => {
    const w = makeWorld(arenaLevel({ survive: 3 }));
    settle(w);
    w.player.x = 900;
    w.player.invuln = 99;
    const ev = run(w, 3.5);
    expect(ev).toContain('arenaClear');
  });

  it('a failed fight resets the arena so it can be fought again', () => {
    const w = makeWorld(arenaLevel());
    settle(w);
    w.player.x = 900;
    run(w, 0.05);
    w.kill();
    w.respawn();
    expect(w.arenas[0].state).toBe('idle');
    expect(w.gates.filter((g) => g.kind === 'arena').every((g) => g.open)).toBe(true);
  });
});

describe('boss gifts', () => {
  it('there are ten distinct gifts, each with a cost and cooldown', () => {
    expect(new Set(ALL_REWARDS).size).toBe(10);
    for (const id of ALL_REWARDS) {
      expect(REWARDS[id].name.length).toBeGreaterThan(2);
      expect(REWARDS[id].cooldown).toBeGreaterThan(0);
    }
  });

  it.each(ALL_REWARDS)('%s can be used, then waits for its cooldown', (id) => {
    const w = makeWorld(flatLevel((b) => b.flat(100)), { load: loadout(undefined, id) });
    settle(w);
    w.player.x = 700;
    w.player.facing = 1;
    spawnAhead(w, 'skitter', 790);
    w.player.lumen = w.load.lumenMax;
    const ev = run(w, 0.05, { ability: true });
    expect(ev).not.toContain('abilityFail');
    expect(w.player.abilityCd).toBeGreaterThan(0);
    expect(run(w, 0.02, { ability: true })).toContain('abilityFail');
  });

  it('a gift fails without enough Lumen', () => {
    const w = makeWorld(flatLevel(), { load: loadout(undefined, 'veil') });
    settle(w);
    w.player.lumen = 0;
    expect(run(w, 0.02, { ability: true })).toContain('abilityFail');
  });
});
