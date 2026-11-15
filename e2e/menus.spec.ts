import { expect, test } from './support';

test.describe('menus and settings', () => {
  test('every title button opens its screen and comes back', async ({ game, page }) => {
    for (const [label, heading] of [
      ['Chapters', 'Chapters'],
      ['Daily Tide', 'Daily Tide'],
      ['Drift', 'Drift'],
      ['Memories', 'Memories'],
      ['Settings', 'Settings'],
      ['Credits', 'Credits'],
    ]) {
      await page.locator('.title-screen.in').getByRole('button', { name: label, exact: true }).tap();
      await expect(page.locator('.screen.in .screen-head h2')).toHaveText(heading);
      await page.locator('.screen.in').getByRole('button', { name: 'Back' }).tap();
      await expect(page.locator('.title-screen.in')).toBeVisible();
    }
    expect((await game.snapshot()).state).toBe('title');
  });

  test('chapter select locks what has not been reached', async ({ game, page }) => {
    await page.getByRole('button', { name: 'Chapters', exact: true }).tap();
    await expect(page.locator('.chapter-card')).toHaveCount(10);
    await expect(page.locator('.chapter-card.locked')).toHaveCount(9);
    await expect(page.locator('.chapter-card').nth(1)).toBeDisabled();
    await page.locator('.chapter-card').first().tap();
    await page.waitForFunction(() => (window as never as { __tide: { state: string } }).__tide.state === 'playing');
    expect((await game.snapshot()).level).toBe('ch01');
  });

  test('settings apply immediately and persist', async ({ game, page }) => {
    await page.getByRole('button', { name: 'Settings', exact: true }).tap();
    await page.getByRole('switch', { name: 'Reduced motion' }).tap();
    await page.getByRole('switch', { name: 'Haptics' }).tap();
    await page.getByRole('radio', { name: 'XL' }).tap();
    await page.getByRole('radio', { name: 'Left hand' }).tap();
    await page.getByRole('radio', { name: 'Gentle' }).tap();
    await page.getByRole('slider', { name: 'Music' }).fill('20');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('22.4px');
    await expect(page.locator('.hud.left-handed')).toHaveCount(1);
    expect(await game.run((g) => [g.renderer.options.reducedMotion, g.haptics.enabled])).toEqual([true, false]);
    const s = (await game.saved()).settings as Record<string, unknown>;
    expect(s).toMatchObject({ reducedMotion: true, haptics: false, textScale: 1.4, handed: 'left', difficulty: 'gentle', music: 0.2 });
    await page.reload();
    await page.waitForFunction(() => Boolean((window as never as { __tide?: { ui?: unknown } }).__tide?.ui));
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('22.4px');
    await page.locator('.title-screen.in .btn.primary').tap();
    await page.waitForFunction(() => (window as never as { __tide: { state: string } }).__tide.state === 'playing');
    expect(await game.run((g) => g.world.difficulty)).toBe('gentle');
    // Left-handed: the pulse button moves to the left edge.
    const pulse = await page.locator('.hud-pulse').boundingBox();
    expect(pulse && pulse.x).toBeLessThan(100);
  });

  test('reset progress asks first, then forgets progress but keeps settings', async ({ game, page }) => {
    await game.run((g) => {
      g.save.completeChapter(1, 60, []);
      g.save.addShell('ch01-1');
      g.save.updateSettings({ screenShake: false });
    });
    await page.getByRole('button', { name: 'Settings', exact: true }).tap();
    await page.getByRole('button', { name: 'Reset progress' }).tap();
    await expect(page.locator('.confirm')).toBeVisible();
    await page.getByRole('button', { name: 'Keep' }).tap();
    await expect(page.locator('.confirm')).toHaveCount(0);
    expect((await game.saved()).currentChapter).toBe(2);
    await page.getByRole('button', { name: 'Reset progress' }).tap();
    await page.getByRole('button', { name: 'Forget' }).tap();
    await expect(page.locator('.title-screen.in .btn.primary')).toHaveText('Begin');
    const saved = await game.saved();
    expect(saved.currentChapter).toBe(1);
    expect(saved.shells).toEqual([]);
    expect((saved.settings as Record<string, unknown>).screenShake).toBe(false);
  });

  test('a corrupted save is survived', async ({ page, game }) => {
    await page.evaluate(() => localStorage.setItem('tidewalker.save.v1', '{"currentChapter": "seven", "shells": [[['));
    await page.reload();
    await expect(page.locator('.title-screen.in .btn.primary')).toHaveText('Begin');
    expect(await game.run((g) => g.save.recovered)).toBe(true);
  });

  test('memories show collected shells as paintings', async ({ game, page }) => {
    await game.run((g) => {
      g.save.addShell('ch01-1');
      g.save.addShell('ch10-2');
    });
    await page.getByRole('button', { name: 'Memories', exact: true }).tap();
    await expect(page.locator('.memory')).toHaveCount(20);
    await expect(page.locator('.memory.empty')).toHaveCount(18);
    await page.getByRole('button', { name: 'Memory 20' }).tap();
    await expect(page.locator('.viewer.on canvas')).toBeVisible();
    const painted = await page.locator('.viewer canvas').evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext('2d')?.getImageData(0, 0, c.width, c.height).data ?? new Uint8ClampedArray();
      const seen = new Set<number>();
      for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      return seen.size;
    });
    expect(painted).toBeGreaterThan(50);
    await page.locator('.viewer').tap();
    await expect(page.locator('.viewer.on')).toHaveCount(0);
  });

  test('Daily Tide plays today\'s shore and records it', async ({ game, page }) => {
    await page.getByRole('button', { name: 'Daily Tide', exact: true }).tap();
    const name = await page.locator('.feature h3').innerText();
    expect(name.length).toBeGreaterThan(3);
    await page.getByRole('button', { name: 'Cross tonight' }).tap();
    await page.waitForFunction(() => (window as never as { __tide: { state: string } }).__tide.state === 'playing');
    expect((await game.snapshot()).mode).toBe('daily');
    await game.autoplay(8);
    await expect(page.locator('.screen.in .eyebrow')).toHaveText('Daily Tide', { timeout: 90_000 });
    const daily = (await game.saved()).daily as { streak: number; lastCompleted: string };
    expect(daily.streak).toBe(1);
    expect(daily.lastCompleted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await page.getByRole('button', { name: 'Done' }).tap();
    await expect(page.locator('.title-screen.in')).toBeVisible();
  });

  test('Drift wanders without failure and remembers the farthest distance', async ({ game, page }) => {
    await page.getByRole('button', { name: 'Drift', exact: true }).tap();
    await page.locator('.feature').getByRole('button', { name: 'Drift' }).tap();
    await page.waitForFunction(() => (window as never as { __tide: { state: string } }).__tide.state === 'playing');
    expect((await game.snapshot()).mode).toBe('drift');
    await game.autoplay(8);
    await page.waitForTimeout(4000);
    const s = await game.snapshot();
    expect(s.status).toBe('playing');
    expect(s.lumen).toBe(100);
    await expect(page.locator('.hud-distance')).toContainText(' m');
    await game.run((g) => {
      g.debugSpeed = 1;
      g.bot = null;
    });
    await page.locator('.hud-pause').tap();
    await page.getByRole('button', { name: 'Leave' }).tap();
    await expect(page.locator('.title-screen.in')).toBeVisible();
    expect((await game.saved()).driftBest).toBeGreaterThan(50);
  });
});
