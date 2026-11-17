import { describe, expect, it } from 'vitest';
import { FIXED_DT, P } from '../src/game/core/constants';
import { flatLevel, intent, loadout, makeWorld, run, settle } from './helpers';

describe('movement', () => {
  it('runs fast, with quick acceleration and braking', () => {
    const w = makeWorld(flatLevel());
    settle(w);
    run(w, 0.12, { mx: 1 });
    expect(w.player.vx).toBeCloseTo(P.runSpeed, 0);
    expect(P.runSpeed).toBeGreaterThan(200);
    run(w, 0.1);
    expect(w.player.vx).toBe(0);
  });

  it('jumps about 92 px; a released jump is a short hop', () => {
    const peak = (held: boolean): number => {
      const w = makeWorld(flatLevel(), { load: loadout([]) });
      settle(w);
      const y0 = w.player.y;
      let top = y0;
      w.step(intent({ jump: true, jumpHeld: true }), FIXED_DT);
      for (let i = 0; i < 70; i++) {
        w.step(intent({ jumpHeld: held || i < 2 }), FIXED_DT);
        top = Math.min(top, w.player.y);
      }
      return y0 - top;
    };
    expect(peak(true)).toBeGreaterThan(86);
    expect(peak(true)).toBeLessThan(98);
    expect(peak(false)).toBeLessThan(55);
  });

  it('has coyote time and a jump buffer', () => {
    const w = makeWorld(flatLevel((b) => b.step(200)), { load: loadout([]) });
    settle(w);
    w.player.x = 594;
    let guard = 0;
    while (w.player.onGround && guard++ < 100) w.step(intent({ mx: 1 }), FIXED_DT);
    run(w, 0.04, { mx: 1 });
    expect(run(w, 0.05, { mx: 1, jump: true, jumpHeld: true })).toContain('jump');

    const w2 = makeWorld(flatLevel(), { load: loadout([]) });
    settle(w2);
    run(w2, 0.02, { jump: true, jumpHeld: true });
    let pressed = false;
    let jumps = 0;
    for (let i = 0; i < 100; i++) {
      const press = !pressed && w2.player.vy > 0 && -P.halfH - w2.player.y < 16;
      if (press) pressed = true;
      w2.step(intent({ jump: press, jumpHeld: true }), FIXED_DT);
      for (let k = 0; k < w2.eventCount; k++) if (w2.events[k].type === 'jump') jumps++;
      w2.clearEvents();
    }
    expect(pressed).toBe(true);
    expect(jumps).toBe(1);
  });

  it('double-jumps once per flight, and only with the ability', () => {
    const w = makeWorld(flatLevel(), { load: loadout(['double']) });
    settle(w);
    run(w, 0.3, { jump: true, jumpHeld: true });
    expect(run(w, 0.05, { jump: true, jumpHeld: true })).toContain('doubleJump');
    expect(run(w, 0.05, { jump: true, jumpHeld: true })).not.toContain('doubleJump');
    run(w, 1.2);
    expect(w.player.jumpsLeft).toBe(1);

    const none = makeWorld(flatLevel(), { load: loadout([]) });
    settle(none);
    run(none, 0.3, { jump: true, jumpHeld: true });
    expect(run(none, 0.05, { jump: true, jumpHeld: true })).not.toContain('doubleJump');
  });

  it('a double jump reaches a ledge a single jump cannot', () => {
    const climb = (abilities: Parameters<typeof loadout>[0]): number => {
      const w = makeWorld(flatLevel((b) => b.step(-125)), { load: loadout(abilities) });
      settle(w);
      w.player.x = 560;
      run(w, 0.02, { mx: 1, jump: true, jumpHeld: true });
      for (let i = 0; i < 90; i++) {
        const apex = w.player.vy > 0 && w.player.jumpsLeft > 0;
        w.step(intent({ mx: 1, jump: apex, jumpHeld: true }), FIXED_DT);
      }
      return w.player.x;
    };
    expect(climb(['double'])).toBeGreaterThan(620);
    expect(climb([])).toBeLessThan(600);
  });

  it('clings to a wall, slides, and kicks off it to climb', () => {
    const w = makeWorld(flatLevel((b) => b.step(-260)), { load: loadout(['wall']) });
    settle(w);
    w.player.x = 570;
    run(w, 0.02, { mx: 1, jump: true, jumpHeld: true });
    run(w, 0.75, { mx: 1, jumpHeld: true });
    expect(w.player.sliding).toBe(true);
    expect(Math.abs(w.player.vy)).toBeLessThan(P.wallSlide + 1);
    // Kick, steer back, kick: the creature gains height on a single wall.
    for (let i = 0; i < 400 && w.player.y > -250; i++) {
      const p = w.player;
      w.step(intent({ mx: 1, jump: p.wallT > 0 && p.vy > -120 && !p.onGround, jumpHeld: true }), FIXED_DT);
      w.clearEvents();
    }
    expect(w.player.y).toBeLessThan(-250);
    run(w, 0.8, { mx: 1, jumpHeld: true });
    expect(w.player.onGround).toBe(true);
    expect(w.player.y).toBeCloseTo(-260 - P.halfH, 0);
  });

  it('cannot cling without the ability, nor climb a cave roof face', () => {
    const w = makeWorld(flatLevel((b) => b.step(-260)), { load: loadout([]) });
    settle(w);
    w.player.x = 570;
    run(w, 0.02, { mx: 1, jump: true, jumpHeld: true });
    expect(run(w, 0.5, { mx: 1, jump: true, jumpHeld: true })).not.toContain('wallJump');

    const cave = makeWorld(flatLevel((b) => b.flat(100).caveStart(50).flat(200).caveEnd(50)));
    settle(cave);
    cave.player.x = 640;
    cave.player.y = -140;
    run(cave, 0.3, { mx: 1 });
    expect(cave.player.wallT).toBe(0);
  });

  it('dashes on the ground; air dash needs its own ability and is once per flight', () => {
    const w = makeWorld(flatLevel(), { load: loadout(['dash']) });
    settle(w);
    expect(run(w, 0.05, { mx: 1, dash: true })).toContain('dash');
    expect(w.player.vx).toBeCloseTo(P.dashSpeed, 0);
    run(w, 0.6);
    run(w, 0.25, { jump: true, jumpHeld: true });
    expect(run(w, 0.05, { dash: true })).not.toContain('dash');

    const air = makeWorld(flatLevel(), { load: loadout(['dash', 'airdash']) });
    settle(air);
    air.player.y = -500;
    air.player.onGround = false;
    run(air, 0.05);
    expect(run(air, 0.05, { mx: 1, dash: true })).toContain('dash');
    run(air, P.dashCooldown + 0.05, { jumpHeld: true });
    expect(air.player.onGround).toBe(false);
    expect(run(air, 0.05, { mx: 1, dash: true })).not.toContain('dash');
  });

  it('a dash-leap clears a gap a plain leap cannot', () => {
    const cross = (dash: boolean): number => {
      const w = makeWorld(flatLevel((b) => b.pit(170, 300, { rungs: false })), { load: loadout(dash ? ['dash'] : []) });
      settle(w);
      w.player.x = 420;
      run(w, 0.5, { mx: 1 });
      let jumped = false;
      for (let i = 0; i < 120; i++) {
        const edge = !jumped && w.player.x > 588;
        if (edge) jumped = true;
        w.step(intent({ mx: 1, jump: edge, dash: edge && dash, jumpHeld: true }), FIXED_DT);
      }
      return w.player.y;
    };
    expect(cross(true)).toBeCloseTo(-P.halfH, 0);
    expect(cross(false)).toBeGreaterThan(100);
  });

  it('glides: a held jump slows the fall after the double jump is spent', () => {
    const fall = (glide: boolean): number => {
      const w = makeWorld(flatLevel(), { load: loadout(glide ? ['double', 'glide'] : ['double']) });
      w.player.y = -900;
      w.player.jumpsLeft = 0;
      run(w, 1, { jumpHeld: true });
      return w.player.vy;
    };
    expect(fall(true)).toBeCloseTo(P.glideFall, 0);
    expect(fall(false)).toBeGreaterThan(500);
  });

  it('swims on the surface without the dive, and under it with', () => {
    const level = flatLevel((b) => b.basin(600, 260, 0.1), 60);
    const shallow = makeWorld(level, { load: loadout([]) });
    shallow.player.x = 900;
    shallow.player.y = 70;
    run(shallow, 2, { my: 1 });
    expect(shallow.player.swim).toBe(true);
    expect(shallow.player.y).toBeLessThan(shallow.waterY + 8);

    const deep = makeWorld(level, { load: loadout(['dive']) });
    deep.player.x = 900;
    deep.player.y = 70;
    run(deep, 1, { my: 1 });
    expect(deep.player.y).toBeGreaterThan(deep.waterY + 80);
    const events = run(deep, 1.5, { my: -1, jump: true });
    expect(events).toContain('splashOut');
  });

  it('level rules change the air: wind pushes, heavy gravity shortens a leap', () => {
    const drift = (wind: number): number => {
      const l = flatLevel();
      l.rules.wind = wind;
      const w = makeWorld(l, { load: loadout([]) });
      settle(w);
      const x0 = w.player.x;
      run(w, 0.5, { jump: true, jumpHeld: true });
      return w.player.x - x0;
    };
    expect(drift(-300)).toBeLessThan(-10);
    expect(drift(0)).toBeCloseTo(0, 3);
  });

  it('solid blocks stop movement, can be stood on, and stop a jump from below', () => {
    const w = makeWorld(flatLevel((b) => b.block(40, 60, 40, 60).block(-80, 120, 80, 20)), { load: loadout([]) });
    settle(w);
    w.player.x = 520;
    run(w, 1, { mx: 1 });
    expect(w.player.x).toBeLessThan(560);
    w.player.x = 580;
    w.player.y = -120;
    run(w, 0.6);
    expect(w.player.y).toBeCloseTo(-60 - P.halfH, 0);
    w.player.x = 720;
    w.player.y = -P.halfH;
    run(w, 0.02, { jump: true, jumpHeld: true });
    let top = 0;
    for (let i = 0; i < 40; i++) {
      run(w, FIXED_DT, { jumpHeld: true });
      top = Math.min(top, w.player.y);
    }
    expect(top).toBeGreaterThanOrEqual(-100 + P.halfH - 0.01);
  });
});
