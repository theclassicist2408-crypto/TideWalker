import { paintVignette, shellForVignette, VIGNETTE_COUNT } from '../../assets/data/vignettes';
import { TOTAL_CHAPTERS } from '../core/constants';
import type { Difficulty } from '../core/types';
import { formatTime } from '../core/util';
import type { SaveStore, Settings } from '../save/save';
import type { DailyPick } from '../systems/daily';
import { h, icon, ROMAN } from './dom';

export interface ChapterInfo {
  index: number;
  name: string;
  line: string;
  shellIds: string[];
  routeIds: string[];
}

export interface CompleteInfo {
  mode: 'story' | 'daily';
  index: number;
  name: string;
  time: number;
  best: number | null;
  newBest: boolean;
  shellIds: string[];
  routesFound: number;
  routesTotal: number;
  kin: number;
  streak: number;
  last: boolean;
}

/** Everything the screens need from the game. Keeps UI free of game internals. */
export interface UiHost {
  save: SaveStore;
  chapters(): ChapterInfo[];
  daily(): DailyPick;
  playChapter(index: number, resume: boolean): void;
  playDaily(): void;
  playDrift(): void;
  resume(): void;
  retry(): void;
  restartChapter(): void;
  quitToTitle(): void;
  settingsChanged(): void;
  sound(kind: 'tap' | 'open' | 'back' | 'toggle'): void;
}

export type ScreenName = 'title' | 'chapters' | 'settings' | 'pause' | 'retry' | 'complete' | 'gallery' | 'daily' | 'drift' | 'ending' | 'credits';

const DIFFICULTY_TEXT: Record<Difficulty, string> = {
  gentle: 'More light, a slower tide, kinder lanterns.',
  standard: 'The shore as it was meant to be crossed.',
  intense: 'Less light, a faster tide, no room to dawdle.',
};

