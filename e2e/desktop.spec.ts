import { expect, test } from './support';

test.describe('desktop keyboard play', () => {
  test('arrows travel, space leaps, shift glows, E pulses, Escape pauses', async ({ game, page }) => {
    await page.locator('.title-screen .btn.primary').click();
    await page.waitForFunction(() => (window as never as { __tide: { state: string } }).__tide.state === 'playing');
    await page.waitForTimeout(600);
    const start = await game.snapshot();
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(700);
    const moved = await game.snapshot();
    expect(moved.x).toBeGreaterThan(start.x + 50);
    await expect(page.locator('.hud-hint.on')).toHaveCount(0);
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(400);
    expect((await game.snapshot()).vx).toBe(0);

    const ground = (await game.snapshot()).y;
    await page.keyboard.down('Space');
    let top = ground;
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(40);
      top = Math.min(top, (await game.snapshot()).y);
    }
    await page.keyboard.up('Space');
    expect(ground - top).toBeGreaterThan(50);

    await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(400);
    expect((await game.snapshot()).glowOn).toBe(true);
    await page.keyboard.up('ShiftLeft');
    await page.waitForTimeout(150);
    expect((await game.snapshot()).glowOn).toBe(false);

    await page.keyboard.press('KeyE');
    await page.waitForTimeout(120);
    expect((await game.snapshot()).pulseCd).toBeGreaterThan(0);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    expect((await game.snapshot()).state).toBe('playing');
  });

  test('a wide window shows more shore without stretching it', async ({ game }) => {
    const cam = await game.run((g) => ({ w: g.renderer.camera.viewW, h: g.renderer.camera.viewH }));
    expect(cam.h).toBeGreaterThanOrEqual(619);
    expect(cam.w).toBeGreaterThan(900);
  });
});
