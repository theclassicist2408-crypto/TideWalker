import { expect, test } from './support';

test.describe('first launch and touch controls', () => {
  test('boots to the title with a live scene and no errors', async ({ game, page }) => {
    await expect(page.locator('h1')).toHaveText('Tidewalker');
    await expect(page.locator('.title-screen .btn.primary')).toHaveText('Begin');
    const s = await game.snapshot();
    expect(s.state).toBe('title');
    expect(s.mode).toBe('title');
    const t0 = s.time;
    await page.waitForTimeout(600);
    // The backdrop behind the menu is a living scene, not a still image.
    const later = await game.snapshot();
    expect(later.time).toBeGreaterThan(t0);
    expect(later.state).toBe('title');
    const canvas = await page.locator('canvas.game-canvas').boundingBox();
    expect(canvas?.width).toBe(page.viewportSize()?.width);
  });

  test('Begin starts chapter 1 with a title card and a gesture hint', async ({ game, page }) => {
    await game.begin();
    const s = await game.snapshot();
    expect(s.level).toBe('ch01');
    await expect(page.locator('.hud-card.on h2')).toHaveText('Wreckwash');
    await expect(page.locator('.hud-hint.on')).toBeVisible();
    await expect(page.locator('.hud-hint .hint-label')).toHaveText('swipe');
  });

  test('swipe to travel, tap to stop', async ({ game, page }) => {
    await game.begin();
    await page.waitForTimeout(700);
    const before = await game.snapshot();
    await game.swipe(120, 600, 230, 604);
    await page.waitForTimeout(900);
    const moving = await game.snapshot();
    expect(moving.x).toBeGreaterThan(before.x + 60);
    expect(moving.vx).toBeGreaterThan(100);
    // The hint goes away once the action has been performed, and stays learned.
    await expect(page.locator('.hud-hint.on')).toHaveCount(0);
    await game.tapCanvas(200, 600);
    await page.waitForTimeout(500);
    expect((await game.snapshot()).vx).toBe(0);
    expect((await game.saved()).tutorial).toMatchObject({ move: true });
  });

  test('swipe up leaps', async ({ game, page }) => {
    await game.begin();
    await page.waitForTimeout(700);
    const watching = game.watch(2500);
    await game.swipe(200, 620, 204, 520, 70);
    expect((await watching).rise).toBeGreaterThan(40);
    expect((await game.snapshot()).onGround).toBe(true);
  });

  test('hold to glow, release to go dark; glowing spends Lumen', async ({ game, page }) => {
    await game.begin();
    await page.waitForTimeout(600);
    const before = await game.snapshot();
    expect(before.glowOn).toBe(false);
    await game.hold(200, 600, 1200);
    const lit = await game.snapshot();
    expect(lit.glowOn).toBe(true);
    expect(lit.lumen).toBeLessThan(before.lumen);
    await expect(page.locator('.hud-orb.glow')).toBeVisible();
    await game.release();
    await page.waitForTimeout(200);
    expect((await game.snapshot()).glowOn).toBe(false);
  });

  test('double tap and the pulse button both release a Lumen Pulse', async ({ game, page }) => {
    await game.begin();
    await page.waitForTimeout(600);
    await game.doubleTap(200, 600);
    await page.waitForTimeout(250);
    const first = await game.snapshot();
    expect(first.pulseCd).toBeGreaterThan(0);
    await page.waitForTimeout(3200);
    expect((await game.snapshot()).pulseCd).toBe(0);
    await page.locator('.hud-pulse').tap();
    await page.waitForTimeout(300);
    expect((await game.snapshot()).pulseCd).toBeGreaterThan(0);
  });

  test('a second finger pulses while the first keeps glowing', async ({ game, page }) => {
    await game.begin();
    await page.waitForTimeout(600);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y: 600, id: 0 }] });
    await page.waitForTimeout(500);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y: 600, id: 0 }, { x: 300, y: 500, id: 1 }] });
    await page.waitForTimeout(120);
    const s = await game.snapshot();
    expect(s.glowOn).toBe(true);
    expect(s.pulseCd).toBeGreaterThan(0);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  });
});

