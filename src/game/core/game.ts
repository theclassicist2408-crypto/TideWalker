import { AudioDirector, type AudioInputs } from '../audio/director';
import { AudioEngine } from '../audio/engine';
import { Haptics } from '../effects/haptics';
import { GameRenderer } from '../effects/renderer';
import { InputManager } from '../input/input';
import { allChapters, CHAPTER_COUNT, getChapter } from '../levels';
import { DAILY_LAYOUTS, getDailyLayout } from '../levels/daily';
import { makeDriftLevel, titleLevel } from '../levels/drift';
import { browserStorage, SaveStore } from '../save/save';
import { applyCondition, dailyFor, type DailyPick } from '../systems/daily';
import { ROMAN } from '../ui/dom';
import { Hud } from '../ui/hud';
import { Ui, type ChapterInfo, type CompleteInfo, type UiHost } from '../ui/screens';
import { Bot } from './bot';
import { FIXED_DT, P } from './constants';
import { FixedLoop } from './loop';
import { newIntent, type GameEvent, type GameMode, type HintKind, type LevelData } from './types';
import { clamp } from './util';
import { World } from './world';

type State = 'title' | 'playing' | 'paused' | 'failed' | 'complete';

interface Session {
  mode: GameMode;
  chapter: number;
  level: LevelData;
  dailyKey: string;
  tideScale: number;
  drainScale: number;
}

const PX_PER_METRE = 20;

/** Top-level coordinator: owns the loop and wires input, simulation, rendering, audio, UI and saves. */
export class Game implements UiHost {
  readonly renderer = new GameRenderer();
  readonly loop = new FixedLoop();
  readonly audio = new AudioEngine();
  readonly director = new AudioDirector();
  readonly haptics = new Haptics();
  readonly save = new SaveStore(browserStorage());
  input!: InputManager;
  hud!: Hud;
  ui!: Ui;
  world!: World;
  state: State = 'title';
  private session: Session = { mode: 'title', chapter: 0, level: titleLevel(), dailyKey: '', tideScale: 1, drainScale: 1 };
  private readonly idle = newIntent();
  private readonly audioIn: AudioInputs = { mode: 'title', biome: 'pools', danger: 0, tide: 0, lumen: 1, glow: 0, submerged: false, rain: 0, wind: 0, paused: false, menu: true };
  private last = 0;
  private running = false;
  private raf = 0;
  private stateT = 0;
  private screenShown = false;
  private pendingComplete: CompleteInfo | null = null;
  private driftBase = 0;
  private driftSeed = 1;
  private hintKind: HintKind | null = null;
  private hintT = 0;
  private clock = 0;
  private readonly fade: HTMLElement;
  /** Verification bot; when set it plays instead of the player (automated playtests). */
  bot: Bot | null = null;
  /** Simulation steps multiplier for fast automated playtests. */
  debugSpeed = 1;

  constructor(
    private readonly stage: HTMLElement,
    private readonly hudRoot: HTMLElement,
    private readonly uiRoot: HTMLElement,
  ) {
    this.fade = document.createElement('div');
    this.fade.className = 'fade';
    stage.parentElement?.append(this.fade);
  }

  async start(): Promise<void> {
    await this.renderer.init(this.stage);
    this.input = new InputManager(this.renderer.canvas);
    this.input.onFirstGesture = () => this.audio.unlock();
    this.input.onPauseKey = () => this.togglePause();
    // Menus are DOM; any tap there must unlock audio too.
    this.uiRoot.addEventListener('pointerdown', () => this.audio.unlock(), { passive: true });
    this.hud = new Hud(this.hudRoot);
    this.hud.onPause = () => this.togglePause();
    this.hud.onPulse = () => {
      this.audio.unlock();
      this.input.gestures.pressPulse();
    };
    this.ui = new Ui(this.uiRoot, this);
    this.renderer.onThunder = () => this.audio.thunder();
    this.settingsChanged();
    this.loadWorld(this.session.level, 'title', -1);
    this.ui.show('title');

    window.addEventListener('resize', () => this.renderer.resize());
    window.addEventListener('orientationchange', () => window.setTimeout(() => this.renderer.resize(), 200));
    document.addEventListener('visibilitychange', () => (document.hidden ? this.background() : this.foreground()));
    window.addEventListener('pagehide', () => this.background());
    this.foreground();
  }

  // ---- UiHost ----------------------------------------------------------------------------

  chapters(): ChapterInfo[] {
    return allChapters().map((l) => ({ index: l.index, name: l.name, line: l.line, shellIds: l.shells.map((s) => s.id), routeIds: l.secrets.map((s) => s.id) }));
  }

  daily(): DailyPick {
    return dailyFor(new Date(), DAILY_LAYOUTS);
  }

