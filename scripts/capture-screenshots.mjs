// Captures store-ready screenshots from the running game into docs/screenshots.
// Usage: npm run build && npm run preview   (in one terminal)
//        npm run screenshots                (in another)   [BASE_URL, SCALE env vars optional]
// Default output is 1290x2796 (iPhone 6.7"), which both stores accept.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs/screenshots');
mkdirSync(out, { recursive: true });
const base = process.env.BASE_URL || 'http://localhost:4173';
const scale = Number(process.env.SCALE || 3);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: scale, hasTouch: true, isMobile: true });
const page = await context.newPage();
await page.goto(base);
await page.waitForFunction(() => Boolean(window.__tide?.ui));
await page.waitForTimeout(2500);
await page.screenshot({ path: join(out, '01-title.png') });
console.log('01-title');

/** Lets the bot play chapter `n` until it passes `x`, then freezes the moment. */
async function scene(name, chapter, x, opts = {}) {
  await page.evaluate((c) => {
    const g = window.__tide;
    g.save.data.currentChapter = 10;
    g.debugSpeed = 1;
    g.playChapter(c, false);
  }, chapter);
  await page.waitForFunction((c) => window.__tide.state === 'playing' && window.__tide.world.level.index === c, chapter);
  await page.evaluate(() => {
    const g = window.__tide;
    g.autoplay(false);
    g.debugSpeed = 6;
    g.hud.hideCard();
  });
  await page.waitForFunction((target) => window.__tide.world.player.x >= target, x, { timeout: 120000, polling: 50 });
  await page.evaluate((o) => {
    const g = window.__tide;
    g.debugSpeed = 0;
    g.hud.hideCard();
    if (o.glow) {
      g.world.player.glowOn = true;
      g.world.player.glow = 1;
    }
  }, opts);
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(out, name) });
  console.log(name.replace('.png', ''));
}

await scene('02-light-makes-a-way.png', 1, 2070, { glow: true });
await scene('03-quiet-mirrors.png', 3, 1900, { glow: true });
await scene('04-green-cathedral.png', 5, 1150);
await scene('05-sunken-stair.png', 7, 2700, { glow: true });
await scene('06-nightfall-surge.png', 9, 1500);
await scene('07-hearthreef.png', 10, 3500, { glow: true });

await page.evaluate(() => {
  const g = window.__tide;
  for (let c = 1; c <= 10; c++) for (const n of [1, 2]) if ((c + n) % 3 !== 0) g.save.data.shells.push(`ch${c < 10 ? '0' : ''}${c}-${n}`);
  g.debugSpeed = 1;
  g.quitToTitle();
});
await page.waitForTimeout(1200);
await page.evaluate(() => window.__tide.ui.push('gallery'));
await page.waitForTimeout(900);
await page.screenshot({ path: join(out, '08-memories.png') });
console.log('08-memories');
await browser.close();
