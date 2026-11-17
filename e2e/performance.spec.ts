import { expect, test } from './support';

test.describe('performance and offline', () => {
  test('holds frame rate and does not leak through a boss fight', async ({ game, page }) => {
    await game.run((g) => {
      g.save.completeTutorial();
      g.playLevel(5, 10);
    });
    await game.waitState('playing');
    await game.autoplay(1);
    await page.waitForTimeout(3000);
    const sample = (): Promise<{ fps: number; nodes: number; dom: number }> =>
      game.run((g) => {
        const count = (c: { children?: unknown[] }): number => 1 + (c.children ?? []).reduce((n: number, ch) => n + count(ch as { children?: unknown[] }), 0);
        return { fps: g.renderer.stats.fps, nodes: count(g.renderer.app.stage), dom: document.getElementsByTagName('*').length };
      });
    const a = await sample();
    await page.waitForTimeout(12_000);
    const b = await sample();
    // Software rendering in CI is far slower than a phone GPU; this guards against collapse, not polish.
    expect(b.fps).toBeGreaterThan(20);
    expect(b.nodes).toBeLessThan(a.nodes + 400);
    expect(b.dom).toBeLessThanOrEqual(a.dom + 10);
  });

  test('loads fast and ships no external requests', async ({ page, errors }) => {
    void errors;
    const hosts = new Set<string>();
    page.on('response', (r) => hosts.add(new URL(r.url()).host));
    const t0 = Date.now();
    await page.goto('/');
    await expect(page.locator('.title-screen.in')).toBeVisible();
    expect(Date.now() - t0).toBeLessThan(8000);
    expect([...hosts]).toEqual(['localhost:4173']);
  });

  test('plays offline after the first visit', async ({ page, context, errors }) => {
    void errors;
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));
    await page.waitForFunction(async () => (await caches.keys()).length > 0);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('.title-screen.in')).toBeVisible();
    await page.getByRole('button', { name: 'Begin' }).tap();
    await page.waitForFunction(() => (window as never as { __tide: { state: string } }).__tide.state === 'playing');
    await context.setOffline(false);
  });
});
