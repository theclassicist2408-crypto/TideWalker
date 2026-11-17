import { expect, test } from './support';

type Box = { x: number; y: number; width: number; height: number };
const apart = (a: Box, b: Box): boolean => a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
/** Pad buttons are round: they are apart when their circles are. */
const circlesApart = (a: Box, b: Box): boolean => Math.hypot(a.x + a.width / 2 - b.x - b.width / 2, a.y + a.height / 2 - b.y - b.height / 2) >= (a.width + b.width) / 2;

/** Runs on small phone, phone, large phone, tablet and desktop viewports. */
test.describe('layout and accessibility across devices', () => {
  test('title fits the screen with comfortable touch targets', async ({ page, game }) => {
    void game;
    const view = page.viewportSize()!;
    const buttons = page.locator('.title-screen button');
    const n = await buttons.count();
    expect(n).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < n; i++) {
      const box = (await buttons.nth(i).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(view.width + 0.5);
      expect(box.y + box.height).toBeLessThanOrEqual(view.height + 0.5);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('the pad, pause and HUD are on screen, large, and never overlap', async ({ page, game }) => {
    await game.skipTutorial();
    await game.run((g) => g.playLevel(1, 1));
    await game.waitState('playing');
    const view = page.viewportSize()!;
    // A mouse and keyboard need no pad; it is hidden on desktop.
    const touch = await page.locator('.pad-buttons').isVisible();
    const selectors = ['.hud-pause', '.hud-top', ...(touch ? ['jump', 'attack', 'dash', 'light', 'heal'].map((b) => `.pad-btn[data-btn="${b}"]`) : [])];
    const boxes: Box[] = [];
    for (const sel of selectors) {
      const b = (await page.locator(sel).boundingBox())!;
      expect(b, sel).not.toBeNull();
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(view.width + 0.5);
      expect(b.y + b.height).toBeLessThanOrEqual(view.height + 0.5);
      if (sel.startsWith('.pad-btn') || sel === '.hud-pause') expect(Math.min(b.width, b.height), sel).toBeGreaterThanOrEqual(44);
      boxes.push(b);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let k = i + 1; k < boxes.length; k++) {
        const round = selectors[i].startsWith('.pad-btn') && selectors[k].startsWith('.pad-btn');
        expect(round ? circlesApart(boxes[i], boxes[k]) : apart(boxes[i], boxes[k]), `${selectors[i]} vs ${selectors[k]}`).toBe(true);
      }
    }
    const cam = await game.run((g) => ({ left: g.renderer.camera.left, top: g.renderer.camera.top, w: g.renderer.camera.viewW, h: g.renderer.camera.viewH, px: g.world.player.x, py: g.world.player.y }));
    expect(cam.px).toBeGreaterThan(cam.left);
    expect(cam.px).toBeLessThan(cam.left + cam.w);
    expect(cam.py).toBeGreaterThan(cam.top);
    expect(cam.py).toBeLessThan(cam.top + cam.h);
  });

  test('a guardian shows its name and health bar', async ({ page, game }) => {
    await game.run((g) => {
      g.save.completeTutorial();
      g.save.data.abilities = ['dash', 'wall'];
      g.save.defeat('warden', 'tidebreaker');
      g.playRematch(1);
    });
    await game.waitState('playing');
    await game.autoplay(4);
    await expect(page.locator('.hud-boss.on')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.hud-boss')).toContainText('Warden');
    const b = (await page.locator('.hud-boss').boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(page.viewportSize()!.width + 0.5);
  });

  test('settings stay usable at the largest text size', async ({ page, game }) => {
    await game.run((g) => {
      g.save.updateSettings({ textScale: 1.4 });
      g.settingsChanged();
      g.ui.push('settings');
    });
    await expect(page.locator('.settings')).toBeVisible();
    const view = page.viewportSize()!;
    const rows = page.locator('.settings .row');
    const n = await rows.count();
    expect(n).toBeGreaterThanOrEqual(8);
    for (let i = 0; i < n; i++) {
      const b = await rows.nth(i).boundingBox();
      if (!b) continue;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(view.width + 0.5);
    }
  });

  test('every button has an accessible name', async ({ page, game }) => {
    await game.skipTutorial();
    for (const screen of ['title', 'areas', 'settings', 'gallery']) {
      await game.run(new Function('g', `g.ui.show(${JSON.stringify(screen)})`) as (g: unknown) => void);
      await page.waitForTimeout(150);
      const unnamed = await page.evaluate(() =>
        [...document.querySelectorAll('#ui button')].filter((b) => !(b.getAttribute('aria-label') || b.textContent?.trim())).length,
      );
      expect(unnamed, screen).toBe(0);
    }
  });
});
