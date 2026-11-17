import { expect, test } from './support';

test.describe('keyboard', () => {
  test('X strikes, arrows run, Space jumps, Escape pauses', async ({ page, game }) => {
    await game.skipTutorial();
    await game.run((g) => g.playLevel(1, 1));
    await game.waitState('playing');
    await page.waitForTimeout(400);
    // Read the swing counter first, then press: the counter only ever goes up.
    const id0 = await game.run((g) => g.world.player.slashId);
    await page.keyboard.press('x');
    await expect.poll(() => game.run((g) => g.world.player.slashId)).not.toBe(id0);
    const a = await game.snapshot();
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(600);
    await page.keyboard.up('ArrowRight');
    expect((await game.snapshot()).x - a.x).toBeGreaterThan(40);

    await page.waitForTimeout(300);
    const rise = game.run(
      (g) =>
        new Promise<number>((resolve) => {
          const y0 = g.world.player.y;
          let top = y0;
          const end = performance.now() + 800;
          const tick = (): void => {
            top = Math.min(top, g.world.player.y);
            if (performance.now() < end) requestAnimationFrame(tick);
            else resolve(y0 - top);
          };
          tick();
        }),
    );
    await page.keyboard.down('Space');
    await page.waitForTimeout(250);
    await page.keyboard.up('Space');
    expect(await rise).toBeGreaterThan(40);


    await page.keyboard.press('Escape');
    await game.waitState('paused');
    await page.keyboard.press('Escape');
    await game.waitState('playing');
  });

  test('menus can be driven by keyboard focus', async ({ page, game }) => {
    void game;
    await expect(page.getByRole('button', { name: 'Begin' })).toBeFocused();
    await page.keyboard.press('Enter');
    await game.waitState('playing');
  });
});
