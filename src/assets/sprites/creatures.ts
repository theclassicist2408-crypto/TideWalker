/**
 * Body parts for the sea creatures the Tideborn fights. Parts are painted in light neutral tones
 * with their own shading so one part can be tinted into many species (a crab's claw becomes a
 * lobster's or a hermit's). Eyes are painted in colour and never tinted: a glowing red-violet
 * pupil marks every hostile thing.
 */

type Ctx = CanvasRenderingContext2D;
type Painter = { w: number; h: number; paint: (c: Ctx, w: number, h: number) => void };

const TAU = Math.PI * 2;

function grad(c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

function rad(c: Ctx, x: number, y: number, r: number, stops: [number, string][]): CanvasGradient {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

/** Light-to-shadow fill used by every tintable part. */
const SHADE: [number, string][] = [
  [0, '#ffffff'],
  [0.55, '#d4d4dc'],
  [1, '#8a8a98'],
];

const outline = (c: Ctx, alpha = 0.55): void => {
  c.strokeStyle = `rgba(30,16,40,${alpha})`;
  c.lineWidth = 1;
  c.stroke();
};

export const CREATURE_PAINTERS: Record<string, Painter> = {
  /** Domed shell with ridges: crab and lobster carapace. Centre at (w/2, h/2). */
  p_shell: {
    w: 34,
    h: 24,
    paint: (c, w, h) => {
      c.beginPath();
      c.moveTo(2, h - 6);
      c.quadraticCurveTo(2, 2, w / 2, 2);
      c.quadraticCurveTo(w - 2, 2, w - 2, h - 6);
      c.quadraticCurveTo(w / 2, h, 2, h - 6);
      c.fillStyle = rad(c, w * 0.42, h * 0.3, w * 0.6, SHADE);
      c.fill();
      outline(c);
      c.strokeStyle = 'rgba(60,40,70,0.35)';
      for (const k of [0.33, 0.5, 0.67]) {
        c.beginPath();
        c.moveTo(w * k, 5);
        c.quadraticCurveTo(w * k + 2, h * 0.5, w * k, h - 4);
        c.stroke();
      }
      c.fillStyle = 'rgba(255,255,255,0.6)';
      c.beginPath();
      c.ellipse(w * 0.38, 7, 6, 2.4, -0.2, 0, TAU);
      c.fill();
    },
  },
  /** A pincer, hinge at the left, opening to the right. Anchor near (0.15, 0.5). */
  p_claw: {
    w: 24,
    h: 18,
    paint: (c, w, h) => {
      c.fillStyle = grad(c, 0, 0, 0, h, SHADE);
      // Upper jaw.
      c.beginPath();
      c.moveTo(3, h / 2);
      c.quadraticCurveTo(6, 1, w - 2, 3);
      c.quadraticCurveTo(w - 8, 7, 9, h / 2);
      c.closePath();
      c.fill();
      outline(c);
      // Lower jaw.
      c.beginPath();
      c.moveTo(3, h / 2);
      c.quadraticCurveTo(7, h - 1, w - 4, h - 4);
      c.quadraticCurveTo(w - 9, h - 7, 9, h / 2);
      c.closePath();
      c.fill();
      outline(c);
      c.beginPath();
      c.arc(5, h / 2, 4, 0, TAU);
      c.fill();
      outline(c);
    },
  },
  /** A thin jointed leg or stalk, top at the anchor (0.5, 0). */
  p_leg: {
    w: 6,
    h: 16,
    paint: (c, w, h) => {
      c.fillStyle = grad(c, 0, 0, w, 0, SHADE);
      c.beginPath();
      c.roundRect(1.5, 0, 3, h - 1, 1.5);
      c.fill();
      outline(c, 0.4);
      c.fillStyle = 'rgba(60,40,70,0.4)';
      c.fillRect(1.5, h / 2 - 0.5, 3, 1);
    },
  },
  /** Hostile eye: pale ring, glowing red-violet pupil. Never tinted. */
  p_eye: {
    w: 10,
    h: 10,
    paint: (c, w, h) => {
      c.fillStyle = '#f4ecf6';
      c.beginPath();
      c.arc(w / 2, h / 2, 4.2, 0, TAU);
      c.fill();
      c.fillStyle = rad(c, w / 2 + 0.8, h / 2, 3, [
        [0, '#ffd0f4'],
        [0.5, '#d070c8'],
        [1, '#6a1a5a'],
      ]);
      c.beginPath();
      c.arc(w / 2 + 0.8, h / 2, 2.6, 0, TAU);
      c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(w / 2 + 1.6, h / 2 - 1.2, 0.8, 0, TAU);
      c.fill();
    },
  },
  /** Round body with shading: puffer, octopus head. */
  p_round: {
    w: 30,
    h: 30,
    paint: (c, w, h) => {
      c.beginPath();
      c.arc(w / 2, h / 2, w / 2 - 1.5, 0, TAU);
      c.fillStyle = rad(c, w * 0.38, h * 0.32, w * 0.62, SHADE);
      c.fill();
      outline(c);
      c.fillStyle = 'rgba(255,255,255,0.55)';
      c.beginPath();
      c.ellipse(w * 0.36, h * 0.28, 5, 2.6, -0.5, 0, TAU);
      c.fill();
      // Speckles.
      c.fillStyle = 'rgba(70,40,80,0.25)';
      for (const [x, y] of [
        [0.6, 0.55],
        [0.45, 0.7],
        [0.72, 0.38],
        [0.3, 0.55],
      ]) {
        c.beginPath();
        c.arc(w * x, h * y, 1.3, 0, TAU);
        c.fill();
      }
    },
  },
  /** A small cone: puffer spines, anemone tips, crest points. Base at the bottom centre. */
  p_spike: {
    w: 6,
    h: 10,
    paint: (c, w, h) => {
      c.beginPath();
      c.moveTo(0.5, h);
      c.lineTo(w / 2, 0.5);
      c.lineTo(w - 0.5, h);
      c.closePath();
      c.fillStyle = grad(c, 0, 0, 0, h, [
        [0, '#ffffff'],
        [1, '#9a90a8'],
      ]);
      c.fill();
    },
  },
  /** A fan fin, root at the left. */
  p_fin: {
    w: 18,
    h: 16,
    paint: (c, w, h) => {
      c.beginPath();
      c.moveTo(1, h / 2);
      c.quadraticCurveTo(w * 0.6, -1, w - 1, 2);
      c.quadraticCurveTo(w * 0.7, h / 2, w - 1, h - 2);
      c.quadraticCurveTo(w * 0.6, h + 1, 1, h / 2);
      c.fillStyle = grad(c, 0, 0, w, 0, [
        [0, 'rgba(255,255,255,0.95)'],
        [1, 'rgba(200,190,215,0.55)'],
      ]);
      c.fill();
      c.strokeStyle = 'rgba(60,40,70,0.35)';
      c.lineWidth = 0.8;
      for (const k of [0.3, 0.5, 0.7]) {
        c.beginPath();
        c.moveTo(2, h / 2);
        c.lineTo(w - 3, h * k);
        c.stroke();
      }
    },
  },
  /** A ray's wing, root at the bottom left, tip up and out. */
  p_wing: {
    w: 30,
    h: 18,
    paint: (c, w, h) => {
      c.beginPath();
      c.moveTo(1, h - 2);
      c.quadraticCurveTo(w * 0.35, 1, w - 1, 3);
      c.quadraticCurveTo(w * 0.6, h * 0.6, 1, h - 2);
      c.fillStyle = grad(c, 0, h, w, 0, SHADE);
      c.fill();
      outline(c, 0.45);
    },
  },
  /** A rounded segment: eel bodies and tentacles. */
  p_seg: {
    w: 14,
    h: 12,
    paint: (c, w, h) => {
      c.beginPath();
      c.ellipse(w / 2, h / 2, w / 2 - 1, h / 2 - 1, 0, 0, TAU);
      c.fillStyle = rad(c, w * 0.4, h * 0.35, w * 0.6, SHADE);
      c.fill();
      outline(c, 0.4);
    },
  },
  /** A jellyfish bell: translucent dome with a frilled rim. */
  p_bell: {
    w: 32,
    h: 22,
    paint: (c, w, h) => {
      c.beginPath();
      c.moveTo(1, h - 3);
      c.quadraticCurveTo(1, 1, w / 2, 1);
      c.quadraticCurveTo(w - 1, 1, w - 1, h - 3);
      for (let x = w - 1; x > 1; x -= 5) c.quadraticCurveTo(x - 2.5, h + 1, x - 5, h - 3);
      c.closePath();
      c.fillStyle = rad(c, w * 0.45, h * 0.3, w * 0.6, [
        [0, 'rgba(255,255,255,0.95)'],
        [0.6, 'rgba(230,220,245,0.75)'],
        [1, 'rgba(180,170,210,0.55)'],
      ]);
      c.fill();
      outline(c, 0.35);
      c.strokeStyle = 'rgba(255,255,255,0.7)';
      c.beginPath();
      c.ellipse(w / 2, h * 0.55, w * 0.25, h * 0.18, 0, 0, TAU);
      c.stroke();
    },
  },
  /** An anglerfish head: huge upper jaw with teeth. Faces right. */
  p_angler: {
    w: 36,
    h: 28,
    paint: (c, w, h) => {
      c.beginPath();
      c.moveTo(w - 1, h * 0.55);
      c.quadraticCurveTo(w * 0.85, 1, w * 0.35, 3);
      c.quadraticCurveTo(1, 6, 2, h * 0.6);
      c.quadraticCurveTo(w * 0.4, h * 0.62, w - 1, h * 0.55);
      c.fillStyle = rad(c, w * 0.45, h * 0.3, w * 0.6, SHADE);
      c.fill();
      outline(c);
      // Teeth along the jaw line.
      c.fillStyle = '#fffaf0';
      for (let x = w * 0.45; x < w - 3; x += 4) {
        c.beginPath();
        c.moveTo(x, h * 0.58);
        c.lineTo(x + 1.6, h * 0.58 + 4);
        c.lineTo(x + 3.2, h * 0.58);
        c.fill();
      }
    },
  },
  /** The lower jaw that swings open, hinge at the left. */
  p_jaw: {
    w: 26,
    h: 10,
    paint: (c, w, h) => {
      c.beginPath();
      c.moveTo(1, 2);
      c.lineTo(w - 1, 1);
      c.quadraticCurveTo(w * 0.6, h, 1, h - 2);
      c.closePath();
      c.fillStyle = grad(c, 0, 0, 0, h, SHADE);
      c.fill();
      outline(c, 0.45);
      c.fillStyle = '#fffaf0';
      for (let x = 6; x < w - 3; x += 4) {
        c.beginPath();
        c.moveTo(x, 2);
        c.lineTo(x + 1.5, -2);
        c.lineTo(x + 3, 2);
        c.fill();
      }
    },
  },
  /** A spiral shell for the hermit knight. */
  p_spiral: {
    w: 28,
    h: 28,
    paint: (c, w, h) => {
      c.beginPath();
      c.arc(w / 2, h / 2, w / 2 - 1, 0, TAU);
      c.fillStyle = rad(c, w * 0.4, h * 0.35, w * 0.6, SHADE);
      c.fill();
      outline(c);
      c.strokeStyle = 'rgba(70,40,80,0.5)';
      c.lineWidth = 1.4;
      c.beginPath();
      for (let a = 0; a < TAU * 2.4; a += 0.2) {
        const r = 1 + a * 1.7;
        const x = w / 2 + Math.cos(a) * r;
        const y = h / 2 + Math.sin(a) * r;
        if (a === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    },
  },
  /** An anemone petal, base at the bottom. */
  p_petal: {
    w: 10,
    h: 20,
    paint: (c, w, h) => {
      c.beginPath();
      c.moveTo(w / 2, h);
      c.quadraticCurveTo(-1, h * 0.5, w / 2, 1);
      c.quadraticCurveTo(w + 1, h * 0.5, w / 2, h);
      c.fillStyle = grad(c, 0, h, 0, 0, SHADE);
      c.fill();
      outline(c, 0.4);
    },
  },
  /** A long fish body, nose to the right: needlefish and the swordfish knight's torso. */
  p_fish: {
    w: 36,
    h: 14,
    paint: (c, w, h) => {
      c.beginPath();
      c.moveTo(w - 1, h / 2);
      c.quadraticCurveTo(w * 0.6, 0, 2, h * 0.35);
      c.lineTo(2, h * 0.65);
      c.quadraticCurveTo(w * 0.6, h, w - 1, h / 2);
      c.fillStyle = grad(c, 0, 0, 0, h, SHADE);
      c.fill();
      outline(c, 0.45);
      c.strokeStyle = 'rgba(70,40,80,0.35)';
      c.beginPath();
      c.moveTo(6, h / 2);
      c.lineTo(w - 6, h / 2);
      c.stroke();
    },
  },
  /** A long bill or spear point, base at the left. */
  p_bill: {
    w: 26,
    h: 6,
    paint: (c, w, h) => {
      c.beginPath();
      c.moveTo(0.5, 0.5);
      c.lineTo(w - 0.5, h / 2);
      c.lineTo(0.5, h - 0.5);
      c.closePath();
      c.fillStyle = grad(c, 0, 0, w, 0, [
        [0, '#c8c0d4'],
        [1, '#ffffff'],
      ]);
      c.fill();
      outline(c, 0.4);
    },
  },
  /** A squid's mantle: tall, pointed, translucent. Point up. */
  p_mantle: {
    w: 20,
    h: 30,
    paint: (c, w, h) => {
      c.beginPath();
      c.moveTo(w / 2, 1);
      c.quadraticCurveTo(w + 1, h * 0.55, w * 0.8, h - 1);
      c.lineTo(w * 0.2, h - 1);
      c.quadraticCurveTo(-1, h * 0.55, w / 2, 1);
      c.fillStyle = grad(c, 0, 0, w, 0, [
        [0, 'rgba(200,190,230,0.6)'],
        [0.5, 'rgba(255,255,255,0.9)'],
        [1, 'rgba(200,190,230,0.6)'],
      ]);
      c.fill();
      outline(c, 0.3);
    },
  },
};
