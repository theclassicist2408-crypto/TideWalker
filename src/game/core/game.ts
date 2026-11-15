import { Bot } from './bot';
import { FIXED_DT } from './constants';
import { FixedLoop } from './loop';
import type { Difficulty, GameMode, LevelData } from './types';
import { World } from './world';
import { GameRenderer } from '../effects/renderer';
import { InputManager } from '../input/input';
import { getChapter } from '../levels';

/** Top-level coordinator: owns the loop and wires input → simulation → renderer. */
export class Game {
  readonly renderer = new GameRenderer();
  readonly loop = new FixedLoop();
  input!: InputManager;
  world!: World;
  private last = 0;
  private running = false;
  private raf = 0;
  difficulty: Difficulty = 'standard';
  /** Verification bot; when set it plays instead of the player (debug / automated playtests). */
  bot: Bot | null = null;
  /** Debug: simulation steps multiplier for fast automated playtests. */
  debugSpeed = 1;

  constructor(private readonly stage: HTMLElement) {}

  async start(): Promise<void> {
    await this.renderer.init(this.stage);
    this.input = new InputManager(this.renderer.canvas);
    this.input.setEnabled(true);
    this.loadLevel(getChapter(1), 'story');
    window.addEventListener('resize', () => this.renderer.resize());
    document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.resume()));
    this.resume();
  }

  loadLevel(level: LevelData, mode: GameMode): void {
    this.world = new World(level, { difficulty: this.difficulty, mode });
    this.renderer.setWorld(this.world);
    this.input.reset();
    this.loop.reset();
  }

  /** Debug: let the verification bot play the current level. */
  autoplay(collect = false): void {
    this.bot = new Bot(this.world, collect);
  }

  /** Debug: run `seconds` of game time synchronously (for hidden tabs where rAF is throttled). */
  debugRun(seconds: number): void {
    let t = this.last;
    for (let i = 0; i < seconds * 60; i++) {
      t += 1000 / 60;
      this.running = true;
      this.frame(t);
    }
    cancelAnimationFrame(this.raf);
  }

  private resume(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.input.release();
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const w = this.world;
    const steps = this.loop.advance(dt) * this.debugSpeed;
    for (let i = 0; i < steps; i++) {
      w.step(this.bot ? this.bot.update(FIXED_DT) : this.input.read(now), FIXED_DT);
      if (w.status === 'failed' && w.player.statusT > 1.2) w.respawn();
    }
    for (let i = 0; i < w.eventCount; i++) this.renderer.onEvent(w.events[i]);
    w.clearEvents();
    this.renderer.frame(w, this.loop.alpha, dt, false);
  };
}
