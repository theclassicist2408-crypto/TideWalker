import { AudioDirector, type AudioInputs } from '../audio/director';
import { AudioEngine } from '../audio/engine';
import { Haptics } from '../effects/haptics';
import { GameRenderer } from '../effects/renderer';
import { bossDef } from '../entities/bosses';
import { InputManager } from '../input/input';
import { allAreas, areaCount, areaInfo, getLevel, getTutorial } from '../levels';
import { makeDriftLevel, titleLevel } from '../levels/drift';
import { fullLoadout } from '../levels/progress';
import { browserStorage, SaveStore } from '../save/save';
import { ROMAN } from '../ui/dom';
import { Hud } from '../ui/hud';
import { Ui, type AreaView, type CompleteInfo, type Earned, type UiHost } from '../ui/screens';
import { Bot } from './bot';
import { ALL_RELICS, FIXED_DT, LEVELS_PER_AREA, RELICS, REWARDS } from './constants';
import { FixedLoop } from './loop';
import { ABILITY_NAMES, UPGRADE_NAMES } from './names';
import { newIntent, type GameEvent, type GameMode, type HintKind, type LevelData } from './types';
import { clamp } from './util';
import { World } from './world';

type State = 'title' | 'playing' | 'paused' | 'dead' | 'complete';

interface Session {
  mode: GameMode;
  area: number;
  level: number;
  data: LevelData;
}

