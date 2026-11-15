import { expect, test as base, type CDPSession, type Page } from '@playwright/test';

/** What the tests read through the game's `window.__tide` hook. */
export interface Snapshot {
  state: string;
  mode: string;
  x: number;
  y: number;
  vx: number;
  onGround: boolean;
  glowOn: boolean;
  lumen: number;
  pulseCd: number;
  time: number;
  status: string;
  checkpoint: number;
  level: string;
  screen: string | null;
}

interface Fixtures {
  errors: string[];
  game: GameDriver;
}

/** Fails any test that logs a console error or throws in the page. */
export const test = base.extend<Fixtures>({
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await use(errors);
    expect(errors, 'console errors').toEqual([]);
  },
  game: async ({ page, errors }, use) => {
    void errors;
    const driver = new GameDriver(page);
    await driver.open();
    await use(driver);
  },
});

export { expect };

export class GameDriver {
  private cdp: CDPSession | null = null;
  private clock = 0;

  constructor(readonly page: Page) {}

  async open(path = '/'): Promise<void> {
    await this.page.goto(path);
    await this.page.waitForFunction(() => Boolean((window as never as { __tide?: { world?: unknown; ui?: unknown } }).__tide?.ui));
    await expect(this.page.locator('.title-screen.in')).toBeVisible();
  }

  snapshot(): Promise<Snapshot> {
    return this.page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).__tide;
      const p = g.world.player;
      return {
        state: g.state,
        mode: g.world.mode,
        x: p.x,
        y: p.y,
        vx: p.vx,
        onGround: p.onGround,
        glowOn: p.glowOn,
        lumen: p.lumen,
        pulseCd: p.pulseCd,
        time: g.world.time,
        status: g.world.status,
        checkpoint: g.world.checkpointIndex,
        level: g.world.level.id,
        screen: g.ui.active,
      };
    });
  }

  /** Runs code against the game instance inside the page. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run<T>(fn: (g: any) => T): Promise<T> {
    return this.page.evaluate(`(${fn.toString()})(window.__tide)`) as Promise<T>;
  }

  async begin(): Promise<void> {
    await this.page.locator('.title-screen .btn.primary').tap();
    await this.page.waitForFunction(() => (window as never as { __tide: { state: string } }).__tide.state === 'playing');
    await expect(this.page.locator('.hud.on')).toBeVisible();
  }

  /**
   * Sends a real touch event through the browser's input pipeline. Event timestamps come from a
   * virtual clock, so gesture timing is exact even when software rendering makes the page slow.
   */
  private async touch(type: 'touchStart' | 'touchMove' | 'touchEnd', points: { x: number; y: number; id?: number }[], advanceMs = 0, sync = false): Promise<void> {
    if (!this.cdp) this.cdp = await this.page.context().newCDPSession(this.page);
    this.clock = sync ? Math.max(this.clock + 0.001, Date.now() / 1000) : this.clock + advanceMs / 1000;
    await this.cdp.send('Input.dispatchTouchEvent', { type, timestamp: this.clock, touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id ?? 0 })) });
  }

  /** A real finger swipe across the canvas. */
  async swipe(x0: number, y0: number, x1: number, y1: number, ms = 80, lift = true): Promise<void> {
    await this.touch('touchStart', [{ x: x0, y: y0 }], 0, true);
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      await this.touch('touchMove', [{ x: x0 + ((x1 - x0) * i) / steps, y: y0 + ((y1 - y0) * i) / steps }], ms / steps);
    }
    if (lift) await this.touch('touchEnd', [], 10);
  }

  async hold(x: number, y: number, ms: number): Promise<void> {
    await this.touch('touchStart', [{ x, y }], 0, true);
    await this.page.waitForTimeout(ms);
  }

  async release(): Promise<void> {
    await this.touch('touchEnd', [], 0, true);
  }

  async tapCanvas(x: number, y: number): Promise<void> {
    await this.touch('touchStart', [{ x, y }], 0, true);
    await this.touch('touchEnd', [], 50);
  }

  async doubleTap(x: number, y: number): Promise<void> {
    await this.touch('touchStart', [{ x, y }], 0, true);
    await this.touch('touchEnd', [], 50);
    await this.touch('touchStart', [{ x, y }], 90);
    await this.touch('touchEnd', [], 50);
  }

  /** Watches the creature for `ms` and reports how high it rose and which events fired. */
  watch(ms: number): Promise<{ rise: number; maxSpeed: number }> {
    return this.page.evaluate(
      (duration) =>
        new Promise<{ rise: number; maxSpeed: number }>((resolve) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const g = (window as any).__tide;
          const y0 = g.world.player.y;
          let top = y0;
          let maxSpeed = 0;
          const end = performance.now() + duration;
          const tick = (): void => {
            top = Math.min(top, g.world.player.y);
            maxSpeed = Math.max(maxSpeed, Math.abs(g.world.player.vx));
            if (performance.now() < end) requestAnimationFrame(tick);
            else resolve({ rise: y0 - top, maxSpeed });
          };
          tick();
        }),
      ms,
    );
  }

  /** Lets the verification bot finish the current level quickly. */
  async autoplay(speed = 8): Promise<void> {
    await this.run((g) => {
      g.autoplay(true);
      g.debugSpeed = 8;
    });
    if (speed !== 8) await this.page.evaluate(`window.__tide.debugSpeed = ${speed}`);
  }

  saved(): Promise<Record<string, unknown>> {
    return this.page.evaluate(() => JSON.parse(localStorage.getItem('tidewalker.save.v1') ?? '{}') as Record<string, unknown>);
  }
}
