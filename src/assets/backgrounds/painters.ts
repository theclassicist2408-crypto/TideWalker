import type { BiomeId } from '../../game/core/types';
import { makeRng } from '../../game/core/util';
import { PALETTES, type Palette } from '../data/palettes';

/**
 * Painterly parallax backdrops, generated per biome on canvas. Each layer tiles horizontally
 * (all shapes use whole-number frequencies across the tile) and fades into the biome's fog.
 */

export const LAYER_W = 1024;
export const LAYER_H = 420;

type Ctx = CanvasRenderingContext2D;

function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable');
  return [canvas, ctx];
}

/** Sky gradient with a horizon glow. Stretched to the screen by the renderer. */
export function paintSky(biome: BiomeId): HTMLCanvasElement {
  const pal = PALETTES[biome];
  const [canvas, c] = makeCanvas(64, 512);
  const g = c.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, pal.sky[0]);
  g.addColorStop(0.34, pal.sky[1]);
  g.addColorStop(0.6, pal.sky[2]);
  g.addColorStop(1, pal.fog);
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 512);
  return canvas;
}

/** Periodic ridge line: y offsets for a silhouette that tiles across LAYER_W. */
function ridge(rng: () => number, base: number, amp: number, rough: number): (x: number) => number {
  const terms: [number, number, number][] = [];
  for (let k = 1; k <= 7; k++) terms.push([k, (amp / Math.pow(k, rough)) * (0.5 + rng()), rng() * Math.PI * 2]);
  return (x: number) => {
    let y = base;
    const t = (x / LAYER_W) * Math.PI * 2;
    for (const [k, a, ph] of terms) y -= Math.sin(t * k + ph) * a;
    return y;
  };
}

function fillRidge(c: Ctx, f: (x: number) => number, top: string, bottom: string, peak: number): void {
  const g = c.createLinearGradient(0, peak, 0, LAYER_H);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(0, LAYER_H);
  for (let x = 0; x <= LAYER_W; x += 4) c.lineTo(x, f(x));
  c.lineTo(LAYER_W, LAYER_H);
  c.closePath();
  c.fill();
}

/** Draws `fn` at x and again wrapped, so shapes crossing the tile edge stay seamless. */
function wrapped(c: Ctx, x: number, halfWidth: number, fn: (cx: number) => void): void {
  fn(x);
  if (x - halfWidth < 0) fn(x + LAYER_W);
  if (x + halfWidth > LAYER_W) fn(x - LAYER_W);
  void c;
}

function seaStack(c: Ctx, x: number, baseY: number, w: number, h: number, rng: () => number): void {
  c.beginPath();
  c.moveTo(x - w / 2, baseY);
  let px = x - w / 2;
  const steps = 5;
  for (let i = 1; i <= steps; i++) {
    px = x - w / 2 + (w * 0.42 * i) / steps;
    c.lineTo(px + (rng() - 0.5) * 6, baseY - (h * i) / steps + (rng() - 0.5) * 8);
  }
  c.lineTo(x + w * 0.1, baseY - h * (0.92 + rng() * 0.08));
  for (let i = steps; i >= 0; i--) {
    c.lineTo(x + w / 2 - (w * 0.3 * i) / steps + (rng() - 0.5) * 6, baseY - (h * i) / steps);
  }
  c.closePath();
  c.fill();
}

function tower(c: Ctx, x: number, baseY: number, w: number, h: number, rng: () => number): void {
  c.beginPath();
  c.moveTo(x - w / 2, baseY);
  c.lineTo(x - w / 2 + 2, baseY - h * 0.9);
  // Broken crown.
  let px = x - w / 2 + 2;
  while (px < x + w / 2 - 4) {
    const stepW = 4 + rng() * 8;
    c.lineTo(px, baseY - h * (0.86 + rng() * 0.16));
    px += stepW;
    c.lineTo(px, baseY - h * (0.86 + rng() * 0.16));
  }
  c.lineTo(x + w / 2 - 2, baseY - h * 0.88);
  c.lineTo(x + w / 2, baseY);
  c.closePath();
  c.fill();
}

