/**
 * Procedural sprite atlas. Every sprite in the game is painted here at start-up onto one canvas,
 * so the whole world renders from a single texture (one batch, no downloads, no placeholder art).
 * Sprites are painted in white/neutral tones where the renderer tints them.
 */

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AtlasImage {
  canvas: HTMLCanvasElement;
  frames: Record<string, Frame>;
  /** Pixels per logical unit. */
  scale: number;
}

type Ctx = CanvasRenderingContext2D;
type Painter = (c: Ctx, w: number, h: number) => void;

const TAU = Math.PI * 2;

function radial(c: Ctx, x: number, y: number, r: number, stops: [number, string][]): CanvasGradient {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

function linear(c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

/** Deterministic noise so the atlas is identical on every device. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const painters: Record<string, { w: number; h: number; paint: Painter }> = {
  /** Soft falloff used for every light, halo and mote. */
  soft: {
    w: 128,
    h: 128,
    paint: (c, w, h) => {
      c.fillStyle = radial(c, w / 2, h / 2, w / 2, [
        [0, 'rgba(255,255,255,1)'],
        [0.25, 'rgba(255,255,255,0.62)'],
        [0.55, 'rgba(255,255,255,0.2)'],
        [0.8, 'rgba(255,255,255,0.05)'],
        [1, 'rgba(255,255,255,0)'],
      ]);
      c.fillRect(0, 0, w, h);
    },
  },
  dot: {
    w: 16,
    h: 16,
    paint: (c, w, h) => {
      c.fillStyle = radial(c, w / 2, h / 2, w / 2, [
        [0, 'rgba(255,255,255,1)'],
        [0.5, 'rgba(255,255,255,0.85)'],
        [1, 'rgba(255,255,255,0)'],
      ]);
      c.fillRect(0, 0, w, h);
    },
  },
  spark: {
    w: 32,
    h: 32,
    paint: (c, w, h) => {
      c.translate(w / 2, h / 2);
      c.fillStyle = radial(c, 0, 0, 14, [
        [0, 'rgba(255,255,255,1)'],
        [1, 'rgba(255,255,255,0)'],
      ]);
      for (let i = 0; i < 2; i++) {
        c.beginPath();
        c.moveTo(0, -15);
        c.quadraticCurveTo(1.6, 0, 0, 15);
        c.quadraticCurveTo(-1.6, 0, 0, -15);
        c.fill();
        c.rotate(Math.PI / 2);
      }
      c.beginPath();
      c.arc(0, 0, 3, 0, TAU);
      c.fill();
    },
  },
  streak: {
    w: 6,
    h: 40,
    paint: (c, w, h) => {
      c.fillStyle = linear(c, 0, 0, 0, h, [
        [0, 'rgba(255,255,255,0)'],
        [0.7, 'rgba(255,255,255,0.75)'],
        [1, 'rgba(255,255,255,0)'],
      ]);
      c.fillRect(w / 2 - 0.7, 0, 1.4, h);
    },
  },
  ring: {
    w: 128,
    h: 128,
    paint: (c, w, h) => {
      c.fillStyle = radial(c, w / 2, h / 2, w / 2, [
        [0, 'rgba(255,255,255,0)'],
        [0.72, 'rgba(255,255,255,0)'],
        [0.9, 'rgba(255,255,255,0.9)'],
        [1, 'rgba(255,255,255,0)'],
      ]);
      c.fillRect(0, 0, w, h);
    },
  },
  bubble: {
    w: 16,
    h: 16,
    paint: (c, w, h) => {
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(w / 2, h / 2, 5.5, 0, TAU);
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.8)';
      c.beginPath();
      c.arc(w / 2 - 2, h / 2 - 2, 1.3, 0, TAU);
      c.fill();
    },
  },
  /** The creature: a round, tapered body. Tinted by the renderer with its Lumen colour. */
  body: {
    w: 40,
    h: 40,
    paint: (c, w, h) => {
      c.translate(w / 2, h / 2);
      c.beginPath();
      c.moveTo(13, 1);
      c.bezierCurveTo(13, -9, 4, -13, -4, -11);
      c.bezierCurveTo(-12, -9, -15, -2, -13, 5);
      c.bezierCurveTo(-11, 12, 0, 13, 7, 11);
      c.bezierCurveTo(12, 9, 13, 6, 13, 1);
      c.closePath();
      c.fillStyle = radial(c, 3, -3, 17, [
        [0, '#ffffff'],
        [0.55, '#f1ede6'],
        [1, '#b9b3ae'],
      ]);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.75)';
      c.lineWidth = 1;
      c.stroke();
      // Belly highlight.
      c.fillStyle = 'rgba(255,255,255,0.55)';
      c.beginPath();
      c.ellipse(4, -5, 5, 3, -0.4, 0, TAU);
      c.fill();
    },
  },
  eye: {
    w: 10,
    h: 10,
    paint: (c, w, h) => {
      c.fillStyle = '#141a2e';
      c.beginPath();
      c.ellipse(w / 2, h / 2, 2.4, 3, 0, 0, TAU);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.95)';
      c.beginPath();
      c.arc(w / 2 + 0.8, h / 2 - 1, 0.9, 0, TAU);
      c.fill();
    },
  },
  fin: {
    w: 20,
    h: 14,
    paint: (c, w, h) => {
      c.fillStyle = linear(c, 0, 0, w, 0, [
        [0, 'rgba(255,255,255,0.15)'],
        [1, 'rgba(255,255,255,0.9)'],
      ]);
      c.beginPath();
      c.moveTo(w - 1, h / 2);
      c.quadraticCurveTo(w / 2, -2, 1, 2);
      c.quadraticCurveTo(w / 3, h / 2, 1, h - 2);
      c.quadraticCurveTo(w / 2, h + 2, w - 1, h / 2);
      c.fill();
    },
  },
  /** Shadow-fish body: long, tapered, almost black with a violet rim. Points right. */
  fishBody: {
    w: 84,
    h: 36,
    paint: (c, w, h) => {
      const m = h / 2;
      c.beginPath();
      c.moveTo(w - 2, m + 1);
      c.bezierCurveTo(w - 14, m - 11, w - 40, m - 15, 20, m - 8);
      c.bezierCurveTo(12, m - 6, 6, m - 3, 2, m);
      c.bezierCurveTo(6, m + 3, 14, m + 7, 22, m + 8);
      c.bezierCurveTo(w - 40, m + 13, w - 12, m + 9, w - 2, m + 1);
      c.closePath();
      c.fillStyle = linear(c, 0, 0, w, 0, [
        [0, 'rgba(12,9,26,0.2)'],
        [0.35, '#0d0a1e'],
        [1, '#1a1233'],
      ]);
      c.fill();
      c.strokeStyle = 'rgba(138,96,190,0.5)';
      c.lineWidth = 1;
      c.stroke();
      // Dorsal fin.
      c.fillStyle = '#120d26';
      c.beginPath();
      c.moveTo(w - 30, m - 12);
      c.quadraticCurveTo(w - 44, m - 20, w - 54, m - 11);
      c.closePath();
      c.fill();
    },
  },
  fishSeg: {
    w: 28,
    h: 20,
    paint: (c, w, h) => {
      c.fillStyle = radial(c, w / 2, h / 2, w / 2, [
        [0, '#150f2c'],
        [0.7, 'rgba(16,11,34,0.92)'],
        [1, 'rgba(16,11,34,0)'],
      ]);
      c.beginPath();
      c.ellipse(w / 2, h / 2, w / 2 - 1, h / 2 - 2, 0, 0, TAU);
      c.fill();
    },
  },
  fishTail: {
    w: 30,
    h: 30,
    paint: (c, w, h) => {
      c.fillStyle = linear(c, 0, 0, w, 0, [
        [0, 'rgba(20,14,44,0.1)'],
        [1, '#120d28'],
      ]);
      c.beginPath();
      c.moveTo(w - 1, h / 2);
      c.quadraticCurveTo(w / 2, 4, 1, 1);
      c.quadraticCurveTo(w / 2.4, h / 2, 1, h - 1);
      c.quadraticCurveTo(w / 2, h - 4, w - 1, h / 2);
      c.fill();
    },
  },
  fishEye: {
    w: 14,
    h: 10,
    paint: (c, w, h) => {
      c.fillStyle = radial(c, w / 2, h / 2, w / 2, [
        [0, 'rgba(255,255,255,1)'],
        [0.45, 'rgba(255,255,255,0.9)'],
        [1, 'rgba(255,255,255,0)'],
      ]);
      c.beginPath();
      c.ellipse(w / 2, h / 2, w / 2 - 1, h / 2 - 2.2, 0, 0, TAU);
      c.fill();
    },
  },
  /** Memory Shell: a small spiral of nacre. */
  shell: {
    w: 36,
    h: 36,
    paint: (c, w, h) => {
      c.translate(w / 2, h / 2 + 1);
      c.fillStyle = radial(c, -2, -3, 15, [
        [0, '#fff6ea'],
        [0.6, '#f3c9b3'],
        [1, '#b98aa8'],
      ]);
      c.beginPath();
      c.moveTo(-12, 6);
      c.bezierCurveTo(-14, -8, -2, -15, 8, -10);
      c.bezierCurveTo(15, -6, 15, 5, 8, 9);
      c.bezierCurveTo(1, 12, -8, 11, -12, 6);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(120,70,110,0.55)';
      c.lineWidth = 0.9;
      c.beginPath();
      let a = 0.4;
      let r = 1;
      c.moveTo(2, -1);
      for (let i = 0; i < 46; i++) {
        a += 0.24;
        r += 0.26;
        c.lineTo(2 + Math.cos(a) * r, -1 + Math.sin(a) * r * 0.86);
      }
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.7)';
      c.beginPath();
      c.arc(-3, -3, 7, 3.4, 4.6);
      c.stroke();
    },
  },
  /** Glow plant: dark stalks carrying pale bulbs. Bulbs are a separate sprite so they can dim. */
  plantStalk: {
    w: 36,
    h: 44,
    paint: (c, w, h) => {
      c.strokeStyle = '#1d4a52';
      c.lineCap = 'round';
      c.lineWidth = 2;
      const tips: [number, number][] = [
        [9, 16],
        [18, 6],
        [28, 14],
      ];
      for (const [tx, ty] of tips) {
        c.beginPath();
        c.moveTo(w / 2, h);
        c.quadraticCurveTo(w / 2 + (tx - w / 2) * 0.2, h * 0.5, tx, ty);
        c.stroke();
      }
      c.fillStyle = '#16383f';
      c.beginPath();
      c.ellipse(w / 2, h - 2, 9, 3, 0, 0, TAU);
      c.fill();
    },
  },
  plantBulbs: {
    w: 36,
    h: 44,
    paint: (c) => {
      const tips: [number, number, number][] = [
        [9, 16, 4.2],
        [18, 6, 5.2],
        [28, 14, 4],
      ];
      for (const [tx, ty, r] of tips) {
        c.fillStyle = radial(c, tx - 1, ty - 1, r + 1, [
          [0, '#ffffff'],
          [0.6, 'rgba(235,255,250,0.95)'],
          [1, 'rgba(200,255,240,0)'],
        ]);
        c.beginPath();
        c.arc(tx, ty, r + 1, 0, TAU);
        c.fill();
      }
    },
  },
  urchin: {
    w: 36,
    h: 36,
    paint: (c, w, h) => {
      c.translate(w / 2, h / 2);
      const rnd = seeded(7);
      c.strokeStyle = '#3a2452';
      c.lineWidth = 1.3;
      c.lineCap = 'round';
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * TAU + rnd() * 0.2;
        const len = 12 + rnd() * 5;
        c.beginPath();
        c.moveTo(Math.cos(a) * 5, Math.sin(a) * 5);
        c.lineTo(Math.cos(a) * len, Math.sin(a) * len);
        c.stroke();
      }
      c.fillStyle = radial(c, -2, -2, 9, [
        [0, '#5b3a78'],
        [1, '#1c1230'],
      ]);
      c.beginPath();
      c.arc(0, 0, 8, 0, TAU);
      c.fill();
      c.fillStyle = 'rgba(208,112,200,0.85)';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + 0.5;
        c.beginPath();
        c.arc(Math.cos(a) * 4, Math.sin(a) * 4, 0.9, 0, TAU);
        c.fill();
      }
    },
  },
  /** Tide lantern: a standing stone that holds a flame once passed. */
  lantern: {
    w: 30,
    h: 56,
    paint: (c, w, h) => {
      c.fillStyle = linear(c, 0, 0, w, 0, [
        [0, '#2a3358'],
        [0.5, '#4a5688'],
        [1, '#232b4d'],
      ]);
      c.beginPath();
      c.moveTo(7, h);
      c.lineTo(9, 26);
      c.quadraticCurveTo(4, 22, 6, 14);
      c.quadraticCurveTo(w / 2, -2, w - 6, 14);
      c.quadraticCurveTo(w - 4, 22, w - 9, 26);
      c.lineTo(w - 7, h);
      c.closePath();
      c.fill();
      c.fillStyle = '#0c1024';
      c.beginPath();
      c.ellipse(w / 2, 17, 5, 6.5, 0, 0, TAU);
      c.fill();
      c.strokeStyle = 'rgba(190,205,255,0.5)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(9, 26);
      c.quadraticCurveTo(4, 22, 6, 14);
      c.quadraticCurveTo(w / 2, -2, w - 6, 14);
      c.stroke();
    },
  },
  kelpBlade: {
    w: 16,
    h: 96,
    paint: (c, w, h) => {
      c.fillStyle = linear(c, 0, h, 0, 0, [
        [0, '#06262a'],
        [0.6, '#0e4a48'],
        [1, '#3f9a80'],
      ]);
      c.beginPath();
      c.moveTo(w / 2 - 3, h);
      c.bezierCurveTo(-2, h * 0.7, w + 1, h * 0.4, w / 2, 0);
      c.bezierCurveTo(w + 5, h * 0.42, 3, h * 0.72, w / 2 + 3, h);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(150,240,210,0.25)';
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(w / 2, h);
      c.bezierCurveTo(1, h * 0.7, w, h * 0.4, w / 2, 3);
      c.stroke();
    },
  },
  /** Rock ledge. Stretched horizontally to fit each platform. */
  rock: {
    w: 96,
    h: 22,
    paint: (c, w, h) => {
      c.fillStyle = linear(c, 0, 0, 0, h, [
        [0, '#aab6de'],
        [0.18, '#56618f'],
        [1, '#1a2040'],
      ]);
      c.beginPath();
      c.moveTo(2, 4);
      c.quadraticCurveTo(w / 2, -1, w - 2, 4);
      c.quadraticCurveTo(w, 10, w - 8, h - 3);
      c.quadraticCurveTo(w / 2, h + 2, 8, h - 3);
      c.quadraticCurveTo(0, 10, 2, 4);
      c.closePath();
      c.fill();
      const rnd = seeded(3);
      c.fillStyle = 'rgba(10,14,32,0.28)';
      for (let i = 0; i < 9; i++) {
        c.beginPath();
        c.ellipse(8 + rnd() * (w - 16), 9 + rnd() * 8, 2 + rnd() * 5, 1 + rnd() * 2, 0, 0, TAU);
        c.fill();
      }
    },
  },
  /** Moonglass: a pane of pale crystal that only holds weight in light. */
  moonglass: {
    w: 96,
    h: 18,
    paint: (c, w, h) => {
      c.fillStyle = linear(c, 0, 0, 0, h, [
        [0, 'rgba(255,255,255,0.95)'],
        [0.3, 'rgba(210,240,255,0.7)'],
        [1, 'rgba(160,210,255,0.08)'],
      ]);
      c.beginPath();
      c.moveTo(1, 2);
      c.lineTo(w - 1, 2);
      c.lineTo(w - 9, h - 2);
      c.lineTo(9, h - 2);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(1, 2);
      c.lineTo(w - 1, 2);
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      for (let x = 14; x < w - 8; x += 17) {
        c.beginPath();
        c.moveTo(x, 2);
        c.lineTo(x + 6, h - 2);
        c.stroke();
      }
    },
  },
  crumble: {
    w: 96,
    h: 20,
    paint: (c, w, h) => {
      c.fillStyle = linear(c, 0, 0, 0, h, [
        [0, '#d9c9b8'],
        [0.2, '#8f7f86'],
        [1, '#3a3248'],
      ]);
      c.beginPath();
      c.moveTo(2, 3);
      c.lineTo(w - 2, 3);
      c.lineTo(w - 6, h - 3);
      c.lineTo(w * 0.7, h - 1);
      c.lineTo(w * 0.45, h - 4);
      c.lineTo(w * 0.2, h - 1);
      c.lineTo(6, h - 4);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(20,14,30,0.6)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(w * 0.3, 3);
      c.lineTo(w * 0.36, 9);
      c.lineTo(w * 0.31, h - 3);
      c.moveTo(w * 0.62, 3);
      c.lineTo(w * 0.58, 10);
      c.lineTo(w * 0.66, h - 2);
      c.stroke();
    },
  },
  stone: {
    w: 28,
    h: 26,
    paint: (c, w, h) => {
      c.fillStyle = linear(c, 0, 0, w, h, [
        [0, '#8f86bd'],
        [1, '#231d42'],
      ]);
      c.beginPath();
      c.moveTo(5, 3);
      c.lineTo(w - 6, 1);
      c.lineTo(w - 1, 12);
      c.lineTo(w - 5, h - 2);
      c.lineTo(6, h - 1);
      c.lineTo(1, 13);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(210,200,255,0.4)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(5, 3);
      c.lineTo(w - 6, 1);
      c.stroke();
    },
  },
  /** Bloom gate: a closed coral frond that opens to light. Stretched vertically. */
  bloom: {
    w: 28,
    h: 96,
    paint: (c, w, h) => {
      c.fillStyle = linear(c, 0, 0, w, 0, [
        [0, '#3a2a5c'],
        [0.5, '#7a5aa0'],
        [1, '#2c2048'],
      ]);
      c.beginPath();
      c.moveTo(w / 2, 0);
      c.bezierCurveTo(w + 4, h * 0.2, w - 2, h * 0.7, w / 2 + 5, h);
      c.lineTo(w / 2 - 5, h);
      c.bezierCurveTo(2, h * 0.7, -4, h * 0.2, w / 2, 0);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(255,214,190,0.55)';
      c.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        const y = (h * i) / 6;
        c.beginPath();
        c.moveTo(w / 2 - 7, y);
        c.quadraticCurveTo(w / 2, y - 5, w / 2 + 7, y);
        c.stroke();
      }
      c.fillStyle = 'rgba(255,220,200,0.9)';
      for (let i = 1; i < 6; i++) {
        c.beginPath();
        c.arc(w / 2, (h * i) / 6 - 4, 1.4, 0, TAU);
        c.fill();
      }
    },
  },
  /** Tide gate: a raft of driftwood that floats aside with the water. */
  driftwood: {
    w: 28,
    h: 96,
    paint: (c, w, h) => {
      const rnd = seeded(11);
      for (let i = 0; i < 3; i++) {
        const x = 3 + i * 8;
        c.fillStyle = linear(c, x, 0, x + 7, 0, [
          [0, '#5b4a52'],
          [0.5, '#8a7672'],
          [1, '#392e3c'],
        ]);
        c.beginPath();
        c.roundRect(x, 2 + rnd() * 6, 7, h - 6 - rnd() * 8, 3);
        c.fill();
      }
      c.strokeStyle = 'rgba(30,22,36,0.8)';
      c.lineWidth = 2;
      for (const y of [h * 0.25, h * 0.7]) {
        c.beginPath();
        c.moveTo(2, y);
        c.lineTo(w - 2, y + 2);
        c.stroke();
      }
    },
  },
  grass: {
    w: 32,
    h: 22,
    paint: (c, w, h) => {
      const rnd = seeded(21);
      c.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const x = 3 + (i / 8) * (w - 6);
        const tall = 8 + rnd() * 12;
        c.strokeStyle = `rgba(${150 + rnd() * 60},${190 + rnd() * 50},255,${0.35 + rnd() * 0.4})`;
        c.lineWidth = 1 + rnd() * 0.6;
        c.beginPath();
        c.moveTo(x, h);
        c.quadraticCurveTo(x + (rnd() - 0.5) * 6, h - tall * 0.6, x + (rnd() - 0.5) * 10, h - tall);
        c.stroke();
      }
    },
  },
  pebble: {
    w: 30,
    h: 16,
    paint: (c, w, h) => {
      c.fillStyle = linear(c, 0, 0, 0, h, [
        [0, '#8c9aca'],
        [0.3, '#3a4470'],
        [1, '#141a36'],
      ]);
      c.beginPath();
      c.moveTo(1, h);
      c.quadraticCurveTo(2, 3, 11, 2);
      c.quadraticCurveTo(22, -1, w - 2, 8);
      c.lineTo(w - 1, h);
      c.closePath();
      c.fill();
    },
  },
  coral: {
    w: 40,
    h: 40,
    paint: (c, w, h) => {
      c.strokeStyle = '#b77f9c';
      c.lineCap = 'round';
      const branch = (x: number, y: number, a: number, len: number, d: number): void => {
        if (d === 0 || len < 3) return;
        const nx = x + Math.cos(a) * len;
        const ny = y + Math.sin(a) * len;
        c.lineWidth = d * 0.9;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(nx, ny);
        c.stroke();
        branch(nx, ny, a - 0.5, len * 0.72, d - 1);
        branch(nx, ny, a + 0.45, len * 0.7, d - 1);
      };
      branch(w / 2, h, -Math.PI / 2, 12, 4);
      c.fillStyle = 'rgba(255,226,214,0.9)';
      const rnd = seeded(5);
      for (let i = 0; i < 7; i++) {
        c.beginPath();
        c.arc(6 + rnd() * (w - 12), 4 + rnd() * 18, 1, 0, TAU);
        c.fill();
      }
    },
  },
  /** Broken column for the drowned ruins. */
  column: {
    w: 36,
    h: 150,
    paint: (c, w, h) => {
      c.fillStyle = linear(c, 0, 0, w, 0, [
        [0, '#2a2352'],
        [0.35, '#6c62a6'],
        [0.6, '#4a417e'],
        [1, '#1b1638'],
      ]);
      c.beginPath();
      c.moveTo(6, h);
      c.lineTo(6, 16);
      c.lineTo(3, 14);
      c.lineTo(5, 6);
      c.lineTo(13, 9);
      c.lineTo(19, 2);
      c.lineTo(26, 8);
      c.lineTo(w - 4, 5);
      c.lineTo(w - 3, 14);
      c.lineTo(w - 6, 16);
      c.lineTo(w - 6, h);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(14,10,34,0.4)';
      c.lineWidth = 1;
      for (let x = 11; x < w - 8; x += 5) {
        c.beginPath();
        c.moveTo(x, 18);
        c.lineTo(x, h);
        c.stroke();
      }
      c.fillStyle = 'rgba(20,14,44,0.5)';
      c.fillRect(4, h - 10, w - 8, 10);
    },
  },
  arch: {
    w: 120,
    h: 130,
    paint: (c, w, h) => {
      c.fillStyle = linear(c, 0, 0, 0, h, [
        [0, '#5d5394'],
        [1, '#1b1638'],
      ]);
      c.beginPath();
      c.moveTo(4, h);
      c.lineTo(4, 40);
      c.quadraticCurveTo(w / 2, -30, w - 4, 40);
      c.lineTo(w - 4, h);
      c.lineTo(w - 24, h);
      c.lineTo(w - 24, 52);
      c.quadraticCurveTo(w / 2, 4, 24, 52);
      c.lineTo(24, h);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(200,190,255,0.25)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(4, 40);
      c.quadraticCurveTo(w / 2, -30, w - 4, 40);
      c.stroke();
    },
  },
  /** Rib of a wrecked hull for the storm shore. */
  wreck: {
    w: 110,
    h: 110,
    paint: (c, w, h) => {
      c.strokeStyle = '#27233c';
      c.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const x = 10 + i * 17;
        c.lineWidth = 5 - i * 0.3;
        c.beginPath();
        c.moveTo(x, h);
        c.quadraticCurveTo(x - 10, h * 0.5, x + 14 + i * 2, 12 + i * 9);
        c.stroke();
      }
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(2, h - 6);
      c.quadraticCurveTo(w / 2, h - 16, w - 4, h - 3);
      c.stroke();
      c.strokeStyle = 'rgba(160,175,225,0.22)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(10, h - 2);
      c.quadraticCurveTo(0, h * 0.5, 24, 12);
      c.stroke();
    },
  },
  /** Reef spire with warm windows of light for the sanctuary. */
  spire: {
    w: 60,
    h: 150,
    paint: (c, w, h) => {
      c.fillStyle = linear(c, 0, 0, 0, h, [
        [0, '#6d8ea8'],
        [1, '#12283f'],
      ]);
      c.beginPath();
      c.moveTo(2, h);
      c.bezierCurveTo(8, h * 0.6, 18, h * 0.3, w / 2, 0);
      c.bezierCurveTo(w - 16, h * 0.3, w - 8, h * 0.6, w - 2, h);
      c.closePath();
      c.fill();
      const rnd = seeded(31);
      for (let i = 0; i < 12; i++) {
        const y = 26 + rnd() * (h - 40);
        const half = (y / h) * (w / 2 - 6);
        const x = w / 2 + (rnd() * 2 - 1) * half;
        c.fillStyle = radial(c, x, y, 4, [
          [0, 'rgba(255,236,190,1)'],
          [1, 'rgba(255,200,120,0)'],
        ]);
        c.fillRect(x - 4, y - 4, 8, 8);
      }
    },
  },
  cloud: {
    w: 220,
    h: 80,
    paint: (c, w, h) => {
      const rnd = seeded(41);
      for (let i = 0; i < 16; i++) {
        const x = 30 + rnd() * (w - 60);
        const y = h * 0.55 + (rnd() - 0.5) * 18;
        const r = 16 + rnd() * 24;
        c.fillStyle = radial(c, x, y, r, [
          [0, 'rgba(255,255,255,0.16)'],
          [1, 'rgba(255,255,255,0)'],
        ]);
        c.fillRect(x - r, y - r, r * 2, r * 2);
      }
    },
  },
  vignette: {
    w: 128,
    h: 128,
    paint: (c, w, h) => {
      c.fillStyle = radial(c, w / 2, h / 2, w * 0.72, [
        [0, 'rgba(0,0,0,0)'],
        [0.55, 'rgba(0,0,0,0)'],
        [1, 'rgba(0,0,0,0.85)'],
      ]);
      c.fillRect(0, 0, w, h);
    },
  },
  moon: {
    w: 96,
    h: 96,
    paint: (c, w, h) => {
      c.fillStyle = radial(c, w / 2, h / 2, w / 2, [
        [0, 'rgba(255,255,255,1)'],
        [0.4, 'rgba(255,255,255,1)'],
        [0.44, 'rgba(255,255,255,0.35)'],
        [1, 'rgba(255,255,255,0)'],
      ]);
      c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(150,165,205,0.22)';
      const craters: [number, number, number][] = [
        [40, 40, 6],
        [56, 50, 4],
        [47, 58, 3],
        [58, 36, 2.5],
      ];
      for (const [x, y, r] of craters) {
        c.beginPath();
        c.arc(x, y, r, 0, TAU);
        c.fill();
      }
    },
  },
  white: {
    w: 8,
    h: 8,
    paint: (c, w, h) => {
      c.fillStyle = '#fff';
      c.fillRect(0, 0, w, h);
    },
  },
};

