import { expect, test } from './support';

test.describe('playing with the touch pad', () => {
  test('Begin opens the mandatory tutorial with the pad and HUD showing', async ({ page, game }) => {
    await page.getByRole('button', { name: 'Begin' }).tap();
    await game.waitState('playing');
    const s = await game.snapshot();
    expect(s.mode).toBe('tutorial');
    await expect(page.locator('.hud.on')).toBeVisible();
    await expect(page.locator('.pad')).toBeVisible();
    for (const b of ['jump', 'attack', 'dash', 'light', 'heal']) await expect(page.locator(`.pad-btn[data-btn="${b}"]`)).toBeVisible();
    await expect(page.locator('.hud-masks .mask.full').first()).toBeVisible();
    await expect(page.locator('.hud-hint.on')).toBeVisible();
    // The training checklist names the moves the first golden gate is waiting for.
    await expect(page.locator('.hud-drills.on')).toContainText('Training');
    await expect(page.locator('.hud-drills.on')).toContainText('Jump');
  });

  test('the stick runs, Jump leaps and Strike swings — with real touches', async ({ page, game }) => {
    await page.getByRole('button', { name: 'Begin' }).tap();
    await game.waitState('playing');
    await page.waitForTimeout(400);
    const a = await game.snapshot();
    await game.pushStick(50, 0, 700);
    const b = await game.snapshot();
    expect(b.x - a.x).toBeGreaterThan(40);

    await page.waitForTimeout(300);
    const before = await game.snapshot();
    const rise = await game.watchRise();
    await game.holdButton('jump', 250);
    await expect.poll(rise).toBeGreaterThan(40);
    expect(before.onGround).toBe(true);

    await page.waitForTimeout(800);
    const id0 = await game.run((g) => g.world.player.slashId);
    await game.holdButton('attack', 60);
    await expect.poll(() => game.run((g) => g.world.player.slashId)).not.toBe(id0);
  });

  test('pause holds the world; resume carries on', async ({ page, game }) => {
    await page.getByRole('button', { name: 'Begin' }).tap();
    await game.waitState('playing');
    await page.locator('.hud-pause').tap();
    await game.waitState('paused');
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
    const t0 = await game.run((g) => g.world.time);
    await page.waitForTimeout(500);
    expect(await game.run((g) => g.world.time)).toBe(t0);
    await page.getByRole('button', { name: 'Resume' }).tap();
    await game.waitState('playing');
  });

  test('finishing the tutorial is saved and opens the map', async ({ page, game }) => {
    await page.getByRole('button', { name: 'Begin' }).tap();
    await game.waitState('playing');
    await game.autoplay(12);
    await game.waitState('complete');
    expect((await game.saved()).tutorialDone).toBe(true);
    await page.reload();
    await expect(page.locator('.title-screen.in')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'The Deep' })).toBeVisible();
  });

  test('a fall respawns the creature at the lantern', async ({ game }) => {
    await game.skipTutorial();
    await game.run((g) => g.playLevel(1, 3));
    await game.waitState('playing');
    await game.run((g) => g.world.kill());
    await expect.poll(() => game.snapshot().then((s) => s.status)).toBe('playing');
    expect((await game.snapshot()).hp).toBeGreaterThan(0);
  });
});