function aqueduct(c: Ctx, x: number, baseY: number, span: number, h: number, arches: number): void {
  const aw = span / arches;
  c.beginPath();
  c.rect(x, baseY - h, span, h * 0.22);
  for (let i = 0; i <= arches; i++) c.rect(x + i * aw - 5, baseY - h, 10, h);
  c.fill();
  c.save();
  c.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < arches; i++) {
    c.beginPath();
    c.ellipse(x + i * aw + aw / 2, baseY - h * 0.78, aw / 2 - 5, h * 0.2, 0, Math.PI, 0);
    c.fill();
  }
  c.restore();
}

function kelpGiant(c: Ctx, x: number, baseY: number, h: number, sway: number, width: number): void {
  c.beginPath();
  c.moveTo(x - width, baseY);
  c.bezierCurveTo(x - width + sway, baseY - h * 0.35, x - sway, baseY - h * 0.7, x + sway * 0.4, baseY - h);
  c.bezierCurveTo(x - sway + width * 1.6, baseY - h * 0.7, x + width + sway, baseY - h * 0.35, x + width, baseY);
  c.closePath();
  c.fill();
  // Leaves.
  for (let i = 1; i < 7; i++) {
    const t = i / 7;
    const lx = x + Math.sin(t * 3 + sway) * sway * 0.5;
    const ly = baseY - h * t;
    const dir = i % 2 === 0 ? 1 : -1;
    c.beginPath();
    c.moveTo(lx, ly);
    c.quadraticCurveTo(lx + dir * 16, ly - 12, lx + dir * 26, ly - 2);
    c.quadraticCurveTo(lx + dir * 14, ly + 2, lx, ly);
    c.fill();
  }
}

function spire(c: Ctx, x: number, baseY: number, w: number, h: number): void {
  c.beginPath();
  c.moveTo(x - w / 2, baseY);
  c.bezierCurveTo(x - w * 0.36, baseY - h * 0.5, x - w * 0.14, baseY - h * 0.8, x, baseY - h);
  c.bezierCurveTo(x + w * 0.14, baseY - h * 0.8, x + w * 0.36, baseY - h * 0.5, x + w / 2, baseY);
  c.closePath();
  c.fill();
}

function mast(c: Ctx, x: number, baseY: number, h: number, lean: number): void {
  c.save();
  c.translate(x, baseY);
  c.rotate(lean);
  c.fillRect(-2, -h, 4, h);
  c.fillRect(-h * 0.22, -h * 0.82, h * 0.44, 2.5);
  c.fillRect(-h * 0.14, -h * 0.56, h * 0.28, 2);
  c.restore();
}

