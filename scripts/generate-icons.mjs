// Renders public/icon.svg into the PNG icons the web manifest and native wrappers need.
// Run: npm run icons   (uses the Chromium that Playwright already installs; no extra dependency)
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'public/icon.svg'), 'utf8');
const out = join(root, 'public/icons');
mkdirSync(out, { recursive: true });

// name, size, padding fraction (maskable icons keep the art inside the safe zone)
const targets = [
  ['icon-180.png', 180, 0],
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['icon-1024.png', 1024, 0],
  ['icon-maskable-512.png', 512, 0.1],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, pad] of targets) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * (1 - pad * 2));
  await page.setContent(
    `<body style="margin:0;background:#070b1c;display:grid;place-items:center;width:${size}px;height:${size}px">
       <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
     </body>`,
  );
  await page.screenshot({ path: join(out, name), clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', name);
}
await browser.close();
