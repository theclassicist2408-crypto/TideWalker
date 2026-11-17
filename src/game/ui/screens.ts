import { paintVignette, shellForVignette, VIGNETTE_COUNT } from '../../assets/data/vignettes';
import { LEVELS_PER_AREA } from '../core/constants';
import type { Difficulty } from '../core/types';
import { formatTime } from '../core/util';
import type { SaveStore, Settings } from '../save/save';
import { h, icon, ROMAN } from './dom';

export interface LevelInfo {
  id: string;
  index: number;
  name: string;
  twist: string;
  boss: boolean;
}

export interface AreaView {
  index: number;
  name: string;
  line: string;
  bossId: string;
  bossName: string;
  levels: LevelInfo[];
}

export interface Earned {
  title: string;
  line: string;
}

export interface CompleteInfo {
  area: number;
  level: number;
  name: string;
  time: number;
  best: number | null;
  newBest: boolean;
  deaths: number;
  shellIds: string[];
  earned: Earned[];
  /** What the main button does next. */
  next: 'level' | 'area' | 'ending' | 'map';
}

/** Everything the screens need from the game. Keeps UI free of game internals. */
export interface UiHost {
  save: SaveStore;
  areas(): AreaView[];
  continueGame(): void;
  playLevel(area: number, level: number): void;
  playRematch(area: number): void;
  playDrift(): void;
  resume(): void;
  toLantern(): void;
  restartLevel(): void;
  quitToTitle(then?: 'areas'): void;
  settingsChanged(): void;
  sound(kind: 'tap' | 'open' | 'back' | 'toggle'): void;
}

export type ScreenName = 'title' | 'areas' | 'levels' | 'settings' | 'pause' | 'complete' | 'fall' | 'gallery' | 'drift' | 'ending' | 'credits';

const DIFFICULTY_TEXT: Record<Difficulty, string> = {
  gentle: 'Two more lives, longer warnings, softer foes. Every guardian still stands.',
  standard: 'The deep as it was meant to be crossed.',
  intense: 'Shorter warnings, and foes that are faster and tougher.',
};

const ENDING_LINES = ['The Tide King is quiet now.', 'The moon he drowned is rising.', 'Everything he took from you, you took back,', 'and the deep gave you more besides.', 'You are home.'];

/** Screen stack with fades. One screen is visible at a time; `back()` returns to the previous one. */
export class Ui {
  private readonly stack: { name: ScreenName; params?: unknown }[] = [];
  private current: HTMLElement | null = null;
  private timers: number[] = [];

  constructor(
    private readonly root: HTMLElement,
    private readonly host: UiHost,
  ) {}

  get active(): ScreenName | null {
    return this.stack.length ? this.stack[this.stack.length - 1].name : null;
  }

  show(name: ScreenName, params?: unknown): void {
    this.stack.length = 0;
    this.push(name, params);
  }

  push(name: ScreenName, params?: unknown): void {
    this.stack.push({ name, params });
    this.render();
  }

  back(): void {
    if (this.stack.length <= 1) return;
    this.host.sound('back');
    this.stack.pop();
    this.render();
  }

  clear(): void {
    this.stack.length = 0;
    this.cancelTimers();
    this.swap(null);
  }

  private render(): void {
    const top = this.stack[this.stack.length - 1];
    this.cancelTimers();
    this.swap(this.build(top.name, top.params));
  }

  private cancelTimers(): void {
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
  }

