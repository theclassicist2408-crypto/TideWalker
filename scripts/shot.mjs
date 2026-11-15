// Dev helper: node scripts/shot.mjs <outPrefix> <url> <js> <waitMs> [<js> <waitMs> ...]
// Evaluates each snippet in the page, waits, then saves a screenshot.
import { chromium } from '@playwright/test';

const [, , out, url, ...snippets] = process.argv;
const width = Number(process.env.W || 390);
const height = Number(process.env.H || 844);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(url);
await page.waitForFunction(() => Boolean(window.__tide?.world), null, { timeout: 15000 });
let i = 0;
for (let k = 0; k < snippets.length; k += 2) {
  const result = await page.evaluate(snippets[k]);
  if (result !== undefined && result !== null) console.log(`[${i}]`, JSON.stringify(result));
  await page.waitForTimeout(Number(snippets[k + 1] || 150));
  await page.screenshot({ path: `${out}-${i}.png` });
  i++;
}
if (errors.length) console.log('CONSOLE:\n' + errors.join('\n'));
await browser.close();
