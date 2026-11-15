import { expect, test } from './support';

/** Runs on small phone, phone, large phone, tablet and desktop viewports. */
test.describe('layout and accessibility across devices', () => {
  test('title fits the screen with comfortable touch targets', async ({ page, game }) => {
    void game;
    const view = page.viewportSize();
    if (!view) throw new Error('no viewport');
    const title = await page.locator('h1').boundingBox();
    expect(title && title.x).toBeGreaterThanOrEqual(0);
    expect(title && title.x + title.width).toBeLessThanOrEqual(view.width);
    const buttons = page.locator('.title-screen button');
    const n = await buttons.count();
    expect(n).toBe(7);
    let lastBottom = 0;
    for (let i = 0; i < n; i++) {
      const box = await buttons.nth(i).boundingBox();
      if (!box) throw new Error('button not laid out');
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(view.width + 0.5);
      expect(box.y + box.height).toBeLessThanOrEqual(view.height + 0.5);
      lastBottom = Math.max(lastBottom, box.y + box.height);
    }
    expect(lastBottom).toBeGreaterThan(view.height * 0.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('HUD controls are large, on screen and never overlap', async ({ page, game }) => {
    await game.run((g) => g.playChapter(1, false));
    await page.waitForFunction(() => (window as never as { __tide: { state: string } }).__tide.state === 'playing');
    await expect(page.locator('.hud.on')).toBeVisible();
    const view = page.viewportSize();
    if (!view) throw new Error('no viewport');
    const boxes: { x: number; y: number; width: number; height: number }[] = [];
    for (const sel of ['.hud-pause', '.hud-pulse', '.hud-top']) {
      const b = await page.locator(sel).boundingBox();
      if (!b) throw new Error(`${sel} missing`);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(view.width);
      expect(b.y + b.height).toBeLessThanOrEqual(view.height);
      boxes.push(b);
    }
    expect(boxes[0].width).toBeGreaterThanOrEqual(48);
    expect(boxes[1].width).toBeGreaterThanOrEqual(60);
    for (let i = 0; i < boxes.length; i++) {
      for (let k = i + 1; k < boxes.length; k++) {
        const a = boxes[i];
        const b = boxes[k];
        const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
        expect(apart).toBe(true);
      }
    }
    // The creature is always in view and above the pulse button's row.
    const cam = await game.run((g) => ({ left: g.renderer.camera.left, top: g.renderer.camera.top, w: g.renderer.camera.viewW, h: g.renderer.camera.viewH, px: g.world.player.x, py: g.world.player.y }));
    expect(cam.px).toBeGreaterThan(cam.left);
    expect(cam.px).toBeLessThan(cam.left + cam.w);
    expect(cam.py).toBeGreaterThan(cam.top + cam.h * 0.3);
    expect(cam.py).toBeLessThan(cam.top + cam.h * 0.85);
    expect(cam.w).toBeGreaterThanOrEqual(399);
  });

  test('settings stay usable at the largest text size', async ({ page, game }) => {
    await game.run((g) => {
      g.save.updateSettings({ textScale: 1.4 });
      g.settingsChanged();
      g.ui.push('settings');
    });
    await expect(page.locator('.settings')).toBeVisible();
    const view = page.viewportSize();
    if (!view) throw new Error('no viewport');
    const rows = page.locator('.settings .row');
    const n = await rows.count();
    expect(n).toBeGreaterThanOrEqual(9);
    for (let i = 0; i < n; i++) {
      const b = await rows.nth(i).boundingBox();
      if (!b) continue;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(view.width + 0.5);
    }
    for (const control of await page.locator('.settings .switch, .settings .segment button').all()) {
      const b = await control.boundingBox();
      expect(b && b.height).toBeGreaterThanOrEqual(44);
    }
    // The list scrolls to its last control.
    await page.getByRole('button', { name: 'Reset progress' }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Reset progress' })).toBeInViewport();
  });

  test('text has strong contrast against the panels', async ({ page, game }) => {
    await game.run((g) => g.ui.push('settings'));
    await expect(page.locator('.settings')).toBeVisible();
    const ratios = await page.evaluate(() => {
      const lum = (c: number[]): number => {
        const [r, g, b] = c.map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const parse = (s: string): number[] => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      // Panels are a translucent wash over a dark scene; measure against the darkest panel colour.
      const bg = [6, 10, 28];
      const out: number[] = [];
      for (const sel of ['.row > span', '.row small', '.settings h4', '.note', '.screen-head h2']) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const fg = parse(getComputedStyle(el).color);
        const a = lum(fg) + 0.05;
        const b = lum(bg) + 0.05;
        out.push(a > b ? a / b : b / a);
      }
      return out;
    });
    expect(ratios.length).toBe(5);
    for (const r of ratios) expect(r).toBeGreaterThanOrEqual(4.5);
  });

  test('reduced motion and colour-independent cues', async ({ page, game }) => {
    await game.run((g) => {
      g.save.updateSettings({ reducedMotion: true });
      g.settingsChanged();
      g.playChapter(1, false);
    });
    await page.waitForFunction(() => (window as never as { __tide: { state: string } }).__tide.state === 'playing');
    await game.run((g) => g.renderer.camera.shake(1));
    await page.waitForTimeout(100);
    const shake = await game.run((g) => Math.abs(g.renderer.camera.shakeX) + Math.abs(g.renderer.camera.shakeY));
    expect(shake).toBe(0);
    // Low Lumen is shown by a thinner ring and a pulsing core, not by colour alone.
    await game.run((g) => (g.world.player.lumen = 8));
    await expect(page.locator('.hud-orb.low')).toBeVisible();
    const cue = await page.evaluate(() => {
      const ring = document.querySelector('.hud-orb .value');
      const core = document.querySelector('.orb-core');
      return { width: ring ? getComputedStyle(ring).strokeWidth : '', anim: core ? getComputedStyle(core).animationName : '' };
    });
    expect(cue.width).toBe('2px');
    expect(cue.anim).toBe('orb-low');
    // Switches show state by position as well as colour.
    await game.run((g) => g.pause());
    await page.getByRole('button', { name: 'Settings' }).click();
    const sw = page.getByRole('switch', { name: 'Reduced motion' });
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(await sw.locator('i').evaluate((el) => getComputedStyle(el).transform)).not.toBe('none');
  });
});