/** Mixes two #rrggbb colours. */
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number): number => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function lights(c: Ctx, rng: () => number, count: number, yMin: number, yMax: number, colour: string, size: number): void {
  for (let i = 0; i < count; i++) {
    const x = rng() * LAYER_W;
    const y = yMin + rng() * (yMax - yMin);
    const r = size * (0.6 + rng());
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, colour);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/**
 * Paints one parallax layer (0 = farthest, 2 = nearest). The bottom of the canvas is the horizon
 * line; the renderer anchors it there.
 */
export function paintLayer(biome: BiomeId, layer: 0 | 1 | 2): HTMLCanvasElement {
  const pal: Palette = PALETTES[biome];
  const rng = makeRng(biome.length * 977 + layer * 131 + biome.charCodeAt(0) * 17);
  const [canvas, c] = makeCanvas(LAYER_W, LAYER_H);
  const colour = pal.layers[layer];
  const fogMix = [0.55, 0.3, 0.1][layer];
  const top = mix(colour, pal.fog, fogMix * 0.5);
  const bottom = mix(colour, pal.fog, fogMix + 0.25);
  const base = [250, 290, 340][layer];
  const amp = [36, 30, 22][layer];
  const style = pal.style;
  const f = ridge(rng, base, amp, style === 'hills' || style === 'spires' ? 1.5 : 1.05);

  c.fillStyle = top;
  const stamps = [5, 6, 7][layer];
  for (let i = 0; i < stamps; i++) {
    const x = ((i + rng() * 0.7) / stamps) * LAYER_W;
    const by = f(x) + 14;
    const scale = [1, 0.85, 0.7][layer];
    const g = c.createLinearGradient(0, by - 220 * scale, 0, by);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    c.fillStyle = g;
    if (style === 'stacks') {
      if (layer === 1 && i % 3 === 1) wrapped(c, x, 60, (cx) => mast(c, cx, by, 120 + rng() * 50, (rng() - 0.5) * 0.5));
      else {
        const w = (50 + rng() * 70) * scale;
        const h = (90 + rng() * 130) * scale;
        const seed = rng() * 1000;
        wrapped(c, x, w, (cx) => seaStack(c, cx, by, w, h, makeRng(seed)));
      }
    } else if (style === 'hills') {
      const w = (120 + rng() * 120) * scale;
      const h = (60 + rng() * 90) * scale;
      wrapped(c, x, w, (cx) => spire(c, cx, by, w, h));
    } else if (style === 'kelp') {
      const h = (150 + rng() * 150) * scale;
      const sway = (rng() - 0.5) * 50;
      const width = (3 + layer * 2 + rng() * 3) * 1;
      wrapped(c, x, 60, (cx) => kelpGiant(c, cx, LAYER_H, h + (LAYER_H - by), sway, width));
    } else if (style === 'ruins') {
      if (layer === 0 && i % 2 === 0) {
        const span = 200 + rng() * 100;
        const h = 90 + rng() * 40;
        wrapped(c, x, span, (cx) => aqueduct(c, cx - span / 2, by, span, h, 4));
      } else {
        const w = (26 + rng() * 34) * scale;
        const h = (110 + rng() * 150) * scale;
        const seed = rng() * 1000;
        wrapped(c, x, w, (cx) => tower(c, cx, by, w, h, makeRng(seed)));
      }
    } else {
      const w = (60 + rng() * 60) * scale;
      const h = (120 + rng() * 170) * scale;
      wrapped(c, x, w, (cx) => spire(c, cx, by, w, h));
    }
  }

  fillRidge(c, f, top, bottom, base - amp * 2);

  if (biome === 'throne') lights(c, rng, 26 + layer * 10, base - 150, LAYER_H - 20, 'rgba(255,224,160,0.9)', 5 - layer);
  if (biome === 'forge') lights(c, rng, 10 + layer * 6, base - 100, LAYER_H - 20, 'rgba(255,150,80,0.55)', 5);
  if (biome === 'coral') lights(c, rng, 12, base - 120, LAYER_H - 30, 'rgba(255,170,200,0.45)', 4);
  if (style === 'hills' && layer === 2) lights(c, rng, 14, base - 20, LAYER_H - 30, 'rgba(190,240,255,0.5)', 4);
  if (style === 'kelp') lights(c, rng, 10 + layer * 4, 80, LAYER_H - 30, 'rgba(140,255,214,0.4)', 4);
  if (style === 'ruins' && layer > 0) lights(c, rng, 6, base - 120, base, 'rgba(200,184,255,0.45)', 4);

  // Mist pooling at the foot of each layer.
  const mist = c.createLinearGradient(0, base - 30, 0, LAYER_H);
  mist.addColorStop(0, 'rgba(255,255,255,0)');
  mist.addColorStop(1, mix(pal.fog, '#ffffff', 0.06).replace('rgb', 'rgba').replace(')', `,${[0.5, 0.36, 0.2][layer]})`));
  c.fillStyle = mist;
  c.fillRect(0, base - 30, LAYER_W, LAYER_H - base + 30);
  // The texture tiles vertically too; keep the last rows empty so they cannot bleed into the top edge.
  c.clearRect(0, LAYER_H - 3, LAYER_W, 3);
  return canvas;
}