  playChapter(index: number, resume: boolean): void {
    const chapter = clamp(Math.round(index), 1, CHAPTER_COUNT);
    const cp = this.save.data.checkpoint;
    const from = resume && cp && cp.chapter === chapter ? cp.index : -1;
    if (from < 0) this.save.clearCheckpoint();
    this.begin({ mode: 'story', chapter, level: getChapter(chapter), dailyKey: '', tideScale: 1, drainScale: 1 }, from);
  }

  playDaily(): void {
    const pick = this.daily();
    const level = applyCondition(getDailyLayout(pick.layout), pick.condition);
    this.begin({ mode: 'daily', chapter: 0, level, dailyKey: pick.key, tideScale: pick.condition.tideScale, drainScale: pick.condition.drainScale }, -1);
  }

  playDrift(): void {
    this.driftBase = 0;
    this.driftSeed = 1 + Math.floor(Math.random() * 100000);
    this.begin({ mode: 'drift', chapter: 0, level: makeDriftLevel(this.driftSeed), dailyKey: '', tideScale: 1, drainScale: 1 }, -1);
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.ui.clear();
    this.setState('playing');
    this.input.setEnabled(true);
    this.hud.setVisible(true);
    this.loop.reset();
  }

  /** Back to the last lantern (from the retry screen or the pause menu). */
  retry(): void {
    if (this.state !== 'failed' && this.state !== 'paused') return;
    this.world.respawn();
    if (this.bot) this.bot = new Bot(this.world, true);
    this.ui.clear();
    this.input.reset();
    this.input.setEnabled(true);
    this.hud.setVisible(true);
    this.setState('playing');
    this.loop.reset();
  }

  restartChapter(): void {
    const s = this.session;
    if (s.mode === 'story') this.save.clearCheckpoint();
    if (s.mode === 'drift') this.playDrift();
    else this.begin(s, -1);
  }

  quitToTitle(): void {
    this.recordDrift();
    this.fadeThrough(() => {
      this.bot = null;
      this.session = { mode: 'title', chapter: 0, level: titleLevel(), dailyKey: '', tideScale: 1, drainScale: 1 };
      this.loadWorld(this.session.level, 'title', -1);
      this.input.setEnabled(false);
      this.hud.setVisible(false);
      this.hud.hideCard();
      this.setState('title');
      this.ui.show('title');
    });
  }

  settingsChanged(): void {
    const s = this.save.data.settings;
    this.audio.setVolumes(s.master, s.music, s.sfx);
    this.haptics.enabled = s.haptics;
    this.renderer.options.reducedMotion = s.reducedMotion;
    this.renderer.options.screenShake = s.screenShake;
    this.renderer.options.visualCues = s.visualCues;
    this.renderer.setMaxResolution(s.batterySaver ? 1 : 2);
    document.documentElement.style.setProperty('--text-scale', String(s.textScale));
    this.hud?.setHanded(s.handed);
  }

  sound(kind: 'tap' | 'open' | 'back' | 'toggle'): void {
    this.audio.unlock();
    this.audio.ui(kind);
    this.haptics.play('ui');
  }

  // ---- session flow ----------------------------------------------------------------------

  private begin(session: Session, checkpoint: number): void {
    this.fadeThrough(() => {
      this.session = session;
      this.loadWorld(session.level, session.mode, checkpoint);
      this.ui.clear();
      this.input.setEnabled(true);
      this.hud.setMode(session.mode === 'drift' ? 'drift' : session.mode === 'daily' ? 'daily' : 'story');
      this.refreshShells();
      this.hud.setVisible(true);
      if (session.mode === 'story') this.hud.showCard(ROMAN[session.chapter - 1], session.level.name, session.level.line);
      else if (session.mode === 'daily') this.hud.showCard('Daily Tide', session.level.name, session.level.line);
      else if (this.driftBase === 0) this.hud.showCard('Drift', 'The quiet shore', 'Nowhere to be.');
      this.setState('playing');
    });
  }

  private loadWorld(level: LevelData, mode: GameMode, checkpoint: number): void {
    this.world = new World(level, {
      difficulty: this.save.data.settings.difficulty,
      mode,
      ownedShells: new Set(this.save.data.shells),
      startCheckpoint: checkpoint,
      tideScale: this.session.tideScale,
      drainScale: this.session.drainScale,
    });
    this.renderer.setWorld(this.world);
    this.audio.setBiome(level.biome);
    this.input?.reset();
    this.loop.reset();
    this.hintKind = null;
    this.hud?.setHint(null, false);
    if (this.bot) this.bot = new Bot(this.world, true);
  }

  private setState(state: State): void {
    this.state = state;
    this.stateT = 0;
    this.screenShown = false;
  }

