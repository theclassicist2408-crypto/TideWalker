import { expect, test } from './support';

test.describe('menus, map and progress', () => {
  test('the map shows ten areas; only the first is open on a new save', async ({ page, game }) => {
    await game.skipTutorial();
    await page.getByRole('button', { name: 'The Deep' }).tap();
    await expect(page.locator('.area-card')).toHaveCount(10);
    await expect(page.getByRole('button', { name: 'Area 1: The Shallows' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Area 2, locked' })).toBeVisible();
    await page.getByRole('button', { name: 'Area 1: The Shallows' }).tap();
    await expect(page.getByRole('button', { name: /^Level 1: / })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Level 2, locked' })).toBeVisible();
  });

  test('clearing a level unlocks the next, records a best time and offers to go on', async ({ page, game }) => {
    await game.skipTutorial();
    await game.run((g) => g.playLevel(1, 1));
    await game.waitState('playing');
    await game.autoplay(12);
    await game.waitState('complete');
    await expect(page.getByRole('button', { name: 'Onward' })).toBeVisible();
    const save = (await game.saved()) as { unlocked: number; levels: Record<string, { bestTime: number }> };
    expect(save.unlocked).toBe(2);
    expect(save.levels['a01-01'].bestTime).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Onward' }).tap();
    await game.waitState('playing');
    expect((await game.snapshot()).level).toBe('a01-02');
  });

  test('a fallen boss can be fought again from the map', async ({ page, game }) => {
    await game.run((g) => {
      g.save.completeTutorial();
      g.save.data.unlocked = 11;
      g.save.data.abilities = ['dash', 'wall'];
      g.save.defeat('warden', 'tidebreaker');
      g.ui.show('title');
    });
    await page.getByRole('button', { name: 'The Deep' }).tap();
    await page.getByRole('button', { name: /^Rematch / }).first().tap();
    await game.waitState('playing');
    expect((await game.snapshot()).mode).toBe('rematch');
    await expect(page.locator('.hud-gift.on')).toBeVisible();
  });

  test('settings persist across a reload, including difficulty and handedness', async ({ page, game }) => {
    await page.getByRole('button', { name: 'Settings' }).tap();
    await expect(page.locator('.settings')).toBeVisible();
    await page.getByRole('radio', { name: 'Intense' }).tap();
    await page.getByRole('radio', { name: 'Left hand' }).tap();
    await page.reload();
    await game.open();
    const s = (await game.saved()) as { settings: { difficulty: string; handed: string } };
    expect(s.settings.difficulty).toBe('intense');
    expect(s.settings.handed).toBe('left');
  });

  test('Memories and Credits open and close', async ({ page, game }) => {
    void game;
    await page.getByRole('button', { name: 'Memories' }).tap();
    await expect(page.locator('.memory').first()).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).tap();
    await expect(page.locator('.title-screen.in')).toBeVisible();
    await page.getByRole('button', { name: 'Credits' }).tap();
    await expect(page.locator('.credits')).toBeVisible();
  });
});
