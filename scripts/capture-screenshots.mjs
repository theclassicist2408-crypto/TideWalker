// Captures store-ready screenshots from the running game into docs/screenshots.
// Usage: npm run build && npm run preview   (in one terminal)
//        npm run screenshots                (in another)   [BASE_URL, SCALE env vars optional]
// Default output is 1290x2796 (iPhone 6.7"), which both stores accept.
import { chromium } from '@playwright/test';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs/screenshots');
mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) if (f.endsWith('.png')) rmSync(join(out, f));
const base = process.env.BASE_URL || 'http://localhost:4173';
const scale = Number(process.env.SCALE || 3);
const ALL = ['dash', 'wall', 'double', 'pulse', 'dive', 'airdash', 'charge', 'glide'];
const GIFTS = ['tidebreaker', 'veil', 'vinehook', 'echo', 'stormstep', 'shield', 'ember', 'bloom', 'void', 'crown'];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: scale, hasTouch: true, isMobile: true });
const page = await context.newPage();
await page.goto(base);
await page.waitForFunction(() => Boolean(window.__tide?.ui));
await page.waitForTimeout(2500);
await page.screenshot({ path: join(out, '01-title.png') });
console.log('01-title');

// A save well into the journey, so the HUD shows gifts and the map shows progress.
await page.evaluate(
  ({ all, gifts }) => {
    const g = window.__tide;
    g.save.completeTutorial();
    g.save.data.unlocked = 100;
    g.save.data.abilities = all;
    for (const [i, id] of ['warden', 'mooneater', 'sovereign', 'choir', 'squall'].entries()) g.save.defeat(id, gifts[i]);
  },
  { all: ALL, gifts: GIFTS },
);

/**
 * Lets the bot play until `until` holds (a JS expression over `w`, the world), then freezes the
 * moment. `rematch` starts at the lantern outside an area's boss.
 */
async function scene(name, start, until) {
  await page.evaluate((s) => {
    const g = window.__tide;
    g.debugSpeed = 1;
    if (s.rematch) g.playRematch(s.area);
    else g.playLevel(s.area, s.level);
  }, start);
  await page.waitForFunction(() => window.__tide.state === 'playing');
  await page.evaluate(() => {
    const g = window.__tide;
    g.autoplay(false);
    g.debugSpeed = 4;
  });
  await page.waitForFunction(`(() => { const w = window.__tide.world; return ${until}; })()`, null, { timeout: 120000, polling: 50 });
  await page.evaluate(() => {
    const g = window.__tide;
    g.debugSpeed = 0;
    g.hud.hideCard();
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(out, name) });
  console.log(name.replace('.png', ''));
}

const near = 'w.enemies.filter((e) => e.active && e.alive && Math.abs(e.x - w.player.x) < 170).length';
await scene('02-shallows-fight.png', { area: 1, level: 3 }, `${near} >= 2`);
await scene('03-warden.png', { area: 1, rematch: true }, 'w.boss && w.boss.mode === "tele"');
await scene('04-kelp-abyss.png', { area: 3, level: 2 }, 'w.player.swim && w.player.x > 900');
await scene('05-storm-reach.png', { area: 5, level: 4 }, 'w.player.x > 1400');
await scene('06-reef-pontiff.png', { area: 6, rematch: true }, 'w.boss && w.boss.phase >= 1 && w.boss.mode === "act"');
await scene('07-sunken-forge.png', { area: 7, level: 3 }, `${near} >= 1`);
await scene('08-tide-king.png', { area: 10, rematch: true }, 'w.boss && w.boss.mode === "act"');

await page.evaluate(() => {
  const g = window.__tide;
  g.debugSpeed = 1;
  g.quitToTitle('areas');
});
await page.waitForTimeout(1500);
await page.screenshot({ path: join(out, '09-the-deep.png') });
console.log('09-the-deep');
await browser.close();
