import type { Page } from '@playwright/test';
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
    const rise = await game.watchRise();
    await page.keyboard.down('Space');
    await page.waitForTimeout(250);
    await game.frames(2);
    await page.keyboard.up('Space');
    await expect.poll(rise).toBeGreaterThan(40);

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

test.describe('mouse', () => {
  test('left click strikes, right button held glows', async ({ page, game }) => {
    await game.skipTutorial();
    await game.run((g) => g.playLevel(1, 1));
    await game.waitState('playing');
    await page.waitForTimeout(400);
    const id0 = await game.run((g) => g.world.player.slashId);
    await page.mouse.move(640, 300);
    await page.mouse.down({ button: 'left' });
    await page.mouse.up({ button: 'left' });
    await expect.poll(() => game.run((g) => g.world.player.slashId)).not.toBe(id0);
    await page.mouse.down({ button: 'right' });
    await expect.poll(() => game.run((g) => g.world.player.glowOn)).toBe(true);
    await page.mouse.up({ button: 'right' });
    await expect.poll(() => game.run((g) => g.world.player.glowOn)).toBe(false);
  });
});

/** Installs a fake controller the game reads through `navigator.getGamepads()`. */
async function plugIn(page: Page, id: string): Promise<void> {
  await page.evaluate((padId) => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false }));
    const pad = { id: padId, index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons, timestamp: 0 };
    const w = window as unknown as { __pads: (typeof pad | null)[] };
    w.__pads = [pad];
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => w.__pads });
  }, id);
}

/**
 * Presses a controller button (standard-layout index) for exactly one game frame. Done inside the
 * page, releasing as soon as the game's frame has read the button: a round trip from the test
 * can take several frames on a starved machine, and a held direction repeats on menus.
 */
async function tapPad(page: Page, button: number): Promise<void> {
  await page.evaluate(
    (b) =>
      new Promise<void>((resolve) => {
        const w = window as unknown as {
          __pads: { buttons: { pressed: boolean; value: number }[] }[];
          __tide: { input: { pad: { slots: Map<number, { prev: Set<number> }> } } };
        };
        const pad = w.__pads[0];
        // The reader keeps the buttons it last read in `prev`; our frame callback runs after the game's.
        const read = (): boolean => w.__tide.input.pad.slots.get(0)?.prev.has(b) ?? false;
        const when = (down: boolean, then: () => void): void => {
          const check = (): void => (read() === down ? then() : void requestAnimationFrame(check));
          requestAnimationFrame(check);
        };
        pad.buttons[b] = { pressed: true, value: 1 };
        when(true, () => {
          pad.buttons[b] = { pressed: false, value: 0 };
          when(false, resolve);
        });
      }),
    button,
  );
}

test.describe('controller', () => {
  test('a PlayStation controller drives menus and play, with its own button names', async ({ page, game }) => {
    await plugIn(page, 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)');
    await expect.poll(() => game.run((g) => g.input.padFamily)).toBe('playstation');
    // D-pad down then up returns to Begin; cross chooses it.
    await tapPad(page, 13);
    await expect(page.getByRole('button', { name: 'Begin' })).not.toBeFocused();
    await tapPad(page, 12);
    await expect(page.getByRole('button', { name: 'Begin' })).toBeFocused();
    await tapPad(page, 0);
    await game.waitState('playing');
    await page.waitForTimeout(400);

    // Square strikes; the prompts and the hidden touch pad follow the controller.
    const id0 = await game.run((g) => g.world.player.slashId);
    await tapPad(page, 2);
    await expect.poll(() => game.run((g) => g.world.player.slashId)).not.toBe(id0);
    await expect(page.locator('.hud')).toHaveClass(/pad-hidden/);
    await expect(page.locator('.hud-hint')).toContainText('Left stick');

    // Options pauses, circle goes back to play.
    await tapPad(page, 9);
    await game.waitState('paused');
    await tapPad(page, 1);
    await game.waitState('playing');

    // Losing the controller mid-play pauses the game.
    await page.evaluate(() => {
      (window as unknown as { __pads: unknown[] }).__pads = [];
    });
    await game.waitState('paused');
  });

  test('Settings lists the controller buttons by their names', async ({ page, game }) => {
    void game;
    await plugIn(page, 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)');
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.locator('.pad-status')).toContainText('Xbox controller connected');
    await expect(page.locator('.pad-map')).toContainText('LB · View');
  });
});
