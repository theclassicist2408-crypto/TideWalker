import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/');
await page.waitForFunction(() => Boolean(window.__tide?.ui));
await page.evaluate(() => { const g = window.__tide; g.save.completeTutorial(); g.save.data.unlocked = 100; g.save.data.abilities = ['dash','wall','double','pulse','dive','airdash','charge','glide']; g.playLevel(3, 2); });
await page.waitForFunction(() => window.__tide.state === 'playing');
await page.evaluate(() => { const g = window.__tide; g.autoplay(false); g.debugSpeed = 4; });
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(2500);
  console.log(JSON.stringify(await page.evaluate(() => { const w = window.__tide.world; return { st: window.__tide.state, x: Math.round(w.player.x), y: Math.round(w.player.y), swim: w.player.swim, water: Math.round(w.waterY), id: w.level.id, fps: Math.round(window.__tide.renderer.stats.fps) }; })));
}
await browser.close();
