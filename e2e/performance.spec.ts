import { expect, test } from './support';

test.describe('performance and offline', () => {
  test('holds frame rate and does not leak while the bot plays', async ({ game, page }) => {
    await game.run((g) => g.playChapter(3, false));
    await page.waitForFunction(() => (window as never as { __tide: { state: string } }).__tide.state === 'playing');
    await game.run((g) => g.autoplay(true));
    await page.waitForTimeout(3000);
    const sample = (): Promise<{ heap: number; fps: number; nodes: number; dom: number }> =>
      game.run((g) => {
        const count = (c: { children?: unknown[] }): number => 1 + (c.children ?? []).reduce((n: number, ch) => n + count(ch as { children?: unknown[] }), 0);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mem = (performance as any).memory;
        return { heap: mem ? mem.usedJSHeapSize : 0, fps: g.renderer.stats.fps, nodes: count(g.renderer.app.stage), dom: document.getElementsByTagName('*').length };
      });
    const a = await sample();
    await page.waitForTimeout(15_000);
    const b = await sample();
    // Software rendering in CI is far slower than a phone GPU; this guards against collapse, not polish.
    expect(b.fps).toBeGreaterThan(24);
    // Pools are fixed-size: the scene graph must not grow as the level streams past.
    expect(b.nodes).toBeLessThan(a.nodes + 400);
    expect(b.nodes).toBeLessThan(2600);
    expect(b.dom).toBeLessThanOrEqual(a.dom + 5);
    if (a.heap > 0) expect(b.heap - a.heap).toBeLessThan(24 * 1024 * 1024);
    expect((await game.snapshot()).x).toBeGreaterThan(1500);
  });

  test('loads fast and ships no external requests', async ({ page, errors }) => {
    void errors;
    const hosts = new Set<string>();
    let bytes = 0;
    page.on('response', async (r) => {
      hosts.add(new URL(r.url()).host);
      const len = Number(r.headers()['content-length'] ?? 0);
      bytes += len;
    });
    const t0 = Date.now();
    await page.goto('/');
    await expect(page.locator('.title-screen.in')).toBeVisible();
    expect(Date.now() - t0).toBeLessThan(6000);
    expect([...hosts]).toEqual(['localhost:4173']);
    expect(bytes).toBeLessThan(1_500_000);
  });

  test('plays offline after the first visit', async ({ page, context, errors }) => {
    void errors;
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));
    await page.waitForFunction(async () => (await caches.keys()).length > 0);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('.title-screen.in')).toBeVisible();
    await page.locator('.title-screen .btn.primary').tap();
    await page.waitForFunction(() => (window as never as { __tide: { state: string } }).__tide.state === 'playing');
    await context.setOffline(false);
  });
});