export type SpriteName = keyof typeof painters;

/** Paints the atlas. `scale` is pixels per logical unit (2 keeps sprites sharp on dense screens). */
export function buildAtlas(scale = 2): AtlasImage {
  const pad = 2;
  const sheet = 512;
  const canvas = document.createElement('canvas');
  const frames: Record<string, Frame> = {};
  // Shelf-pack tallest first.
  const names = Object.keys(painters).sort((a, b) => painters[b].h - painters[a].h);
  let x = pad;
  let y = pad;
  let shelf = 0;
  for (const name of names) {
    const p = painters[name];
    if (x + p.w + pad > sheet) {
      x = pad;
      y += shelf + pad;
      shelf = 0;
    }
    frames[name] = { x: x * scale, y: y * scale, w: p.w * scale, h: p.h * scale };
    x += p.w + pad;
    shelf = Math.max(shelf, p.h);
  }
  canvas.width = sheet * scale;
  canvas.height = (y + shelf + pad) * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable');
  for (const name of names) {
    const p = painters[name];
    const f = frames[name];
    ctx.save();
    ctx.beginPath();
    ctx.rect(f.x, f.y, f.w, f.h);
    ctx.clip();
    ctx.translate(f.x, f.y);
    ctx.scale(scale, scale);
    p.paint(ctx, p.w, p.h);
    ctx.restore();
  }
  return { canvas, frames, scale };
}