const ENDING_LINES = ['The tide came in behind you.', 'It did not matter.', 'You carried your light the whole way,', 'and every light you woke came with you.', 'You are home.'];

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

  /** Replaces the whole stack with one screen. */
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

  /** Hides all screens (gameplay). */
  clear(): void {
    this.stack.length = 0;
    this.swap(null);
  }

  private render(): void {
    const top = this.stack[this.stack.length - 1];
    this.swap(this.build(top.name, top.params));
  }

  private swap(next: HTMLElement | null): void {
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
    const prev = this.current;
    if (prev) {
      prev.classList.remove('in');
      prev.classList.add('out');
      window.setTimeout(() => prev.remove(), 380);
    }
    this.current = next;
    this.root.classList.toggle('open', next !== null);
    if (next) {
      this.root.append(next);
      // Next frame so the transition runs; the timer covers hidden tabs where rAF is paused.
      const enter = (): void => next.classList.add('in');
      requestAnimationFrame(enter);
      window.setTimeout(enter, 60);
      const focus = next.querySelector<HTMLElement>('[data-autofocus]');
      focus?.focus({ preventScroll: true });
    }
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(fn, ms));
  }

  // ---- shared pieces -------------------------------------------------------------------

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
    return h(
      'header',
      { class: 'screen-head' },
      h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: () => (onBack ? onBack() : this.back()) }, icon('back', 26)),
      h('h2', { text: title }),
    );
  }

  private build(name: ScreenName, params: unknown): HTMLElement {
    switch (name) {
      case 'title':
        return this.title();
      case 'chapters':
        return this.chapters();
      case 'settings':
        return this.settings();
      case 'pause':
        return this.pause(params as { mode: string; title: string });
      case 'retry':
        return this.retry(params as { kind: 'caught' | 'swept'; assist: boolean });
      case 'complete':
        return this.complete(params as CompleteInfo);
      case 'gallery':
        return this.gallery();
      case 'daily':
        return this.daily();
      case 'drift':
        return this.drift();
      case 'ending':
        return this.ending(params as { shells: number; kin: number });
      default:
        return this.credits();
    }
  }

  // ---- screens -------------------------------------------------------------------------

  private title(): HTMLElement {
    const save = this.host.save.data;
    const fresh = save.currentChapter === 1 && !save.chapters['1']?.completed && !save.checkpoint;
    const cp = save.checkpoint;
    const play = this.btn(fresh ? 'Begin' : 'Continue', () => (cp ? this.host.playChapter(cp.chapter, true) : this.host.playChapter(save.currentChapter, false)), 'primary', 'open');
    play.setAttribute('data-autofocus', '');
    return h(
      'section',
      { class: 'screen title-screen' },
      h('div', { class: 'title-mark' }, h('span', { class: 'title-dot' }), h('h1', { text: 'Tidewalker' }), h('p', { text: 'carry your light home' })),
      h(
        'nav',
        { class: 'menu' },
        play,
        this.btn('Chapters', () => this.push('chapters'), '', 'open'),
        this.btn('Daily Tide', () => this.push('daily'), '', 'open'),
        this.btn('Drift', () => this.push('drift'), '', 'open'),
        this.btn('Memories', () => this.push('gallery'), '', 'open'),
        h('div', { class: 'menu-row' }, this.btn('Settings', () => this.push('settings'), 'quiet', 'open'), this.btn('Credits', () => this.push('credits'), 'quiet', 'open')),
      ),
    );
  }

  private chapters(): HTMLElement {
    const store = this.host.save;
    const list = h('div', { class: 'chapter-list' });
    for (const c of this.host.chapters()) {
      const rec = store.chapter(c.index);
      const open = store.isUnlocked(c.index);
      const shells = h('span', { class: 'chip' }, ...c.shellIds.map((id) => h('span', { class: `pip${store.data.shells.includes(id) ? ' got' : ''}` }, icon('shell', 16))));
      const meta = h('div', { class: 'chapter-meta' });
      if (open) {
        meta.append(shells);
        if (rec.bestTime !== null) meta.append(h('span', { class: 'chip' }, icon('clock', 15), h('span', { text: formatTime(rec.bestTime) })));
        if (c.routeIds.length) meta.append(h('span', { class: 'chip' }, icon('route', 15), h('span', { text: `${rec.routes.filter((r) => c.routeIds.includes(r)).length}/${c.routeIds.length}` })));
      }
      const card = h(
        'button',
        {
          class: `chapter-card${open ? '' : ' locked'}${rec.completed ? ' done' : ''}`,
          disabled: !open,
          'aria-label': open ? `Chapter ${c.index}: ${c.name}` : `Chapter ${c.index}, locked`,
          onclick: () => {
            this.host.sound('open');
            this.host.playChapter(c.index, false);
          },
        },
        h('span', { class: 'chapter-num', text: ROMAN[c.index - 1] }),
        h('div', { class: 'chapter-text' }, h('h3', { text: open ? c.name : '· · ·' }), h('p', { text: open ? c.line : 'Not yet reached.' }), meta),
        open ? (rec.completed ? icon('check', 20) : icon('play', 18)) : icon('lock', 20),
      );
      list.append(card);
    }
    return h('section', { class: 'screen panel-screen' }, this.header('Chapters'), list);
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
    const reset = this.btn('Reset progress', () => {
      const dialog = h(
        'div',
        { class: 'confirm' },
        h('p', { text: 'Forget every chapter, shell and record? Settings are kept.' }),
        h(
          'div',
          { class: 'menu-row' },
          this.btn('Keep', () => dialog.remove(), 'quiet'),
          this.btn('Forget', () => {
            store.resetProgress();
            dialog.remove();
            this.host.settingsChanged();
            this.show('title');
          }, 'danger'),
        ),
      );
      screen.append(dialog);
    }, 'quiet danger');

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
        segment<Difficulty>('Tide', [['gentle', 'Gentle'], ['standard', 'Standard'], ['intense', 'Intense']], () => s().difficulty, (v) => set({ difficulty: v }), () => (diffNote.textContent = DIFFICULTY_TEXT[s().difficulty])),
        diffNote,
        h('p', { class: 'note', text: 'Every chapter and the ending are open on every difficulty. A new tide takes effect when you next start or restart a shore.' }),
        h('h4', { text: 'Device' }),
        toggle('Battery saver', 'batterySaver', 'Lower resolution for cooler, longer play'),
        reset,
      ),
    );
    return screen;
  }

  private pause(p: { mode: string; title: string }): HTMLElement {
    const resume = this.btn('Resume', () => this.host.resume(), 'primary');
    resume.setAttribute('data-autofocus', '');
    return h(
      'section',
      { class: 'screen center-screen dim' },
      h('p', { class: 'eyebrow', text: 'Paused' }),
      h('h2', { text: p.title }),
      h(
        'nav',
        { class: 'menu' },
        resume,
        p.mode === 'drift' ? null : this.btn('Back to last lantern', () => this.host.retry()),
        p.mode === 'drift' ? null : this.btn('Restart', () => this.host.restartChapter()),
        this.btn('Settings', () => this.push('settings'), '', 'open'),
        this.btn('Leave', () => this.host.quitToTitle(), 'quiet'),
      ),
    );
  }

  private retry(p: { kind: 'caught' | 'swept'; assist: boolean }): HTMLElement {
    const again = this.btn('Rise again', () => this.host.retry(), 'primary');
    again.setAttribute('data-autofocus', '');
    const screen = h(
      'section',
      { class: 'screen center-screen dim retry-screen' },
      h('span', { class: 'ember' }),
      h('h2', { text: p.kind === 'caught' ? 'The dark reached your light' : 'The tide carried you back' }),
      h('p', { text: p.assist ? 'A gentler way is glowing now.' : 'Almost. The lantern remembers you.' }),
      h('nav', { class: 'menu' }, again, this.btn('Leave', () => this.host.quitToTitle(), 'quiet')),
    );
    return screen;
  }

  private complete(c: CompleteInfo): HTMLElement {
    const store = this.host.save;
    const shells = h('div', { class: 'shell-row' }, ...c.shellIds.map((id) => h('span', { class: `pip big${store.data.shells.includes(id) ? ' got' : ''}` }, icon('shell', 30))));
    const stats = h(
      'div',
      { class: 'stats' },
      h('div', {}, icon('clock', 18), h('b', { text: formatTime(c.time) }), h('small', { text: c.newBest ? 'new best' : c.best !== null ? `best ${formatTime(c.best)}` : '' })),
      c.routesTotal > 0 ? h('div', {}, icon('route', 18), h('b', { text: `${c.routesFound}/${c.routesTotal}` }), h('small', { text: 'hidden ways' })) : null,
      c.mode === 'daily' ? h('div', {}, icon('tide', 18), h('b', { text: String(c.streak) }), h('small', { text: c.streak === 1 ? 'night' : 'nights running' })) : null,
    );
    const next =
      c.mode === 'daily'
        ? this.btn('Done', () => this.host.quitToTitle(), 'primary')
        : c.last
          ? this.btn('Go home', () => this.show('ending', { shells: store.data.shells.length, kin: c.kin }), 'primary', 'open')
          : this.btn('Onward', () => this.host.playChapter(c.index + 1, false), 'primary', 'open');
    next.setAttribute('data-autofocus', '');
    return h(
      'section',
      { class: 'screen center-screen dim' },
      h('p', { class: 'eyebrow', text: c.mode === 'daily' ? 'Daily Tide' : `Chapter ${ROMAN[c.index - 1]}` }),
      h('h2', { text: c.name }),
      c.shellIds.length ? shells : null,
      stats,
      h('nav', { class: 'menu' }, next, this.btn('Again', () => this.host.restartChapter()), c.mode === 'story' ? this.btn('Chapters', () => this.host.quitToTitle(), 'quiet') : null),
    );
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
      const has = owned.has(shellForVignette(i));
      if (has) {
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

  private daily(): HTMLElement {
    const pick = this.host.daily();
    const d = this.host.save.data.daily;
    const best = d.bestTimes[pick.key];
    const done = d.lastCompleted === pick.key;
    const play = this.btn(done ? 'Cross again' : 'Cross tonight', () => this.host.playDaily(), 'primary', 'open');
    play.setAttribute('data-autofocus', '');
    const [y, m, day] = pick.key.split('-').map(Number);
    const date = new Date(y, m - 1, day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    return h(
      'section',
      { class: 'screen panel-screen' },
      this.header('Daily Tide'),
      h(
        'div',
        { class: 'feature' },
        h('div', { class: 'feature-icon' }, icon(pick.condition.icon, 44)),
        h('p', { class: 'eyebrow', text: date }),
        h('h3', { text: pick.condition.name }),
        h('p', { text: pick.condition.line }),
        h(
          'div',
          { class: 'stats' },
          h('div', {}, icon('clock', 18), h('b', { text: best !== undefined ? formatTime(best) : '—' }), h('small', { text: 'tonight' })),
          h('div', {}, icon('tide', 18), h('b', { text: String(d.streak) }), h('small', { text: d.streak === 1 ? 'night' : 'nights' })),
        ),
        h('nav', { class: 'menu' }, play),
        h('p', { class: 'note center', text: 'One short shore. A new night every day.' }),
      ),
    );
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
        h('p', { text: 'No tide to race. Nothing in the dark. Nowhere to be.' }),
        h('div', { class: 'stats' }, h('div', {}, icon('route', 18), h('b', { text: best > 0 ? `${best} m` : '—' }), h('small', { text: 'farthest wandered' }))),
        h('nav', { class: 'menu' }, play),
      ),
    );
  }

  private ending(p: { shells: number; kin: number }): HTMLElement {
    const lines = h('div', { class: 'ending-lines' });
    const tally = h(
      'div',
      { class: 'stats ending-tally' },
      h('div', {}, icon('shell', 20), h('b', { text: `${p.shells}/${VIGNETTE_COUNT}` }), h('small', { text: 'memories' })),
      h('div', {}, icon('pulse', 20), h('b', { text: String(p.kin) }), h('small', { text: 'lights woken' })),
    );
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
        h('p', { text: 'A small game about carrying a light through the dark.' }),
        h('h4', { text: 'Design, code, art and sound' }),
        h('p', { text: 'Made for this shore, start to finish. Every picture is painted by code and every sound is synthesised as you play — nothing here was borrowed.' }),
        h('h4', { text: 'Built with' }),
        h('p', { text: 'PixiJS · TypeScript · Vite · Web Audio' }),
        h('h4', { text: 'Thank you' }),
        h('p', { text: `For crossing all ${TOTAL_CHAPTERS} shores. For holding on to your light.` }),
        h('p', { class: 'note', text: 'Version 1.0.0 · No ads, no tracking, no account. Your progress lives only on this device.' }),
      ),
    );
  }
}