  private swap(next: HTMLElement | null): void {
    const prev = this.current;
    if (prev) {
      prev.classList.remove('in');
      prev.classList.add('out');
      window.setTimeout(() => prev.remove(), 300);
    }
    this.current = next;
    this.root.classList.toggle('open', next !== null);
    if (next) {
      this.root.append(next);
      const enter = (): void => next.classList.add('in');
      requestAnimationFrame(enter);
      window.setTimeout(enter, 60);
      next.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
    }
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(fn, ms));
  }

  private btn(label: string, onclick: () => void, cls = '', sound: 'tap' | 'open' = 'tap'): HTMLButtonElement {
    return h('button', {
      class: `btn ${cls}`,
      text: label,
      onclick: () => {
        this.host.sound(sound);
        onclick();
      },
    });
  }

  private header(title: string, onBack?: () => void): HTMLElement {
    return h('header', { class: 'screen-head' }, h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: () => (onBack ? onBack() : this.back()) }, icon('back', 26)), h('h2', { text: title }));
  }

  private build(name: ScreenName, params: unknown): HTMLElement {
    switch (name) {
      case 'title':
        return this.title();
      case 'areas':
        return this.areas();
      case 'levels':
        return this.levels(params as number);
      case 'settings':
        return this.settings();
      case 'pause':
        return this.pause(params as { mode: string; title: string; twist: string });
      case 'complete':
        return this.complete(params as CompleteInfo);
      case 'fall':
        return this.fall();
      case 'gallery':
        return this.gallery();
      case 'drift':
        return this.drift();
      case 'ending':
        return this.ending(params as { shells: number; deaths: number });
      default:
        return this.credits();
    }
  }

  private title(): HTMLElement {
    const save = this.host.save.data;
    const play = this.btn(save.tutorialDone ? 'Continue' : 'Begin', () => this.host.continueGame(), 'primary', 'open');
    play.setAttribute('data-autofocus', '');
    return h(
      'section',
      { class: 'screen title-screen' },
      h('div', { class: 'title-mark' }, h('span', { class: 'title-dot' }), h('h1', { text: 'Tidewalker' }), h('p', { text: 'take back your light' })),
      h(
        'nav',
        { class: 'menu' },
        play,
        save.tutorialDone ? this.btn('The Deep', () => this.push('areas'), '', 'open') : null,
        this.btn('Drift', () => this.push('drift'), '', 'open'),
        this.btn('Memories', () => this.push('gallery'), '', 'open'),
        h('div', { class: 'menu-row' }, this.btn('Settings', () => this.push('settings'), 'quiet', 'open'), this.btn('Credits', () => this.push('credits'), 'quiet', 'open')),
      ),
    );
  }

  /** The map: ten areas, how far each has been cleared, and rematches with fallen bosses. */
  private areas(): HTMLElement {
    const store = this.host.save;
    const list = h('div', { class: 'chapter-list' });
    for (const a of this.host.areas()) {
      const open = store.isOpen(a.index, 1);
      const done = a.levels.filter((l) => store.level(l.id).done).length;
      const beaten = store.data.defeated.includes(a.bossId);
      const card = h(
        'div',
        { class: `area-card${open ? '' : ' locked'}${beaten ? ' done' : ''}` },
        h('span', { class: 'chapter-num', text: ROMAN[a.index - 1] }),
        h(
          'button',
          {
            class: 'chapter-text',
            disabled: !open,
            'aria-label': open ? `Area ${a.index}: ${a.name}` : `Area ${a.index}, locked`,
            onclick: () => {
              this.host.sound('open');
              this.push('levels', a.index);
            },
          },
          h('h3', { text: open ? a.name : '· · ·' }),
          h('p', { text: open ? a.line : 'Not yet reached.' }),
        ),
        h(
          'div',
          { class: 'area-side' },
          open ? h('span', { text: `${done}/${LEVELS_PER_AREA}` }) : icon('lock', 20),
          beaten
            ? h('button', {
                class: 'rematch',
                text: 'Rematch',
                'aria-label': `Rematch ${a.bossName}`,
                onclick: () => {
                  this.host.sound('open');
                  this.host.playRematch(a.index);
                },
              })
            : null,
        ),
      );
      list.append(card);
    }
    return h('section', { class: 'screen panel-screen' }, this.header('The Deep'), list);
  }

  private levels(area: number): HTMLElement {
    const store = this.host.save;
    const a = this.host.areas()[area - 1];
    const grid = h('div', { class: 'level-grid' });
    for (const l of a.levels) {
      const open = store.isOpen(area, l.index);
      const rec = store.level(l.id);
      grid.append(
        h(
          'button',
          {
            class: `level-card${open ? '' : ' locked'}${rec.done ? ' done' : ''}${l.boss ? ' boss' : ''}`,
            disabled: !open,
            'aria-label': open ? `Level ${l.index}: ${l.name}` : `Level ${l.index}, locked`,
            onclick: () => {
              this.host.sound('open');
              this.host.playLevel(area, l.index);
            },
          },
          h('b', { text: open ? `${l.index} · ${l.name}` : `${l.index} · · ·` }),
          h('small', { text: open ? l.twist : 'Not yet reached.' }),
          rec.bestTime !== null ? h('span', { class: 'chip' }, icon('clock', 14), h('span', { text: formatTime(rec.bestTime) })) : open ? null : h('span', { class: 'chip' }, icon('lock', 14)),
        ),
      );
    }
    return h('section', { class: 'screen panel-screen' }, this.header(a.name), h('p', { class: 'note center', text: a.line }), grid);
  }

  private settings(): HTMLElement {
    const store = this.host.save;
    const s = (): Settings => store.data.settings;
    const set = (patch: Partial<Settings>): void => {
      store.updateSettings(patch);
      this.host.settingsChanged();
    };
    const slider = (label: string, key: 'master' | 'music' | 'sfx'): HTMLElement => {
      const input = h('input', { type: 'range', min: '0', max: '100', step: '5', value: String(Math.round(s()[key] * 100)), 'aria-label': label });
      input.addEventListener('input', () => set({ [key]: Number(input.value) / 100 }));
      input.addEventListener('change', () => this.host.sound('toggle'));
      return h('label', { class: 'row' }, h('span', { text: label }), input);
    };
    const toggle = (label: string, key: 'haptics' | 'reducedMotion' | 'screenShake' | 'visualCues' | 'batterySaver', note?: string): HTMLElement => {
      const b = h('button', { class: 'switch', role: 'switch', 'aria-checked': String(s()[key]), 'aria-label': label }, h('i'));
      b.addEventListener('click', () => {
        set({ [key]: !s()[key] });
        b.setAttribute('aria-checked', String(s()[key]));
        this.host.sound('toggle');
      });
      return h('div', { class: 'row' }, h('span', {}, label, note ? h('small', { text: note }) : null), b);
    };
    const segment = <T extends string | number>(label: string, options: [T, string][], get: () => T, apply: (v: T) => void, after?: () => void): HTMLElement => {
      const group = h('div', { class: 'segment', role: 'radiogroup', 'aria-label': label });
      const paint = (): void => {
        Array.from(group.children).forEach((el, i) => el.setAttribute('aria-checked', String(options[i][0] === get())));
      };
      for (const [value, text] of options) {
        group.append(
          h('button', {
            role: 'radio',
            text,
            onclick: () => {
              apply(value);
              paint();
              this.host.sound('toggle');
              after?.();
            },
          }),
        );
      }
      paint();
      return h('div', { class: 'row stack' }, h('span', { text: label }), group);
    };
    const diffNote = h('p', { class: 'note', text: DIFFICULTY_TEXT[s().difficulty] });
    const reset = this.btn(
      'Reset progress',
      () => {
        const dialog = h(
          'div',
          { class: 'confirm' },
          h('p', { text: 'Forget every area, power, shell and record? Settings are kept.' }),
          h(
            'div',
            { class: 'menu-row' },
            this.btn('Keep', () => dialog.remove(), 'quiet'),
            this.btn(
              'Forget',
              () => {
                store.resetProgress();
                dialog.remove();
                this.host.settingsChanged();
                this.host.quitToTitle();
              },
              'danger',
            ),
          ),
        );
        screen.append(dialog);
      },
      'quiet danger',
    );
    const screen = h(
      'section',
      { class: 'screen panel-screen' },
      this.header('Settings'),
      h(
        'div',
        { class: 'settings' },
        h('h4', { text: 'Sound' }),
        slider('Overall', 'master'),
        slider('Music', 'music'),
        slider('Effects', 'sfx'),
        h('h4', { text: 'Feel' }),
        toggle('Haptics', 'haptics'),
        toggle('Screen shake', 'screenShake'),
        toggle('Reduced motion', 'reducedMotion', 'Calmer camera, fewer particles, no flashes'),
        h('h4', { text: 'Access' }),
        segment<number>('Text size', [[0.9, 'S'], [1, 'M'], [1.2, 'L'], [1.4, 'XL']], () => s().textScale, (v) => set({ textScale: v })),
        toggle('Visual sound cues', 'visualCues', 'Show danger you would otherwise only hear'),
        segment<'left' | 'right'>('Controls', [['left', 'Left hand'], ['right', 'Right hand']], () => s().handed, (v) => set({ handed: v })),
        h('h4', { text: 'Difficulty' }),
        segment<Difficulty>('Challenge', [['gentle', 'Gentle'], ['standard', 'Standard'], ['intense', 'Intense']], () => s().difficulty, (v) => set({ difficulty: v }), () => (diffNote.textContent = DIFFICULTY_TEXT[s().difficulty])),
        diffNote,
        h('p', { class: 'note', text: 'Every level, guardian and the ending exist on every difficulty. A change takes effect when you next start or restart a level.' }),
        h('h4', { text: 'Device' }),
        toggle('Battery saver', 'batterySaver', 'Lower resolution for cooler, longer play'),
        reset,
      ),
    );
    return screen;
  }

  private pause(p: { mode: string; title: string; twist: string }): HTMLElement {
    const resume = this.btn('Resume', () => this.host.resume(), 'primary');
    resume.setAttribute('data-autofocus', '');
    const story = p.mode !== 'drift';
    return h(
      'section',
      { class: 'screen center-screen dim' },
      h('p', { class: 'eyebrow', text: 'Paused' }),
      h('h2', { text: p.title }),
      p.twist ? h('p', { text: p.twist }) : null,
      h(
        'nav',
        { class: 'menu' },
        resume,
        story ? this.btn('Back to last lantern', () => this.host.toLantern()) : null,
        story ? this.btn('Restart level', () => this.host.restartLevel()) : null,
        this.btn('Settings', () => this.push('settings'), '', 'open'),
        this.btn('Leave', () => this.host.quitToTitle(p.mode === 'story' || p.mode === 'rematch' ? 'areas' : undefined), 'quiet'),
      ),
    );
  }

  private complete(c: CompleteInfo): HTMLElement {
    const store = this.host.save;
    const shells = h('div', { class: 'shell-row' }, ...c.shellIds.map((id) => h('span', { class: `pip big${store.data.shells.includes(id) ? ' got' : ''}` }, icon('shell', 30))));
    const stats = h(
      'div',
      { class: 'stats' },
      h('div', {}, icon('clock', 18), h('b', { text: formatTime(c.time) }), h('small', { text: c.newBest ? 'new best' : c.best !== null ? `best ${formatTime(c.best)}` : '' })),
      h('div', {}, icon('pulse', 18), h('b', { text: String(c.deaths) }), h('small', { text: c.deaths === 0 ? 'unbroken' : c.deaths === 1 ? 'fall' : 'falls' })),
    );
    const earned = c.earned.length ? h('div', { class: 'earned' }, ...c.earned.map((e) => h('div', {}, h('b', { text: e.title }), h('small', { text: e.line })))) : null;
    const next =
      c.next === 'ending'
        ? this.btn('Go home', () => this.show('ending', { shells: store.data.shells.length, deaths: c.deaths }), 'primary', 'open')
        : c.next === 'map'
          ? this.btn('The Deep', () => this.host.quitToTitle('areas'), 'primary', 'open')
          : this.btn(c.next === 'area' ? 'Descend' : 'Onward', () => this.host.continueGame(), 'primary', 'open');
    next.setAttribute('data-autofocus', '');
    return h(
      'section',
      { class: 'screen center-screen dim' },
      h('p', { class: 'eyebrow', text: c.area > 0 ? `${ROMAN[c.area - 1]} · ${c.level}` : 'Rematch' }),
      h('h2', { text: c.name }),
      c.shellIds.length ? shells : null,
      stats,
      earned,
      h('nav', { class: 'menu' }, next, this.btn('Again', () => this.host.restartLevel()), c.next !== 'map' ? this.btn('The Deep', () => this.host.quitToTitle('areas'), 'quiet') : null),
    );
  }

  /** After the tutorial: everything is taken away, and the game proper begins. */
  private fall(): HTMLElement {
    const lines = h('div', { class: 'ending-lines' });
    const nav = h('nav', { class: 'menu ending-nav' }, this.btn('Rise', () => this.host.continueGame(), 'primary', 'open'));
    ['The Tide King reached up out of the deep', 'and took your light, piece by piece.', 'You kept the blade. You kept your legs.', 'Go down and take the rest back.'].forEach((text, i) => {
      const line = h('p', { text });
      lines.append(line);
      this.later(500 + i * 1500, () => line.classList.add('on'));
    });
    this.later(500 + 4 * 1500, () => nav.classList.add('on'));
    return h('section', { class: 'screen center-screen fall-screen' }, lines, nav);
  }

  private gallery(): HTMLElement {
    const owned = new Set(this.host.save.data.shells);
    const grid = h('div', { class: 'gallery-grid' });
    const viewer = h('div', { class: 'viewer' });
    const open = (index: number): void => {
      const canvas = h('canvas', { width: '640', height: '640' });
      paintVignette(canvas, index);
      viewer.replaceChildren(canvas, h('span', { class: 'viewer-num', text: `${index + 1} / ${VIGNETTE_COUNT}` }));
      viewer.classList.add('on');
      this.host.sound('open');
    };
    viewer.addEventListener('click', () => {
      viewer.classList.remove('on');
      this.host.sound('back');
    });
    let count = 0;
    for (let i = 0; i < VIGNETTE_COUNT; i++) {
      if (owned.has(shellForVignette(i))) {
        count++;
        const canvas = h('canvas', { width: '160', height: '160' });
        paintVignette(canvas, i);
        grid.append(h('button', { class: 'memory', 'aria-label': `Memory ${i + 1}`, onclick: () => open(i) }, canvas));
      } else {
        grid.append(h('div', { class: 'memory empty', 'aria-label': `Memory ${i + 1}, not found` }, icon('shell', 22)));
      }
    }
    return h('section', { class: 'screen panel-screen' }, this.header('Memories'), h('p', { class: 'note center', text: `${count} of ${VIGNETTE_COUNT} shells remembered` }), grid, viewer);
  }

  private drift(): HTMLElement {
    const best = this.host.save.data.driftBest;
    const play = this.btn('Drift', () => this.host.playDrift(), 'primary', 'open');
    play.setAttribute('data-autofocus', '');
    return h(
      'section',
      { class: 'screen panel-screen' },
      this.header('Drift'),
      h(
        'div',
        { class: 'feature' },
        h('div', { class: 'feature-icon' }, icon('calm', 44)),
        h('h3', { text: 'An endless, quiet shore' }),
        h('p', { text: 'Every power, nothing hunting you, nowhere to be.' }),
        h('div', { class: 'stats' }, h('div', {}, icon('route', 18), h('b', { text: best > 0 ? `${best} m` : '—' }), h('small', { text: 'farthest wandered' }))),
        h('nav', { class: 'menu' }, play),
      ),
    );
  }

  private ending(p: { shells: number; deaths: number }): HTMLElement {
    const lines = h('div', { class: 'ending-lines' });
    const tally = h('div', { class: 'stats ending-tally' }, h('div', {}, icon('shell', 20), h('b', { text: `${p.shells}/${VIGNETTE_COUNT}` }), h('small', { text: 'memories' })), h('div', {}, icon('pulse', 20), h('b', { text: '10' }), h('small', { text: 'guardians felled' })));
    const nav = h('nav', { class: 'menu ending-nav' }, this.btn('Credits', () => this.push('credits'), 'primary', 'open'), this.btn('Title', () => this.host.quitToTitle(), 'quiet'));
    ENDING_LINES.forEach((text, i) => {
      const line = h('p', { text });
      lines.append(line);
      this.later(900 + i * 2300, () => line.classList.add('on'));
    });
    const end = 900 + ENDING_LINES.length * 2300;
    this.later(end, () => tally.classList.add('on'));
    this.later(end + 1200, () => nav.classList.add('on'));
    return h('section', { class: 'screen center-screen ending-screen' }, h('span', { class: 'ember big' }), lines, tally, nav);
  }

  private credits(): HTMLElement {
    const back = (): void => (this.stack.length > 1 ? this.back() : this.host.quitToTitle());
    return h(
      'section',
      { class: 'screen panel-screen credits' },
      this.header('Credits', back),
      h(
        'div',
        { class: 'credits-body' },
        h('span', { class: 'title-dot' }),
        h('h3', { text: 'Tidewalker' }),
        h('p', { text: 'A small light, a long way down, and everything that tries to stop it.' }),
        h('h4', { text: 'Design, code, art and sound' }),
        h('p', { text: 'Made for this world, start to finish. Every picture is painted by code and every sound is synthesised as you play — nothing here was borrowed.' }),
        h('h4', { text: 'Built with' }),
        h('p', { text: 'PixiJS · TypeScript · Vite · Web Audio' }),
        h('h4', { text: 'Thank you' }),
        h('p', { text: 'For every fall you got up from.' }),
        h('p', { class: 'note', text: 'Version 2.0.0 · No ads, no tracking, no account. Your progress lives only on this device.' }),
      ),
    );
  }
}
