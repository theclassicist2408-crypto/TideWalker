/**
 * Memory Shell vignettes: twenty wordless paintings that, in order, tell how the creature
 * was lost and what waits at the end of the shore. Each is drawn on demand onto a square canvas.
 */

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/** Drawing toolkit working in a 100x100 space. */
class Brush {
  constructor(readonly c: Ctx) {}

  sky(top: string, bottom: string): this {
    const g = this.c.createLinearGradient(0, 0, 0, 100);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    this.c.fillStyle = g;
    this.c.fillRect(0, 0, 100, 100);
    return this;
  }

  stars(n: number, seed = 1): this {
    let s = seed * 9301;
    const c = this.c;
    for (let i = 0; i < n; i++) {
      s = (s * 16807) % 2147483647;
      const x = (s % 1000) / 10;
      s = (s * 16807) % 2147483647;
      const y = (s % 600) / 10;
      c.fillStyle = `rgba(255,255,255,${0.25 + ((s >> 4) % 60) / 100})`;
      c.beginPath();
      c.arc(x, y, 0.35 + ((s >> 8) % 4) / 10, 0, TAU);
      c.fill();
    }
    return this;
  }

  glow(x: number, y: number, r: number, colour: string, alpha = 1): this {
    const c = this.c;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, colour);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.globalAlpha = alpha;
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
    c.globalAlpha = 1;
    return this;
  }

  moon(x: number, y: number, r: number): this {
    this.glow(x, y, r * 4, 'rgba(220,230,255,0.35)');
    this.c.fillStyle = '#eef2ff';
    this.c.beginPath();
    this.c.arc(x, y, r, 0, TAU);
    this.c.fill();
    return this;
  }

  /** A tideling: a small warm body with a tail. `dim` paints it unlit. */
  light(x: number, y: number, size: number, dim = false, flip = false): this {
    const c = this.c;
    if (!dim) this.glow(x, y, size * 5, 'rgba(255,220,150,0.55)');
    c.fillStyle = dim ? '#7f93a8' : '#ffe9bd';
    c.beginPath();
    c.ellipse(x, y, size, size * 0.85, 0, 0, TAU);
    c.fill();
    const d = flip ? 1 : -1;
    c.beginPath();
    c.moveTo(x + d * size * 0.8, y);
    c.quadraticCurveTo(x + d * size * 2, y - size * 0.3, x + d * size * 2.6, y + size * 0.6);
    c.quadraticCurveTo(x + d * size * 1.8, y + size * 0.5, x + d * size * 0.8, y + size * 0.5);
    c.fill();
    c.fillStyle = '#1a2038';
    c.beginPath();
    c.arc(x - d * size * 0.35, y - size * 0.15, size * 0.16, 0, TAU);
    c.fill();
    return this;
  }

  sea(y: number, colour: string, amp = 1.2): this {
    const c = this.c;
    c.fillStyle = colour;
    c.beginPath();
    c.moveTo(0, 100);
    for (let x = 0; x <= 100; x += 2) c.lineTo(x, y + Math.sin(x * 0.22) * amp + Math.sin(x * 0.07) * amp);
    c.lineTo(100, 100);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(200,225,255,0.4)';
    c.lineWidth = 0.5;
    c.beginPath();
    for (let x = 0; x <= 100; x += 2) c.lineTo(x, y + Math.sin(x * 0.22) * amp + Math.sin(x * 0.07) * amp);
    c.stroke();
    return this;
  }

  land(points: number[], colour: string): this {
    const c = this.c;
    c.fillStyle = colour;
    c.beginPath();
    c.moveTo(points[0], 100);
    for (let i = 0; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
    c.lineTo(points[points.length - 2], 100);
    c.closePath();
    c.fill();
    return this;
  }

  spire(x: number, base: number, w: number, hgt: number, colour: string, lit = 0): this {
    const c = this.c;
    c.fillStyle = colour;
    c.beginPath();
    c.moveTo(x - w / 2, base);
    c.bezierCurveTo(x - w * 0.3, base - hgt * 0.5, x - w * 0.1, base - hgt * 0.85, x, base - hgt);
    c.bezierCurveTo(x + w * 0.1, base - hgt * 0.85, x + w * 0.3, base - hgt * 0.5, x + w / 2, base);
    c.fill();
    for (let i = 0; i < lit; i++) {
      const t = (i + 1) / (lit + 1);
      this.glow(x + Math.sin(i * 2.4) * w * 0.18 * (1 - t), base - hgt * t * 0.8, 3, 'rgba(255,225,160,0.95)');
    }
    return this;
  }

  column(x: number, base: number, hgt: number, colour: string): this {
    this.c.fillStyle = colour;
    this.c.fillRect(x - 2.5, base - hgt, 5, hgt);
    this.c.fillRect(x - 4, base - hgt, 8, 2);
    return this;
  }

  kelp(x: number, base: number, hgt: number, colour: string, sway = 4): this {
    const c = this.c;
    c.strokeStyle = colour;
    c.lineWidth = 2.2;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x, base);
    c.bezierCurveTo(x + sway, base - hgt * 0.4, x - sway, base - hgt * 0.7, x + sway * 0.5, base - hgt);
    c.stroke();
    return this;
  }

  /** A shadow-fish silhouette with one cold eye. */
  shadow(x: number, y: number, len: number, eye = true): this {
    const c = this.c;
    c.fillStyle = 'rgba(8,6,20,0.92)';
    c.beginPath();
    c.moveTo(x + len / 2, y);
    c.bezierCurveTo(x + len * 0.2, y - len * 0.16, x - len * 0.3, y - len * 0.1, x - len / 2, y);
    c.bezierCurveTo(x - len * 0.3, y + len * 0.1, x + len * 0.2, y + len * 0.14, x + len / 2, y);
    c.fill();
    if (eye) this.glow(x + len * 0.3, y - len * 0.02, 2.4, 'rgba(208,112,200,1)');
    return this;
  }

  rain(n: number): this {
    const c = this.c;
    c.strokeStyle = 'rgba(190,210,255,0.3)';
    c.lineWidth = 0.4;
    for (let i = 0; i < n; i++) {
      const x = (i * 37) % 110;
      const y = (i * 53) % 100;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x - 3, y + 8);
      c.stroke();
    }
    return this;
  }

  wave(x: number, y: number, size: number, colour: string): this {
    const c = this.c;
    c.fillStyle = colour;
    c.beginPath();
    c.moveTo(x - size, 100);
    c.bezierCurveTo(x - size * 0.8, y + size * 0.2, x - size * 0.2, y - size * 0.1, x + size * 0.2, y);
    c.bezierCurveTo(x + size * 0.5, y + size * 0.1, x + size * 0.45, y + size * 0.45, x + size * 0.2, y + size * 0.4);
    c.bezierCurveTo(x + size * 0.5, y + size * 0.7, x + size * 0.9, y + size * 0.8, x + size * 1.1, 100);
    c.closePath();
    c.fill();
    return this;
  }

  ring(x: number, y: number, r: number, alpha: number): this {
    this.c.strokeStyle = `rgba(255,225,160,${alpha})`;
    this.c.lineWidth = 0.6;
    this.c.beginPath();
    this.c.arc(x, y, r, 0, TAU);
    this.c.stroke();
    return this;
  }

  cloud(x: number, y: number, r: number, colour: string): this {
    for (let i = 0; i < 5; i++) this.glow(x + (i - 2) * r * 0.55, y + Math.sin(i * 1.7) * r * 0.2, r, colour, 0.9);
    return this;
  }
}