  private fadeThrough(fn: () => void): void {
    this.fade.classList.add('on');
    window.setTimeout(() => {
      fn();
      window.setTimeout(() => this.fade.classList.remove('on'), 60);
    }, 320);
  }

  private togglePause(): void {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused' && this.ui.active === 'pause') this.resume();
  }

  private pause(): void {
    if (this.state !== 'playing') return;
    this.setState('paused');
    this.input.setEnabled(false);
    this.hud.setVisible(false);
    this.recordDrift();
    const s = this.session;
    this.ui.show('pause', { mode: s.mode, title: s.mode === 'drift' ? 'Drift' : s.level.name });
  }

  private refreshShells(): void {
    const w = this.world;
    this.hud.setShells(w.shells.length, w.shells.map((s) => s.taken || s.owned));
  }

  private recordDrift(): void {
    if (this.session.mode === 'drift') this.save.recordDrift(this.driftDistance());
  }

  private driftDistance(): number {
    return this.driftBase + Math.max(0, this.world.player.x - this.world.level.spawn.x) / PX_PER_METRE;
  }

  private finish(): void {
    const w = this.world;
    const s = this.session;
    this.setState('complete');
    this.input.setEnabled(false);
    this.director.triggerRelief(1);
    if (s.mode === 'daily') {
      const newBest = this.save.completeDaily(s.dailyKey, w.time);
      const d = this.save.data.daily;
      this.pendingComplete = { mode: 'daily', index: 0, name: s.level.name, time: w.time, best: d.bestTimes[s.dailyKey] ?? null, newBest, shellIds: [], routesFound: 0, routesTotal: 0, kin: w.kinAwake, streak: d.streak, last: false };
      return;
    }
    const newBest = this.save.completeChapter(s.chapter, w.time, [...w.secretsFound]);
    const rec = this.save.chapter(s.chapter);
    this.pendingComplete = {
      mode: 'story',
      index: s.chapter,
      name: s.level.name,
      time: w.time,
      best: rec.bestTime,
      newBest,
      shellIds: s.level.shells.map((x) => x.id),
      routesFound: rec.routes.filter((r) => s.level.secrets.some((z) => z.id === r)).length,
      routesTotal: s.level.secrets.length,
      kin: w.kinAwake,
      streak: 0,
      last: s.chapter === CHAPTER_COUNT,
    };
  }

  // ---- loop ------------------------------------------------------------------------------

  private background(): void {
    if (this.state === 'playing' && !this.bot) this.pause();
    this.recordDrift();
    this.audio.suspend();
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.input?.release();
  }

  private foreground(): void {
    if (document.hidden || this.running) return;
    this.audio.resume();
    this.running = true;
    this.last = performance.now();
    this.loop.reset();
    this.raf = requestAnimationFrame(this.frame);
  }

  /** Test hook: let the verification bot play the current level. */
  autoplay(collect = true): void {
    this.bot = new Bot(this.world, collect);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.clock += dt;
    this.stateT += dt;
    const frozen = this.state === 'paused';

    if (!frozen) {
      const w = this.world;
      const steps = this.loop.advance(dt) * this.debugSpeed;
      for (let i = 0; i < steps; i++) {
        const intent = this.state === 'playing' ? (this.bot ? this.bot.update(FIXED_DT) : this.input.read(now)) : this.idle;
        w.step(intent, FIXED_DT);
        if (w.status === 'failed' && this.state === 'playing') this.setState('failed');
        if (w.status === 'complete') break;
      }
      for (let i = 0; i < w.eventCount; i++) this.onEvent(w.events[i]);
      w.clearEvents();
      this.afterStep(dt);
    }

    this.updateAudio(dt, frozen);
    this.renderer.frame(this.world, frozen ? 1 : this.loop.alpha, dt, frozen);
  };

  private afterStep(dt: number): void {
    const w = this.world;
    const p = w.player;
    if (this.state === 'failed') {
      if (this.bot && this.stateT > 1.1) this.retry();
      else if (!this.screenShown && this.stateT > 1.15) {
        this.screenShown = true;
        this.hud.setVisible(false);
        this.input.setEnabled(false);
        this.ui.show('retry', { kind: p.status === 'swept' ? 'swept' : 'caught', assist: w.failsHere >= 3 });
      }
      return;
    }
    if (this.state === 'complete') {
      if (!this.screenShown && this.stateT > 1.5 && this.pendingComplete) {
        this.screenShown = true;
        this.hud.setVisible(false);
        this.ui.show('complete', this.pendingComplete);
        this.pendingComplete = null;
      }
      return;
    }
    if (this.state !== 'playing') return;

    this.hud.update(w.lumenFrac, w.tide.progress, 1 - p.pulseCd / P.pulseCooldown, p.danger, p.fadeT > 0, p.glowOn);
    this.haptics.danger(p.danger, this.clock);
    this.updateHints(dt);

    if (this.session.mode === 'drift') {
      this.hud.setDistance(this.driftDistance());
      if (p.x > w.level.goalX - 500) {
        // The shore goes on: carry the distance into a freshly generated stretch.
        this.driftBase = this.driftDistance();
        this.save.recordDrift(this.driftBase);
        this.driftSeed++;
        this.setState('complete');
        this.begin({ ...this.session, level: makeDriftLevel(this.driftSeed) }, -1);
      }
    }
  }

