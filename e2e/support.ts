import { expect, test as base, type CDPSession, type Page } from '@playwright/test';

/** What the tests read through the game's `window.__tide` hook. */
export interface Snapshot {
  state: string;
  mode: string;
  x: number;
  y: number;
  vy: number;
  onGround: boolean;
  hp: number;
  lumen: number;
  slashT: number;
  status: string;
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

  constructor(readonly page: Page) {}

  async open(path = '/'): Promise<void> {
    await this.page.goto(path);
    await this.page.waitForFunction(() => Boolean((window as never as { __tide?: { ui?: unknown } }).__tide?.ui));
    await expect(this.page.locator('.title-screen.in')).toBeVisible();
  }

  snapshot(): Promise<Snapshot> {
    return this.page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).__tide;
      const p = g.world.player;
      return { state: g.state, mode: g.world.mode, x: p.x, y: p.y, vy: p.vy, onGround: p.onGround, hp: p.hp, lumen: p.lumen, slashT: p.slashT, status: g.world.status, level: g.world.level.id, screen: g.ui.active };
    });
  }

  /** Runs code against the game instance inside the page. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run<T>(fn: (g: any) => T): Promise<T> {
    return this.page.evaluate(`(${fn.toString()})(window.__tide)`) as Promise<T>;
  }

  async waitState(state: string): Promise<void> {
    await this.page.waitForFunction((s) => (window as never as { __tide: { state: string } }).__tide.state === s, state, { timeout: 60_000 });
  }

  /** Marks the tutorial done so the map opens, as a returning player would have it. */
  async skipTutorial(): Promise<void> {
    await this.run((g) => {
      g.save.completeTutorial();
      g.ui.show('title');
    });
    await expect(this.page.locator('.title-screen.in')).toBeVisible();
  }

  private async touch(type: 'touchStart' | 'touchMove' | 'touchEnd', points: { x: number; y: number; id: number }[]): Promise<void> {
    if (!this.cdp) this.cdp = await this.page.context().newCDPSession(this.page);
    await this.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id })) });
  }

  private async centre(selector: string): Promise<{ x: number; y: number }> {
    const b = await this.page.locator(selector).boundingBox();
    if (!b) throw new Error(`${selector} not on screen`);
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }

  /** Holds a pad button with a real finger for `ms`. */
  async holdButton(name: string, ms: number): Promise<void> {
    const c = await this.centre(`.pad-btn[data-btn="${name}"]`);
    await this.touch('touchStart', [{ ...c, id: 1 }]);
    await this.page.waitForTimeout(ms);
    await this.touch('touchEnd', []);
  }

  /** Puts a thumb on the stick zone, pushes it by (dx, dy) and keeps it there for `ms`. */
  async pushStick(dx: number, dy: number, ms: number): Promise<void> {
    const b = await this.page.locator('.pad-stick').boundingBox();
    if (!b) throw new Error('stick zone not on screen');
    const x = b.x + b.width * 0.4;
    const y = b.y + b.height * 0.6;
    await this.touch('touchStart', [{ x, y, id: 2 }]);
    for (let i = 1; i <= 4; i++) await this.touch('touchMove', [{ x: x + (dx * i) / 4, y: y + (dy * i) / 4, id: 2 }]);
    await this.page.waitForTimeout(ms);
    await this.touch('touchEnd', []);
  }

  /** Lets the verification bot play the current level, fast. */
  async autoplay(speed = 8): Promise<void> {
    await this.page.evaluate(`window.__tide.autoplay(true); window.__tide.debugSpeed = ${speed};`);
  }

  saved(): Promise<Record<string, unknown>> {
    return this.page.evaluate(() => JSON.parse(localStorage.getItem('tidewalker.save.v2') ?? '{}') as Record<string, unknown>);
  }
}