const NIGHT: [string, string] = ['#0a0f2a', '#2a3a6e'];
const STORM: [string, string] = ['#05070f', '#1b2240'];
const DEEP: [string, string] = ['#04141c', '#0f4a4f'];
const RUIN: [string, string] = ['#0c0922', '#3b2f68'];
const DAWN: [string, string] = ['#0b1838', '#d79c5c'];

const PAINTERS: ((b: Brush) => void)[] = [
  // 1 — Home: the reef full of lights.
  (b) => {
    b.sky(...DAWN).stars(30, 1).sea(70, '#143a55');
    b.spire(22, 76, 22, 46, '#17344e', 4).spire(50, 78, 30, 62, '#12283f', 6).spire(78, 76, 20, 40, '#17344e', 3);
    for (let i = 0; i < 7; i++) b.light(14 + i * 12, 58 + Math.sin(i * 2) * 8, 1.6, false, i % 2 === 0);
  },
  // 2 — Two lights: a great one and a small one.
  (b) => {
    b.sky(...NIGHT).stars(40, 2).moon(76, 22, 6).sea(72, '#12305a');
    b.light(42, 52, 7).light(63, 60, 3, false, true);
  },
  // 3 — Learning to shine.
  (b) => {
    b.sky(...NIGHT).stars(30, 3).sea(74, '#12305a');
    b.light(34, 50, 6.5);
    b.ring(66, 56, 8, 0.6).ring(66, 56, 14, 0.35).ring(66, 56, 20, 0.18).light(66, 56, 3, false, true);
  },
  // 4 — Clouds gather over the reef.
  (b) => {
    b.sky('#070a18', '#3a3f66').sea(72, '#101f3e');
    b.cloud(30, 22, 14, 'rgba(20,24,48,0.9)').cloud(68, 16, 18, 'rgba(14,18,40,0.95)').cloud(50, 32, 12, 'rgba(26,30,58,0.8)');
    b.spire(50, 78, 28, 44, '#0f1e36', 4).light(30, 62, 4).light(40, 66, 2, false, true);
  },
  // 5 — The storm breaks.
  (b) => {
    b.sky(...STORM).rain(60);
    b.wave(40, 28, 46, '#16284e').sea(80, '#0c1834', 2.4);
    b.spire(78, 84, 20, 30, '#0a1428', 2).light(74, 58, 2, false, true);
  },
  // 6 — Scattered.
  (b) => {
    b.sky('#04060f', '#0d1630').rain(30);
    b.sea(20, '#0a1832', 2);
    for (const [x, y] of [
      [18, 40],
      [44, 66],
      [70, 34],
      [84, 74],
      [30, 82],
    ]) {
      b.light(x, y, 1.6, false, x > 50);
    }
  },
  // 7 — Alone on the wrecked shore.
  (b) => {
    b.sky(...STORM).rain(40).sea(74, '#0f1d3c', 1.6);
    b.land([0, 78, 30, 70, 60, 72, 100, 80], '#0b1026');
    b.c.strokeStyle = '#1c2140';
    b.c.lineWidth = 1.6;
    for (let i = 0; i < 5; i++) {
      b.c.beginPath();
      b.c.moveTo(62 + i * 6, 74);
      b.c.quadraticCurveTo(60 + i * 6, 56, 68 + i * 7, 46 + i * 4);
      b.c.stroke();
    }
    b.light(30, 66, 2.6, true);
  },
  // 8 — Someone is searching.
  (b) => {
    b.sky(...NIGHT).stars(36, 8).moon(50, 16, 5).sea(60, '#102a52');
    b.light(12, 72, 2.2, false, true).light(86, 70, 5.5);
    b.ring(86, 70, 12, 0.3).ring(86, 70, 20, 0.14);
  },
  // 9 — What light wakes.
  (b) => {
    b.sky('#060a1c', '#122a4c').sea(30, '#0b2444');
    b.light(50, 44, 3);
    b.shadow(46, 74, 54).shadow(20, 60, 20, false).shadow(80, 62, 22, false);
  },
  // 10 — Be still, be dark.
  (b) => {
    b.sky(...DEEP);
    for (let i = 0; i < 9; i++) b.kelp(10 + i * 10, 100, 60 + (i % 3) * 14, i % 2 ? '#0d3d3f' : '#145652', i % 2 ? 5 : -5);
    b.light(50, 70, 2.6, true);
    b.shadow(56, 36, 44);
  },
  // 11 — Rest in a moon pool.
  (b) => {
    b.sky(...NIGHT).stars(50, 11).moon(50, 20, 7);
    b.land([0, 72, 26, 66, 40, 74, 60, 74, 74, 66, 100, 72], '#131c44');
    b.glow(50, 74, 22, 'rgba(190,235,255,0.7)').light(50, 70, 3);
  },
  // 12 — The drowned city was built for small lights.
  (b) => {
    b.sky(...RUIN).stars(26, 12).sea(64, '#1e2a62');
    for (let i = 0; i < 5; i++) b.column(16 + i * 17, 84, 44 + (i % 2) * 10, '#2a2352');
    for (let i = 0; i < 4; i++) b.glow(24.5 + i * 17, 54, 3.5, 'rgba(255,225,160,0.9)');
    b.light(50, 76, 2.4);
  },
  // 13 — The keepers carried lanterns.
  (b) => {
    b.sky(...RUIN).stars(20, 13);
    b.land([0, 86, 100, 86], '#17123a');
    b.c.fillStyle = '#2c2558';
    b.c.beginPath();
    b.c.moveTo(38, 86);
    b.c.lineTo(42, 44);
    b.c.quadraticCurveTo(50, 22, 58, 44);
    b.c.lineTo(62, 86);
    b.c.fill();
    b.c.fillRect(58, 50, 16, 3);
    b.glow(76, 54, 9, 'rgba(255,225,160,0.95)').light(76, 54, 1.6).light(24, 80, 2.4, false, false);
  },
  // 14 — The sea climbs the stairs.
  (b) => {
    b.sky(...RUIN);
    for (let i = 0; i < 6; i++) {
      b.c.fillStyle = '#231c4a';
      b.c.fillRect(i * 16, 90 - i * 10, 20, 100);
    }
    b.sea(58, 'rgba(30,48,120,0.75)', 1.8).light(78, 34, 2.6);
  },
  // 15 — The Hush.
  (b) => {
    b.sky('#05050f', '#141034');
    b.c.strokeStyle = 'rgba(10,8,24,0.95)';
    b.c.lineWidth = 9;
    b.c.lineCap = 'round';
    b.c.beginPath();
    b.c.moveTo(-5, 70);
    b.c.bezierCurveTo(30, 30, 60, 110, 90, 50);
    b.c.stroke();
    b.glow(88, 52, 3, 'rgba(208,112,200,1)').light(46, 40, 2.4);
  },
  // 16 — Not the only one.
  (b) => {
    b.sky(...DEEP).stars(14, 16);
    for (let i = 0; i < 6; i++) b.kelp(8 + i * 17, 100, 50 + (i % 2) * 20, '#0f4644', 4);
    b.light(40, 56, 3).light(62, 54, 3, false, true).ring(51, 55, 16, 0.25);
  },
  // 17 — Together through the surge.
  (b) => {
    b.sky(...STORM).rain(50).wave(26, 36, 40, '#152650').sea(82, '#0b1632', 2.6);
    b.light(60, 52, 2.6, false, true).light(70, 46, 2.2, false, true).light(80, 54, 2, false, true);
  },
  // 18 — A warm glow on the horizon.
  (b) => {
    b.sky('#0a1430', '#3c4a78').stars(40, 18).glow(84, 66, 34, 'rgba(255,205,130,0.8)').sea(66, '#12305a');
    b.light(18, 62, 2.6, false, true);
  },
  // 19 — They come to meet you.
  (b) => {
    b.sky(...DAWN).stars(20, 19).sea(68, '#165068');
    b.light(16, 60, 2.8, false, true);
    for (let i = 0; i < 9; i++) b.light(50 + (i % 5) * 10, 46 + Math.floor(i / 5) * 16 + Math.sin(i) * 5, 1.8);
  },
  // 20 — Home.
  (b) => {
    b.sky(...DAWN).stars(16, 20).glow(50, 60, 60, 'rgba(255,215,150,0.6)').sea(74, '#186078');
    b.spire(20, 80, 20, 40, '#1c4460', 4).spire(80, 80, 22, 46, '#1c4460', 5);
    b.light(44, 56, 7).light(60, 60, 3.2, false, true).ring(52, 58, 18, 0.5).ring(52, 58, 28, 0.25);
  },
];

export const VIGNETTE_COUNT = PAINTERS.length;

/** Paints vignette `index` (0-based) to fill a square canvas. */
export function paintVignette(canvas: HTMLCanvasElement, index: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || index < 0 || index >= PAINTERS.length) return;
  const size = canvas.width;
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  ctx.scale(size / 100, size / 100);
  PAINTERS[index](new Brush(ctx));
  // Soft vignette edge so every fragment feels like a memory.
  const g = ctx.createRadialGradient(50, 50, 30, 50, 50, 72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(4,6,18,0.75)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 100, 100);
  ctx.restore();
}

/** Maps a shell id like `a03-2` to its vignette index, or -1. */
export function vignetteForShell(id: string): number {
  const m = /^a(\d{2})-(\d)$/.exec(id);
  if (!m) return -1;
  const index = (Number(m[1]) - 1) * 2 + (Number(m[2]) - 1);
  return index >= 0 && index < PAINTERS.length ? index : -1;
}

/** Shell id for vignette `index`. */
export function shellForVignette(index: number): string {
  const area = Math.floor(index / 2) + 1;
  return `a${area < 10 ? '0' : ''}${area}-${(index % 2) + 1}`;
}
