import { describe, expect, it } from 'vitest';
import { DRILL_REPS, DRILLS, P } from '../src/game/core/constants';
import { World } from '../src/game/core/world';
import { getTutorial } from '../src/game/levels';
import { fullLoadout } from '../src/game/levels/progress';
import { flatLevel, loadout, makeWorld, run, settle } from './helpers';

const tutorialWorld = () => makeWorld(flatLevel((b) => b.flat(200).drillGate(['jump', 'strike'], 40)), { mode: 'tutorial', load: loadout() });

describe('training grounds', () => {
  it('the tutorial asks for every move, each behind a gate', () => {
    const t = getTutorial();
    const asked = t.gates.filter((g) => g.kind === 'drill').flatMap((g) => g.drills ?? []);
    expect(new Set(asked)).toEqual(new Set(DRILLS.map((d) => d.id)));
    const gates = t.gates.filter((g) => g.kind === 'drill');
    for (let i = 1; i < gates.length; i++) expect(gates[i].x).toBeGreaterThan(gates[i - 1].x);
    expect(gates.at(-1)!.x).toBeLessThan(t.arenas[0].x0);
  });

  it('a gate stays shut until each of its moves is done twice, then opens', () => {
    const w = tutorialWorld();
    settle(w);
    const g = w.gates.find((x) => x.kind === 'drill')!;
    expect(g.open).toBe(false);
    run(w, 0.02, { jump: true, jumpHeld: true });
    run(w, 1);
    run(w, 0.02, { jump: true, jumpHeld: true });
    run(w, 1);
    expect(w.drills.jump).toBe(DRILL_REPS);
    expect(g.open).toBe(false);
    run(w, 0.02, { attack: true });
    run(w, P.slashCooldown + 0.05);
    const ev = run(w, 0.05, { attack: true });
    expect(ev).toContain('gateOpen');
    expect(g.open).toBe(true);
  });

  it('counts never pass the number asked for, and each count is announced', () => {
    const w = tutorialWorld();
    settle(w);
    let drills = 0;
    for (let i = 0; i < 4; i++) {
      drills += run(w, 0.02, { jump: true, jumpHeld: true }).filter((e) => e === 'drill').length;
      run(w, 1);
    }
    expect(w.drills.jump).toBe(DRILL_REPS);
    expect(drills).toBe(DRILL_REPS);
  });

  it('moves are only counted in the tutorial', () => {
    const w = makeWorld(flatLevel());
    settle(w);
    run(w, 0.02, { jump: true, jumpHeld: true });
    expect(w.drills.jump).toBe(0);
  });

  it('dash on the ground and in the air are separate moves; combos and charged strikes count', () => {
    const w = tutorialWorld();
    settle(w);
    run(w, 0.02, { dash: true, mx: 1 });
    expect(w.drills.dash).toBe(1);
    run(w, 0.6);
    run(w, 0.1, { jump: true, jumpHeld: true });
    run(w, 0.02, { dash: true, mx: -1 });
    expect(w.drills.airdash).toBe(1);
    run(w, 1);
    for (let i = 0; i < 12; i++) run(w, 0.1, { attack: true });
    expect(w.drills.combo).toBeGreaterThanOrEqual(1);
    run(w, 1);
    run(w, P.chargeTime + 0.05, { attackHeld: true });
    run(w, 0.05);
    expect(w.drills.charge).toBe(1);
  });

  it('the healing lesson always leaves something to heal and Essence to heal with', () => {
    const t = getTutorial();
    const w = new World(t, { difficulty: 'gentle', mode: 'tutorial', loadout: fullLoadout() });
    const h = t.hints.find((x) => x.kind === 'heal')!;
    w.player.x = h.x + 20;
    w.player.y = t.groundY[0] - 9;
    w.player.essence = 0;
    run(w, 0.05);
    expect(w.player.hp).toBeLessThan(w.load.hpMax);
    expect(w.player.essence).toBeGreaterThanOrEqual(1);
  });
});