test.describe('pause, resume and interruptions', () => {
  test('pause button freezes the world; resume continues it', async ({ game, page }) => {
    await game.begin();
    await page.waitForTimeout(500);
    await page.locator('.hud-pause').tap();
    await expect(page.locator('.screen.in h2')).toHaveText('Wreckwash');
    const a = await game.snapshot();
    expect(a.state).toBe('paused');
    await page.waitForTimeout(500);
    expect((await game.snapshot()).time).toBe(a.time);
    await page.getByRole('button', { name: 'Resume' }).tap();
    await page.waitForTimeout(500);
    const b = await game.snapshot();
    expect(b.state).toBe('playing');
    expect(b.time).toBeGreaterThan(a.time);
  });

  test('backgrounding the app pauses automatically and keeps the latched direction off', async ({ game, page }) => {
    await game.begin();
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect((await game.snapshot()).state).toBe('paused');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
    const s = await game.snapshot();
    expect(s.state).toBe('paused');
    expect(await game.run((g) => g.audio.state)).not.toBe('suspended');
  });

  test('rotating or resizing keeps the game filling the screen', async ({ game, page }) => {
    await game.begin();
    await page.setViewportSize({ width: 851, height: 393 });
    await page.waitForTimeout(400);
    let box = await page.locator('canvas.game-canvas').boundingBox();
    expect(box?.width).toBe(851);
    await expect(page.locator('#rotate')).toBeVisible();
    await page.setViewportSize({ width: 393, height: 851 });
    await page.waitForTimeout(400);
    box = await page.locator('canvas.game-canvas').boundingBox();
    expect(box?.width).toBe(393);
    await expect(page.locator('#rotate')).toBeHidden();
    expect((await game.snapshot()).status).toBe('playing');
  });

  test('audio unlocks on the first touch and reports a running mix', async ({ game }) => {
    expect(await game.run((g) => g.audio.state)).toBe('locked');
    await game.begin();
    expect(await game.run((g) => g.audio.state)).toBe('running');
    await game.page.waitForTimeout(600);
    const mix = await game.run((g) => g.audio.mix);
    expect(mix.explore).toBeGreaterThan(0);
    expect(mix.rain).toBeGreaterThan(0);
  });
});

test.describe('failure, checkpoints and completion', () => {
  test('being caught shows the retry screen and returns to the last lantern', async ({ game, page }) => {
    await game.begin();
    await game.autoplay(6);
    await page.waitForFunction(() => (window as never as { __tide: { world: { checkpointIndex: number } } }).__tide.world.checkpointIndex >= 0, null, { timeout: 60_000 });
    await game.run((g) => {
      g.bot = null;
      g.debugSpeed = 1;
      g.world.fail('swept');
    });
    await expect(page.locator('.retry-screen.in h2')).toHaveText('The tide carried you back');
    const cp = await game.run((g) => g.world.checkpoints[g.world.checkpointIndex].x);
    await page.getByRole('button', { name: 'Rise again' }).tap();
    await page.waitForTimeout(400);
    const s = await game.snapshot();
    expect(s.state).toBe('playing');
    expect(Math.abs(s.x - cp)).toBeLessThan(40);
    expect((await game.saved()).checkpoint).toMatchObject({ chapter: 1 });
  });

  test('a whole chapter: play, complete, save, continue to the next', async ({ game, page }) => {
    await game.begin();
    await game.autoplay(8);
    await expect(page.locator('.screen.in .eyebrow')).toHaveText('Chapter I', { timeout: 90_000 });
    await expect(page.locator('.screen.in h2')).toHaveText('Wreckwash');
    await expect(page.locator('.shell-row .pip.got')).toHaveCount(2);
    const saved = await game.saved();
    expect(saved.currentChapter).toBe(2);
    expect((saved.shells as string[]).sort()).toEqual(['ch01-1', 'ch01-2']);
    expect((saved.chapters as Record<string, { completed: boolean }>)['1'].completed).toBe(true);
    expect(saved.checkpoint).toBeNull();
    await page.getByRole('button', { name: 'Onward' }).tap();
    await page.waitForFunction(() => (window as never as { __tide: { world: { level: { id: string } } } }).__tide.world.level.id === 'ch02');
    await expect(page.locator('.hud-card.on h2')).toHaveText('The First Rising');
  });

  test('progress survives a reload and Continue resumes from the lantern', async ({ game, page }) => {
    await game.begin();
    await game.autoplay(8);
    await page.waitForFunction(() => (window as never as { __tide: { world: { checkpointIndex: number } } }).__tide.world.checkpointIndex >= 1, null, { timeout: 60_000 });
    await page.reload();
    await expect(page.locator('.title-screen.in .btn.primary')).toHaveText('Continue');
    await page.locator('.title-screen .btn.primary').tap();
    await page.waitForFunction(() => (window as never as { __tide: { state: string } }).__tide.state === 'playing');
    const s = await game.snapshot();
    expect(s.level).toBe('ch01');
    expect(s.checkpoint).toBeGreaterThanOrEqual(1);
    expect(s.x).toBeGreaterThan(2000);
  });

  test('the final chapter leads to the ending and credits', async ({ game, page }) => {
    await game.run((g) => {
      g.save.data.currentChapter = 10;
      g.playChapter(10, false);
    });
    await page.waitForFunction(() => (window as never as { __tide: { state: string } }).__tide.state === 'playing');
    await game.autoplay(8);
    await expect(page.locator('.screen.in h2')).toHaveText('Hearthreef', { timeout: 100_000 });
    await page.getByRole('button', { name: 'Go home' }).tap();
    await expect(page.locator('.ending-lines p.on').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.ending-nav.on')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Credits' }).tap();
    await expect(page.locator('.credits.in h3')).toHaveText('Tidewalker');
    expect((await game.saved()).endingSeen).toBe(true);
  });
});
