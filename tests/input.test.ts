import { describe, expect, it } from 'vitest';
import { newIntent } from '../src/game/core/types';
import { G, GestureRecognizer } from '../src/game/input/gestures';

function swipe(g: GestureRecognizer, id: number, x0: number, y0: number, x1: number, y1: number, t0: number, ms = 60, lift = true): void {
  g.down(id, x0, y0, t0);
  for (let i = 1; i <= 4; i++) g.move(id, x0 + ((x1 - x0) * i) / 4, y0 + ((y1 - y0) * i) / 4, t0 + (ms * i) / 4);
  if (lift) g.up(id, x1, y1, t0 + ms + 5);
}

describe('gesture input', () => {
  it('a sideways swipe latches travel in that direction', () => {
    const g = new GestureRecognizer();
    const out = newIntent();
    swipe(g, 1, 100, 400, 180, 404, 0);
    g.read(100, out);
    expect(out.mx).toBe(1);
    expect(out.glow).toBe(false);
    g.read(2000, out);
    expect(out.mx).toBe(1);
    swipe(g, 2, 200, 400, 120, 396, 2100);
    g.read(2300, out);
    expect(out.mx).toBe(-1);
  });

  it('a swipe up jumps once and holds the jump long enough for a healthy leap', () => {
    const g = new GestureRecognizer();
    const out = newIntent();
    swipe(g, 1, 100, 400, 104, 320, 0);
    g.read(70, out);
    expect(out.jump).toBe(true);
    expect(out.jumpHeld).toBe(true);
    g.read(80, out);
    expect(out.jump).toBe(false);
    g.read(60 + G.minJumpHold + 30, out);
    expect(out.jumpHeld).toBe(false);
  });

  it('keeps the jump held while the finger stays down', () => {
    const g = new GestureRecognizer();
    const out = newIntent();
    swipe(g, 1, 100, 400, 100, 320, 0, 60, false);
    g.read(700, out);
    expect(out.jumpHeld).toBe(true);
    g.up(1, 100, 320, 720);
    g.read(730, out);
    expect(out.jumpHeld).toBe(false);
  });

  it('a diagonal swipe sets direction and jumps', () => {
    const g = new GestureRecognizer();
    const out = newIntent();
    swipe(g, 1, 100, 400, 160, 340, 0);
    g.read(80, out);
    expect(out.mx).toBe(1);
    expect(out.jump).toBe(true);
  });

  it('a swipe down stops and crouches or dives', () => {
    const g = new GestureRecognizer();
    const out = newIntent();
    swipe(g, 1, 100, 400, 180, 400, 0);
    swipe(g, 2, 100, 400, 102, 480, 500);
    g.read(600, out);
    expect(out.mx).toBe(0);
    expect(out.my).toBe(1);
    expect(out.down).toBe(true);
  });

  it('holding glows after a short delay and stops on release', () => {
    const g = new GestureRecognizer();
    const out = newIntent();
    g.down(1, 100, 400, 0);
    g.read(G.glowHold - 20, out);
    expect(out.glow).toBe(false);
    g.read(G.glowHold + 10, out);
    expect(out.glow).toBe(true);
    g.up(1, 100, 400, 900);
    g.read(910, out);
    expect(out.glow).toBe(false);
    expect(out.mx).toBe(0);
  });

  it('glow continues through a drag, so the creature can travel while shining', () => {
    const g = new GestureRecognizer();
    const out = newIntent();
    g.down(1, 100, 400, 0);
    g.read(400, out);
    expect(out.glow).toBe(true);
    for (let i = 1; i <= 6; i++) g.move(1, 100 + i * 10, 400, 400 + i * 30);
    g.read(700, out);
    expect(out.glow).toBe(true);
    expect(out.mx).toBe(1);
    expect(out.dash).toBe(false);
  });

  it('a tap stops; a double tap pulses and resumes the previous direction', () => {
    const g = new GestureRecognizer();
    const out = newIntent();
    swipe(g, 1, 100, 400, 180, 400, 0);
    g.down(2, 200, 400, 500);
    g.up(2, 201, 401, 560);
    g.read(570, out);
    expect(out.mx).toBe(0);
    expect(out.pulse).toBe(false);
    g.down(3, 200, 400, 700);
    g.up(3, 200, 400, 760);
    g.read(770, out);
    expect(out.pulse).toBe(true);
    expect(out.mx).toBe(1);
    g.read(780, out);
    expect(out.pulse).toBe(false);
  });

  it('two slow taps are just two stops, not a pulse', () => {
    const g = new GestureRecognizer();
    const out = newIntent();
    g.down(1, 200, 400, 0);
    g.up(1, 200, 400, 60);
    g.down(2, 200, 400, 60 + G.doubleTap + 100);
    g.up(2, 200, 400, 60 + G.doubleTap + 160);
    g.read(1000, out);
    expect(out.pulse).toBe(false);
  });

  it('a second finger releases a pulse without disturbing the first', () => {
    const g = new GestureRecognizer();
    const out = newIntent();
    g.down(1, 100, 400, 0);
    g.read(400, out);
    g.down(2, 300, 500, 420);
    g.up(2, 300, 500, 480);
    g.read(490, out);
    expect(out.pulse).toBe(true);
    expect(out.glow).toBe(true);
  });

  it('a quick flick in the direction of travel dashes', () => {
    const g = new GestureRecognizer();
    const out = newIntent();
    swipe(g, 1, 100, 400, 180, 400, 0);
    g.read(100, out);
    expect(out.dash).toBe(false);
    swipe(g, 2, 100, 400, 190, 400, 300, 50);
    g.read(400, out);
    expect(out.dash).toBe(true);
    expect(out.mx).toBe(1);
  });

  it('cancel drops a held touch but keeps the direction; reset clears everything', () => {
    const g = new GestureRecognizer();
    const out = newIntent();
    swipe(g, 1, 100, 400, 180, 400, 0);
    g.down(2, 100, 400, 200);
    g.read(600, out);
    expect(out.glow).toBe(true);
    g.cancel();
    g.read(700, out);
    expect(out.glow).toBe(false);
    expect(out.mx).toBe(1);
    g.reset();
    g.read(800, out);
    expect(out.mx).toBe(0);
  });

  it('ignores tiny jitters and pointers it does not own', () => {
    const g = new GestureRecognizer();
    const out = newIntent();
    g.down(1, 100, 400, 0);
    g.move(1, 104, 403, 20);
    g.move(9, 400, 100, 30);
    g.up(9, 400, 100, 40);
    g.read(60, out);
    expect(out.mx).toBe(0);
    expect(out.jump).toBe(false);
    expect(g.lastGesture).toBe('none');
  });

  it('the on-screen pulse button fires a pulse', () => {
    const g = new GestureRecognizer();
    const out = newIntent();
    g.pressPulse();
    g.read(10, out);
    expect(out.pulse).toBe(true);
  });
});