  /** Gesture hints: shown inside authored zones until the player performs the action once. */
  private updateHints(dt: number): void {
    const w = this.world;
    const p = w.player;
    const done = this.save.data.tutorial;
    let kind: HintKind | null = null;
    for (const hint of w.level.hints) {
      if (p.x >= hint.x && p.x <= hint.x + hint.w && !done[hint.kind]) {
        kind = hint.kind;
        break;
      }
    }
    if (kind !== this.hintKind) {
      this.hintKind = kind;
      this.hintT = 0;
      this.hud.setHint(kind, this.input.keyboardActive);
    }
    if (!kind) return;
    this.hintT += dt;
    const performed =
      (kind === 'move' && Math.abs(p.vx) > 70) ||
      (kind === 'glow' && p.glow > 0.95) ||
      (kind === 'dive' && p.swim && p.vy > 40) ||
      (kind === 'hide' && p.hidden) ||
      (kind === 'stop' && p.onGround && Math.abs(p.vx) < 5 && this.hintT > 0.5);
    if (performed) this.completeHint(kind);
  }

  private completeHint(kind: HintKind): void {
    if (this.hintKind !== kind) return;
    this.save.markTutorial(kind);
    this.hintKind = null;
    this.hud.setHint(null, false);
  }

  private onEvent(e: GameEvent): void {
    const w = this.world;
    const cam = this.renderer.camera;
    this.renderer.onEvent(e);
    const dx = e.x - cam.x;
    const dist = Math.hypot(dx, e.y - cam.y);
    this.audio.play(e.type, clamp(dx / 260, -1, 1), 1 / (1 + (dist / 320) * (dist / 320)), e.v);
    if (w.mode === 'title') return;

    switch (e.type) {
      case 'jump':
        this.completeHint('jump');
        break;
      case 'land':
        this.haptics.play(e.v > 520 ? 'hardLand' : 'land');
        break;
      case 'glowOn':
        this.haptics.play('glow');
        break;
      case 'pulse':
        this.haptics.play('pulse');
        this.completeHint('pulse');
        break;
      case 'dash':
        this.completeHint('dash');
        break;
      case 'sting':
        this.haptics.play('sting');
        break;
      case 'bite':
        this.haptics.play('bite');
        break;
      case 'nearMiss':
        this.haptics.play('nearMiss');
        this.director.triggerRelief(0.5);
        break;
      case 'caught':
      case 'swept':
        this.haptics.play('caught');
        break;
      case 'pickup':
      case 'plant':
      case 'kin':
        this.haptics.play('pickup');
        break;
      case 'shell': {
        const shell = w.shells[e.v];
        if (shell && this.session.mode === 'story') {
          const fresh = this.save.addShell(shell.id);
          this.hud.showNote(fresh ? 'A memory, kept' : 'A memory you already hold', 'shell');
        }
        this.refreshShells();
        this.haptics.play('shell');
        this.director.triggerRelief(0.7);
        this.audio.relief(0.6);
        break;
      }
      case 'checkpoint':
        if (this.session.mode === 'story') this.save.setCheckpoint(this.session.chapter, e.v);
        this.haptics.play('checkpoint');
        this.director.triggerRelief(0.6);
        break;
      case 'secret':
        this.hud.showNote('A hidden way', 'route');
        break;
      case 'assist':
        this.hud.showNote('A gentler way is glowing', 'pulse');
        break;
      case 'goal':
        this.haptics.play('checkpoint');
        this.audio.relief(1);
        this.finish();
        break;
      default:
        break;
    }
  }

  private updateAudio(dt: number, frozen: boolean): void {
    const w = this.world;
    const p = w.player;
    const a = this.audioIn;
    a.mode = w.mode;
    a.biome = w.level.biome;
    a.danger = this.state === 'playing' ? p.danger : 0;
    a.tide = w.tide.progress;
    a.lumen = w.lumenFrac;
    a.glow = this.state === 'playing' ? p.glow : 0;
    a.submerged = p.swim && p.y > w.waterY + 14;
    a.rain = w.level.weather.rain;
    a.wind = w.level.weather.wind;
    a.paused = frozen;
    a.menu = this.state === 'title' || this.ui.active !== null;
    this.audio.update(this.director.update(a, dt));
  }
}