const PX_PER_METRE = 20;
const RESPAWN_AFTER = 0.9;

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
  private session: Session = { mode: 'title', area: 0, level: 0, data: titleLevel() };
  private readonly idle = newIntent();
  private readonly audioIn: AudioInputs = { mode: 'title', biome: 'pools', danger: 0, tide: 0, lumen: 1, glow: 0, submerged: false, rain: 0, wind: 0, paused: false, menu: true, boss: false };
  private last = 0;
  private running = false;
  private raf = 0;
  private stateT = 0;
  private screenShown = false;
  private pending: CompleteInfo | null = null;
  private earned: Earned[] = [];
  private driftBase = 0;
  private driftSeed = 1;
  private hintKind: HintKind | null = null;
  private hintT = 0;
  private hintsSeen = new Set<HintKind>();
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
    this.hud = new Hud(this.hudRoot);
    this.input = new InputManager(this.hud.pad, this.stage);
    this.input.onFirstGesture = () => this.audio.unlock();
    this.input.onPauseKey = () => this.togglePause();
    this.input.onCycle = () => this.cycleGift();
    this.input.onCycleRelic = () => this.cycleRelic();
    this.input.onMenu = (a) => this.ui.navigate(a);
    this.hud.onPause = () => this.togglePause();
    this.hud.onCycle = () => this.cycleGift();
    this.hud.onRelic = () => this.input.tapItem();
    this.ui = new Ui(this.uiRoot, this);
    this.renderer.onThunder = () => this.audio.thunder();
    this.settingsChanged();
    this.loadWorld(this.session, -1);
    this.ui.show('title');

    // Browsers only allow sound after a user gesture, and may revoke it after an interruption.
    for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
      window.addEventListener(type, () => this.audio.unlock(), { passive: true });
    }
    window.addEventListener('resize', () => this.renderer.resize());
    window.addEventListener('orientationchange', () => window.setTimeout(() => this.renderer.resize(), 200));
    document.addEventListener('visibilitychange', () => (document.hidden ? this.background() : this.foreground()));
    window.addEventListener('pagehide', () => this.background());
    this.foreground();
  }

  // ---- UiHost ----------------------------------------------------------------------------

  areas(): AreaView[] {
    return allAreas().map((a) => ({
      index: a.index,
      name: a.name,
      line: a.line,
      bossId: a.boss,
      bossName: bossDef(a.boss).name,
      levels: Array.from({ length: LEVELS_PER_AREA }, (_, i) => {
        const l = getLevel(a.index, i + 1);
        return { id: l.id, index: l.index, name: l.name, twist: l.twist, boss: l.arenas.some((x) => x.boss !== undefined) };
      }),
    }));
  }

  /** Begin, Continue, Onward: whatever comes next in the story. */
  continueGame(): void {
    const d = this.save.data;
    if (!d.tutorialDone) return this.begin({ mode: 'tutorial', area: 0, level: 0, data: getTutorial() }, -1);
    const cp = d.checkpoint;
    if (cp) {
      const m = /^a(\d{2})-(\d{2})$/.exec(cp.level);
      if (m && this.save.isOpen(Number(m[1]), Number(m[2]))) return this.playLevel(Number(m[1]), Number(m[2]), cp.index);
    }
    const order = Math.min(d.unlocked, areaCount() * LEVELS_PER_AREA) - 1;
    this.playLevel(Math.floor(order / LEVELS_PER_AREA) + 1, (order % LEVELS_PER_AREA) + 1);
  }

  playLevel(area: number, level: number, checkpoint = -1): void {
    const a = clamp(Math.round(area), 1, areaCount());
    const n = clamp(Math.round(level), 1, LEVELS_PER_AREA);
    if (checkpoint < 0) this.save.clearCheckpoint();
    this.begin({ mode: 'story', area: a, level: n, data: getLevel(a, n) }, checkpoint);
  }

  /** Fights an area's boss again, starting at the lantern outside its arena. */
  playRematch(area: number): void {
    const data = getLevel(area, LEVELS_PER_AREA);
    this.begin({ mode: 'rematch', area, level: LEVELS_PER_AREA, data }, data.checkpoints.length - 1);
  }

  playDrift(): void {
    this.driftBase = 0;
    this.driftSeed = 1 + Math.floor(Math.random() * 100000);
    this.begin({ mode: 'drift', area: 0, level: 0, data: makeDriftLevel(this.driftSeed) }, -1);
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.ui.clear();
    this.setState('playing');
    this.input.setEnabled(true);
    this.hud.setVisible(true);
    this.loop.reset();
  }

  toLantern(): void {
    if (this.state !== 'paused' && this.state !== 'dead') return;
    this.world.respawn();
    if (this.bot) this.bot = new Bot(this.world, true);
    this.ui.clear();
    this.input.reset();
    this.input.setEnabled(true);
    this.hud.setVisible(true);
    this.setState('playing');
    this.loop.reset();
  }

  restartLevel(): void {
    const s = this.session;
    if (s.mode === 'drift') return this.playDrift();
    if (s.mode === 'rematch') return this.playRematch(s.area);
    this.save.clearCheckpoint();
    this.begin(s, -1);
  }

  quitToTitle(then?: 'areas'): void {
    this.recordDrift();
    this.fadeThrough(() => {
      this.bot = null;
      this.session = { mode: 'title', area: 0, level: 0, data: titleLevel() };
      this.loadWorld(this.session, -1);
      this.input.setEnabled(false);
      this.hud.setVisible(false);
      this.hud.hideCard();
      this.setState('title');
      this.ui.show('title');
      if (then && this.save.data.tutorialDone) this.ui.push(then);
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
      this.earned = [];
      this.loadWorld(session, checkpoint);
      this.ui.clear();
      this.input.setEnabled(true);
      this.hud.setMode(session.mode === 'drift' ? 'drift' : 'story');
      this.refreshShells();
      this.refreshWallet();
      this.hud.setVisible(true);
      const d = session.data;
      if (session.mode === 'story') this.hud.showCard(`${ROMAN[session.area - 1]} · ${session.level}  ${areaInfo(session.area).name}`, d.name, d.twist);
      else if (session.mode === 'tutorial') this.hud.showCard('Before the fall', d.name, d.line);
      else if (session.mode === 'rematch') this.hud.showCard('Rematch', bossDef(areaInfo(session.area).boss).name, d.name);
      else if (this.driftBase === 0) this.hud.showCard('Drift', 'The quiet shore', 'Nowhere to be.');
      this.setState('playing');
    });
  }

  private loadWorld(session: Session, checkpoint: number): void {
    const d = this.save.data;
    const free = session.mode === 'tutorial' || session.mode === 'drift' || session.mode === 'title';
    this.world = new World(session.data, {
      difficulty: d.settings.difficulty,
      mode: session.mode,
      loadout: free ? fullLoadout() : this.save.loadout(),
      ownedShells: new Set(d.shells),
      openedChests: new Set(d.chests),
      defeated: new Set(d.defeated),
      taken: new Set(d.grants),
      startCheckpoint: checkpoint,
    });
    this.renderer.setWorld(this.world);
    this.audio.setBiome(session.data.biome);
    this.input?.reset();
    this.loop.reset();
    this.hintKind = null;
    this.hintsSeen.clear();
    this.hud?.setHint(null, false);
    this.hud?.setBoss(null, 0);
    this.hud?.setTimer(null);
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
      window.setTimeout(() => this.fade.classList.remove('on'), 50);
    }, 220);
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
    this.ui.show('pause', { mode: s.mode, title: s.mode === 'drift' ? 'Drift' : s.data.name, twist: s.mode === 'story' ? s.data.twist : '' });
  }

  private cycleGift(): void {
    if (this.state !== 'playing' || this.session.mode === 'tutorial' || this.session.mode === 'drift') return;
    const next = this.save.cycleReward();
    if (!next) return;
    this.world.load.equipped = next;
    this.hud.showNote(REWARDS[next].name, 'pulse');
    this.audio.ui('toggle');
  }

  /** Plasma (banked plus carried), diamonds, and the relic in hand. */
  private refreshWallet(): void {
    const w = this.world;
    const d = this.save.data;
    const relic = w.load.relic;
    this.hud.setWallet(d.plasma + w.plasma, w.plasma, d.diamonds, relic ? RELICS[relic].name : null, relic ? w.load.relics[relic] : 0);
  }

  private cycleRelic(): void {
    if (this.state !== 'playing' || this.session.mode !== 'story') return;
    const next = this.save.cycleRelic();
    if (!next) return;
    this.world.load.relic = next;
    this.refreshWallet();
    this.audio.ui('toggle');
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
    if (s.mode === 'tutorial') {
      this.save.completeTutorial();
      this.pending = null;
      return;
    }
    if (s.mode === 'rematch') {
      this.pending = { area: 0, level: 0, name: bossDef(areaInfo(s.area).boss).name, time: w.time, best: null, newBest: false, deaths: w.totalFails, shellIds: [], earned: [], next: 'map' };
      return;
    }
    const newBest = this.save.completeLevel(s.data.id, s.area, s.level, w.time, [...w.secretsFound]);
    const lastLevel = s.level === LEVELS_PER_AREA;
    const lastArea = s.area === areaCount();
    this.pending = {
      area: s.area,
      level: s.level,
      name: s.data.name,
      time: w.time,
      best: this.save.level(s.data.id).bestTime,
      newBest,
      deaths: w.totalFails,
      shellIds: s.data.shells.map((x) => x.id),
      earned: this.earned,
      next: lastLevel && lastArea ? 'ending' : lastLevel ? 'area' : 'level',
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
    this.input.pollGamepad(now, this.state === 'playing' && !this.bot);

    if (!frozen) {
      const w = this.world;
      const steps = this.loop.advance(dt) * this.debugSpeed;
      for (let i = 0; i < steps; i++) {
        // A landed blow freezes the world for a few frames: the hit is felt before it resolves.
        if (w.hitstop > 0) {
          w.hitstop -= FIXED_DT;
          continue;
        }
        const intent = this.state === 'playing' ? (this.bot ? this.bot.update(FIXED_DT) : this.input.read(now)) : this.idle;
        w.step(intent, FIXED_DT);
        if (w.status === 'failed' && this.state === 'playing') this.setState('dead');
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
    if (this.state === 'dead') {
      // No retry screen: the lantern takes you back at once, so the lesson is still fresh.
      if (this.stateT > RESPAWN_AFTER) this.toLantern();
      return;
    }
    if (this.state === 'complete') {
      if (!this.screenShown && this.stateT > 1.2) {
        this.screenShown = true;
        this.hud.setVisible(false);
        if (this.session.mode === 'tutorial') this.ui.show('fall');
        else if (this.pending) this.ui.show('complete', this.pending);
        this.pending = null;
      }
      return;
    }
    if (this.state !== 'playing') return;

    const drift = this.session.mode === 'drift';
    this.hud.update(p.hp, w.load.hpMax, w.lumenFrac, p.essence, w.load.essenceMax, p.healT > 0, p.danger);
    const b = w.boss;
    this.hud.setBoss(b && b.mode !== 'dead' ? b.def.name : null, b ? b.hp / b.hpMax : 0);
    this.hud.setTimer(w.level.rules.timeLimit ? w.timeLeft : null);
    const gift = !drift && this.session.mode !== 'tutorial' ? w.load.equipped : null;
    this.hud.setGift(gift ? REWARDS[gift].name : null, p.abilityCd <= 0 && p.lumen >= (gift ? REWARDS[gift].cost : 0));
    this.haptics.danger(p.danger, this.clock);
    this.updateHints(dt);

    if (drift) {
      this.hud.setDistance(this.driftDistance());
      if (p.x > w.level.goalX - 500) {
        this.driftBase = this.driftDistance();
        this.save.recordDrift(this.driftBase);
        this.driftSeed++;
        this.setState('complete');
        this.begin({ ...this.session, data: makeDriftLevel(this.driftSeed) }, -1);
      }
    }
  }

  /** Prompts: shown inside authored zones until the player has done the thing. */
  private updateHints(dt: number): void {
    const w = this.world;
    const p = w.player;
    const tutorial = this.session.mode === 'tutorial';
    let kind: HintKind | null = null;
    for (const hint of w.level.hints) {
      if (p.x < hint.x || p.x > hint.x + hint.w) continue;
      if (this.hintsSeen.has(hint.kind) || (!tutorial && this.save.data.hints[hint.kind])) continue;
      kind = hint.kind;
      break;
    }
    if (kind !== this.hintKind) {
      this.hintKind = kind;
      this.hintT = 0;
      this.hud.setHint(kind, this.input.keyboardActive);
    }
    if (!kind) return;
    this.hintT += dt;
    const timed = kind === 'danger' || kind === 'pause' || kind === 'bench' || kind === 'boss' || kind === 'rematch' || kind === 'ability';
    const done =
      (kind === 'move' && Math.abs(p.vx) > 120) ||
      (kind === 'swim' && p.swim && this.hintT > 1) ||
      (kind === 'dive' && p.swim && p.y > w.waterAt(p.x) + 40) ||
      (kind === 'glide' && p.gliding && this.hintT > 0.4) ||
      (kind === 'glow' && p.glow > 0.95) ||
      (timed && this.hintT > 4.5);
    if (done) this.completeHint(kind);
  }

  private completeHint(kind: HintKind): void {
    if (this.hintKind !== kind) return;
    this.hintsSeen.add(kind);
    if (this.session.mode !== 'tutorial') this.save.markHint(kind);
    this.hintKind = null;
    this.hud.setHint(null, false);
  }

  private onEvent(e: GameEvent): void {
    const w = this.world;
    const p = w.player;
    const cam = this.renderer.camera;
    this.renderer.onEvent(e);
    const dx = e.x - cam.x;
    const dist = Math.hypot(dx, e.y - cam.y);
    this.audio.play(e.type, clamp(dx / 260, -1, 1), 1 / (1 + (dist / 320) * (dist / 320)), e.v);
    if (w.mode === 'title') return;
    const story = this.session.mode === 'story';

    switch (e.type) {
      case 'jump':
        this.completeHint('jump');
        break;
      case 'doubleJump':
        this.completeHint('double');
        break;
      case 'wallJump':
        this.completeHint('wall');
        break;
      case 'dash':
        this.completeHint(p.onGround ? 'dash' : 'airdash');
        if (!p.onGround) this.completeHint('dash');
        break;
      case 'slash':
        this.completeHint('attack');
        break;
      case 'pogo':
        this.completeHint('downstrike');
        break;
      case 'chargeSlash':
        this.completeHint('charge');
        break;
      case 'pulse':
        this.haptics.play('pulse');
        this.completeHint('pulse');
        break;
      case 'land':
        this.haptics.play(e.v > 520 ? 'hardLand' : 'land');
        break;
      case 'glowOn':
        this.haptics.play('glow');
        break;
      case 'hit':
      case 'pickup':
      case 'plant':
        this.haptics.play('pickup');
        break;
      case 'hurt':
        this.haptics.play('bite');
        break;
      case 'death':
        this.haptics.play('caught');
        break;
      case 'heal':
        this.haptics.play('checkpoint');
        this.completeHint('heal');
        break;
      case 'shell': {
        const shell = w.shells[e.v];
        if (shell && story) {
          const fresh = this.save.addShell(shell.id);
          this.hud.showNote(fresh ? 'A memory, kept' : 'A memory you already hold', 'shell');
        }
        this.refreshShells();
        this.haptics.play('shell');
        this.director.triggerRelief(0.7);
        this.audio.relief(0.6);
        break;
      }
      case 'bank':
        // Plasma carried since the last lantern is safe now.
        this.save.addPlasma(e.v);
        this.refreshWallet();
        break;
      case 'plasma':
        this.refreshWallet();
        break;
      case 'plasmaLost':
        this.hud.showNote(`${e.v} plasma lost`, 'pulse');
        this.refreshWallet();
        break;
      case 'diamond':
        if (story || this.session.mode === 'rematch') {
          this.save.addDiamonds(e.v);
          this.hud.showNote(e.v > 1 ? `${e.v} diamonds` : 'A diamond', 'diamond');
        }
        this.refreshWallet();
        break;
      case 'chest': {
        const c = w.chests[e.v];
        if (!c || !story) break;
        if (this.save.openChest(c)) {
          this.save.addPlasma(c.plasma);
          const parts = [c.plasma > 0 ? `${c.plasma} plasma` : '', c.diamonds > 0 ? `${c.diamonds} ◆` : '', c.relic ? RELICS[c.relic].name : ''].filter(Boolean);
          this.hud.showNote(parts.join(' · '), 'chest');
          if (c.relic) w.load.relics[c.relic]++;
          if (c.relic && !w.load.relic) w.load.relic = c.relic;
        }
        this.refreshWallet();
        this.haptics.play('shell');
        this.audio.relief(0.5);
        break;
      }
      case 'relic': {
        const id = ALL_RELICS[e.v];
        if (id && story) this.save.spendRelic(id);
        if (id && w.load.relics[id] <= 0) w.load.relic = this.save.relicInHand();
        this.refreshWallet();
        this.haptics.play('hardLand');
        break;
      }
      case 'trialEnter': {
        const t = w.level.trials[e.v];
        if (t) this.hud.showCard('Trial', t.name, 'Win the fight. The prize is past it.');
        this.renderer.snapCamera();
        break;
      }
      case 'trialExit': {
        const t = w.level.trials[e.v];
        if (t && story && this.save.finishTrial(t.id)) this.hud.showNote('Trial won', 'chest');
        this.renderer.snapCamera();
        break;
      }
      case 'checkpoint':
        if (story) this.save.setCheckpoint(this.session.data.id, e.v);
        this.haptics.play('checkpoint');
        this.director.triggerRelief(0.6);
        this.completeHint('bench');
        break;
      case 'grant': {
        const g = w.grants[e.v];
        if (!g) break;
        const [title, line] = g.ability ? ABILITY_NAMES[g.ability] : UPGRADE_NAMES[g.upgrade ?? 'health'];
        if (story && this.save.takeGrant(`${this.session.data.id}:${e.v}`, g)) this.earned.push({ title, line });
        this.hud.showNote(g.ability ? `${title} returns` : title, 'pulse');
        this.haptics.play('shell');
        this.director.triggerRelief(1);
        this.audio.relief(1);
        break;
      }
      case 'bossIntro':
        this.haptics.play('danger');
        break;
      case 'minibossDown':
      case 'bossDown': {
        const a = w.arenas[e.v];
        const id = a ? (a.boss ?? a.miniboss) : undefined;
        if (!id) break;
        const def = bossDef(id);
        this.haptics.play('shell');
        this.director.triggerRelief(1);
        this.audio.relief(1);
        if (!story) break;
        this.save.defeat(id, def.reward);
        if (def.reward) {
          // The gift is usable at once, and equipped.
          w.load.rewards.add(def.reward);
          w.load.equipped = def.reward;
          const r = REWARDS[def.reward];
          this.earned.push({ title: r.name, line: r.line });
          this.hud.showNote(`${r.name} is yours`, 'pulse');
        }
        break;
      }
      case 'secret':
        this.hud.showNote('A hidden way', 'route');
        break;
      case 'assist':
        this.hud.showNote('The deep relents a little', 'pulse');
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
    a.submerged = p.swim && p.y > w.waterAt(p.x) + 14;
    a.rain = w.level.weather.rain;
    a.wind = w.level.weather.wind;
    a.paused = frozen;
    a.menu = this.state === 'title' || this.ui.active !== null;
    a.boss = w.boss !== null && w.boss.mode !== 'dead';
    this.audio.update(this.director.update(a, dt));
  }
}
