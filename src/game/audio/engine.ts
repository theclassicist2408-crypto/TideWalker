import { degreeHz, SCORES, type BiomeScore } from '../../assets/audio/patches';
import type { BiomeId, EventType } from '../core/types';
import type { AudioMix } from './director';

type Ctx = AudioContext;

interface ToneOpts {
  freq: number;
  to?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  delay?: number;
  pan?: number;
  wet?: number;
  cutoff?: number;
}

interface NoiseOpts {
  dur: number;
  freq: number;
  to?: number;
  q?: number;
  filter?: BiquadFilterType;
  gain?: number;
  attack?: number;
  delay?: number;
  pan?: number;
  wet?: number;
}

/**
 * All sound in Tidewalker, synthesised with Web Audio: a generative, layered soundtrack,
 * weather beds and every effect. Safe to call before the context exists — calls simply no-op
 * until the first user gesture unlocks audio.
 */
export class AudioEngine {
  private ctx: Ctx | null = null;
  private master!: GainNode;
  private world!: BiquadFilterNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private reverb!: ConvolverNode;
  private reverbIn!: GainNode;
  private noise!: AudioBuffer;
  private layers!: Record<'explore' | 'tension' | 'danger' | 'relief' | 'sanctuary', GainNode>;
  private beds!: Record<'wind' | 'rain' | 'waves' | 'deep' | 'glowHum', GainNode>;
  private score: BiomeScore = SCORES.storm;
  private chordIndex = 0;
  private nextChord = 0;
  private nextBell = 0;
  private nextGlass = 0;
  private nextBeat = 0;
  private volumes = { master: 0.8, music: 0.7, sfx: 0.8 };
  private lastMix: AudioMix | null = null;
  private muted = false;
  /** 'running' once unlocked; exposed for tests and the debug overlay. */
  state: 'locked' | 'running' | 'suspended' = 'locked';

  /** Must be called from a user gesture. Creates the graph on first use. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.build(this.ctx);
      // Phone calls and other apps can interrupt audio; recover when the context allows.
      this.ctx.addEventListener('statechange', () => {
        if (this.ctx && this.ctx.state === 'running') this.state = 'running';
      });
    }
    if (this.ctx.state !== 'running' && !this.muted) void this.ctx.resume().catch(() => undefined);
    this.state = this.muted ? 'suspended' : 'running';
  }

  /** Silences everything (backgrounded app). */
  suspend(): void {
    this.muted = true;
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend().catch(() => undefined);
    if (this.ctx) this.state = 'suspended';
  }

  resume(): void {
    this.muted = false;
    if (!this.ctx) return;
    void this.ctx.resume().catch(() => undefined);
    this.state = 'running';
    const now = this.ctx.currentTime;
    this.nextChord = Math.max(this.nextChord, now + 0.2);
    this.nextBell = Math.max(this.nextBell, now + 1);
    this.nextBeat = now + 0.2;
    this.nextGlass = now + 3;
  }

  setVolumes(master: number, music: number, sfx: number): void {
    this.volumes = { master, music, sfx };
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(music * 0.9, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(sfx, t, 0.05);
  }

  setBiome(biome: BiomeId): void {
    this.score = SCORES[biome];
    this.chordIndex = 0;
  }

  private build(ctx: Ctx): void {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 5;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = this.volumes.master;
    this.master.connect(comp);
    this.world = ctx.createBiquadFilter();
    this.world.type = 'lowpass';
    this.world.frequency.value = 18000;
    this.world.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.volumes.music * 0.9;
    this.musicBus.connect(this.world);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.volumes.sfx;
    this.sfxBus.connect(this.world);

    // Noise source shared by weather and effects.
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let seed = 22222;
    for (let i = 0; i < len; i++) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 2147483647) * 2 - 1;
    }

    // Reverb: an exponentially decaying noise tail gives everything a sense of open night air.
    const irLen = Math.floor(ctx.sampleRate * 3.2);
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) {
        seed = (seed * 16807) % 2147483647;
        d[i] = ((seed / 2147483647) * 2 - 1) * Math.pow(1 - i / irLen, 2.6);
      }
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    this.reverb.connect(wet).connect(this.world);
    this.reverbIn = ctx.createGain();
    this.reverbIn.connect(this.reverb);

    const layer = (): GainNode => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.musicBus);
      const send = ctx.createGain();
      send.gain.value = 0.7;
      g.connect(send).connect(this.reverbIn);
      return g;
    };
    this.layers = { explore: layer(), tension: layer(), danger: layer(), relief: layer(), sanctuary: layer() };
    this.layers.relief.gain.value = 1;

    const bed = (freq: number, type: BiquadFilterType, q: number, lfoHz: number, lfoDepth: number): GainNode => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      src.playbackRate.value = 0.6 + Math.random() * 0.5;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(this.sfxBus);
      if (lfoHz > 0) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = lfoHz;
        const depth = ctx.createGain();
        depth.gain.value = lfoDepth;
        lfo.connect(depth).connect(f.frequency);
        lfo.start();
      }
      src.start();
      return g;
    };
    const hum = ctx.createGain();
    hum.gain.value = 0;
    hum.connect(this.sfxBus);
    for (const [freq, vol] of [
      [220, 0.5],
      [330.5, 0.3],
      [441, 0.16],
    ] as [number, number][]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = vol;
      o.connect(g).connect(hum);
      o.start();
    }
    this.beds = {
      wind: bed(420, 'bandpass', 0.7, 0.13, 180),
      rain: bed(4200, 'highpass', 0.4, 0, 0),
      waves: bed(380, 'lowpass', 0.6, 0.11, 160),
      deep: bed(120, 'lowpass', 1, 0.07, 30),
      glowHum: hum,
    };

    // Persistent drones for tension (low, uneasy) and danger (lower, pulsing).
    const drone = (freq: number, type: OscillatorType, cutoff: number, dest: GainNode, vol: number, tremHz: number): void => {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      const g = ctx.createGain();
      g.gain.value = vol;
      for (const detune of [-7, 6]) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        o.detune.value = detune;
        o.connect(f);
        o.start();
      }
      f.connect(g).connect(dest);
      if (tremHz > 0) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = tremHz;
        const depth = ctx.createGain();
        depth.gain.value = vol * 0.5;
        lfo.connect(depth).connect(g.gain);
        lfo.start();
      }
    };
    drone(55, 'sawtooth', 210, this.layers.tension, 0.16, 0.09);
    drone(41.2, 'triangle', 160, this.layers.danger, 0.3, 3.1);

    const now = ctx.currentTime;
    this.nextChord = now + 0.3;
    this.nextBell = now + 2.5;
    this.nextGlass = now + 6;
    this.nextBeat = now + 1;
  }

  // ---- synthesis helpers -----------------------------------------------------------------

  private out(dest: AudioNode, pan: number | undefined, wet: number | undefined, src: AudioNode): void {
    const ctx = this.ctx as Ctx;
    let node = src;
    if (pan !== undefined && pan !== 0 && typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(p);
      node = p;
    }
    node.connect(dest);
    if (wet && wet > 0) {
      const send = ctx.createGain();
      send.gain.value = wet;
      node.connect(send).connect(this.reverbIn);
    }
  }

  private tone(o: ToneOpts, dest: AudioNode = this.sfxBus): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + o.dur);
    const g = ctx.createGain();
    const peak = o.gain ?? 0.2;
    const attack = Math.min(o.attack ?? 0.008, o.dur * 0.5);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    let node: AudioNode = osc;
    if (o.cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.cutoff;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    this.out(dest, o.pan, o.wet, g);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.05);
  }

  private burst(o: NoiseOpts, dest: AudioNode = this.sfxBus): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.filter ?? 'bandpass';
    f.Q.value = o.q ?? 0.8;
    f.frequency.setValueAtTime(o.freq, t0);
    if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), t0 + o.dur);
    const g = ctx.createGain();
    const peak = o.gain ?? 0.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + Math.min(o.attack ?? 0.01, o.dur * 0.5));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(f).connect(g);
    this.out(dest, o.pan, o.wet, g);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + o.dur + 0.05);
  }

  private pad(freq: number, t0: number, dur: number, dest: AudioNode, gain: number, bright: boolean): void {
    const ctx = this.ctx as Ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + dur * 0.35);
    g.gain.setValueAtTime(gain, t0 + dur * 0.6);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur + 3.5);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = bright ? 2400 : 1100;
    f.connect(g).connect(dest);
    for (const [type, detune] of [
      ['sine', -4],
      ['triangle', 5],
    ] as [OscillatorType, number][]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = detune;
      o.connect(f);
      o.start(t0);
      o.stop(t0 + dur + 3.6);
    }
  }

  private bell(freq: number, delay: number, gain: number, dest: AudioNode): void {
    this.tone({ freq, dur: 2.8, gain, attack: 0.012, delay }, dest);
    this.tone({ freq: freq * 2.005, dur: 1.4, gain: gain * 0.28, attack: 0.008, delay }, dest);
  }

  private scaleHz(degree: number, octave: number): number {
    return degreeHz(this.score.root * Math.pow(2, octave), this.score.scale, degree);
  }

  // ---- per-frame update ------------------------------------------------------------------

  /** Applies the director's mix and schedules upcoming music. Cheap enough to call every frame. */
  update(mix: AudioMix): void {
    const ctx = this.ctx;
    this.lastMix = mix;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const set = (g: GainNode, v: number): void => {
      g.gain.setTargetAtTime(v, now, 0.12);
    };
    set(this.layers.explore, mix.explore * 0.5);
    set(this.layers.sanctuary, mix.sanctuary * 0.5);
    set(this.layers.tension, mix.tension * 0.55);
    set(this.layers.danger, mix.danger * 0.6);
    set(this.beds.wind, mix.wind * 0.1);
    set(this.beds.rain, mix.rain * 0.075);
    set(this.beds.waves, mix.waves * 0.16);
    set(this.beds.deep, mix.deep * 0.3);
    set(this.beds.glowHum, mix.glowHum * 0.035);
    this.world.frequency.setTargetAtTime(mix.cutoff, now, 0.1);

    const s = this.score;
    if (now >= this.nextChord - 0.4) {
      const t0 = Math.max(now + 0.05, this.nextChord);
      const chord = s.chords[this.chordIndex % s.chords.length];
      this.chordIndex++;
      for (const d of chord) {
        this.pad(this.scaleHz(d, 1), t0, s.chordTime, this.layers.explore, 0.085, false);
        this.pad(this.scaleHz(d, 2), t0, s.chordTime, this.layers.sanctuary, 0.05, true);
      }
      this.pad(this.scaleHz(chord[0], 0), t0, s.chordTime, this.layers.explore, 0.12, false);
      this.nextChord = t0 + s.chordTime;
    }
    if (now >= this.nextBell) {
      const d = Math.floor(Math.random() * s.scale.length * 2);
      const dest = mix.sanctuary > mix.explore ? this.layers.sanctuary : this.layers.explore;
      this.bell(this.scaleHz(d, 2), 0, 0.09, dest);
      if (Math.random() < 0.4) this.bell(this.scaleHz(d + 2, 2), 0.35 + Math.random() * 0.3, 0.06, dest);
      this.nextBell = now + s.bellGap * (0.5 + Math.random());
    }
    if (now >= this.nextGlass) {
      // Uneasy overtones a semitone apart; only audible as the tension layer rises.
      const f = this.scaleHz(4, 3);
      this.tone({ freq: f, dur: 4, gain: 0.05, attack: 1.4 }, this.layers.tension);
      this.tone({ freq: f * 1.0595, dur: 4, gain: 0.04, attack: 1.8 }, this.layers.tension);
      this.nextGlass = now + 6 + Math.random() * 6;
    }
    if (now >= this.nextBeat) {
      // A heartbeat that quickens with danger.
      if (mix.danger > 0.05) {
        this.tone({ freq: 62, to: 40, dur: 0.16, gain: 0.5, attack: 0.005 }, this.layers.danger);
        this.tone({ freq: 56, to: 38, dur: 0.14, gain: 0.34, attack: 0.005, delay: 0.17 }, this.layers.danger);
      }
      this.nextBeat = now + 1.05 - mix.danger * 0.5;
    }
  }

  /** A rising phrase after an escape, a lantern or a shell. */
  relief(strength = 1): void {
    if (!this.ctx) return;
    const degrees = [0, 2, 4, 7];
    degrees.forEach((d, i) => this.bell(this.scaleHz(d, 2), i * 0.22, 0.11 * strength, this.layers.relief));
  }

  thunder(): void {
    this.burst({ dur: 3.2, freq: 140, to: 50, filter: 'lowpass', q: 0.5, gain: 0.5, attack: 0.12, wet: 0.6, delay: 0.25 });
    this.burst({ dur: 0.5, freq: 900, to: 200, filter: 'bandpass', gain: 0.16, delay: 0.2 });
  }

  /** Interface feedback for menus. */
  ui(kind: 'tap' | 'open' | 'back' | 'toggle'): void {
    if (kind === 'tap') this.tone({ freq: 660, to: 880, dur: 0.09, gain: 0.07 });
    else if (kind === 'open') {
      this.tone({ freq: 440, to: 660, dur: 0.18, gain: 0.07, wet: 0.4 });
      this.tone({ freq: 660, to: 990, dur: 0.2, gain: 0.05, delay: 0.08, wet: 0.4 });
    } else if (kind === 'back') this.tone({ freq: 620, to: 410, dur: 0.14, gain: 0.07 });
    else this.tone({ freq: 520, dur: 0.07, gain: 0.07 });
  }

  /**
   * Plays the sound of a simulation event.
   * @param pan -1..1 stereo position, @param near 0..1 loudness from distance, @param v event magnitude
   */
  play(type: EventType, pan = 0, near = 1, v = 0): void {
    if (!this.ctx || this.ctx.state !== 'running' || near <= 0.02) return;
    const n = near;
    switch (type) {
      case 'jump':
        this.tone({ freq: v > 0 ? 220 : 300, to: v > 0 ? 700 : 520, dur: v > 0 ? 0.35 : 0.13, gain: 0.09 * n, pan });
        this.burst({ dur: 0.08, freq: 900, gain: 0.04 * n, pan });
        break;
      case 'land':
        this.burst({ dur: 0.12, freq: 280, filter: 'lowpass', gain: Math.min(0.22, 0.08 + v / 4000) * n, pan });
        this.tone({ freq: 96, to: 52, dur: 0.12, gain: Math.min(0.2, v / 3500) * n, pan });
        break;
      case 'splashIn':
        this.burst({ dur: 0.45, freq: 1400, to: 380, gain: 0.22 * n, pan, wet: 0.3 });
        this.burst({ dur: 0.3, freq: 300, filter: 'lowpass', gain: 0.2 * n, pan });
        break;
      case 'splashOut':
        this.burst({ dur: 0.35, freq: 700, to: 2200, gain: 0.16 * n, pan, wet: 0.3 });
        break;
      case 'glowOn':
        this.tone({ freq: 392, to: 587, dur: 0.3, gain: 0.07, wet: 0.5 });
        this.tone({ freq: 784, dur: 0.5, gain: 0.03, delay: 0.05, wet: 0.6 });
        break;
      case 'glowOff':
        this.tone({ freq: 520, to: 340, dur: 0.18, gain: 0.035 });
        break;
      case 'pulse':
        this.tone({ freq: 160, to: 880, dur: 0.35, gain: 0.2, wet: 0.6 });
        this.tone({ freq: 880, to: 330, dur: 0.7, gain: 0.1, delay: 0.3, wet: 0.7 });
        this.burst({ dur: 0.7, freq: 500, to: 4000, filter: 'highpass', gain: 0.1, wet: 0.5 });
        break;
      case 'pulseFail':
        this.tone({ freq: 170, to: 130, dur: 0.12, gain: 0.08, type: 'triangle' });
        break;
      case 'dash':
        this.burst({ dur: 0.2, freq: 700, to: 2600, gain: 0.12, pan });
        break;
      case 'slash':
        this.burst({ dur: 0.09, freq: 2600, to: 900, gain: 0.09, pan });
        break;
      case 'chargeReady':
        this.tone({ freq: 660, to: 990, dur: 0.16, gain: 0.07, wet: 0.4 });
        break;
      case 'chargeSlash':
        this.burst({ dur: 0.22, freq: 1800, to: 400, gain: 0.2, wet: 0.3 });
        this.tone({ freq: 330, to: 110, dur: 0.25, gain: 0.14 });
        break;
      case 'hit':
        this.burst({ dur: 0.07, freq: 1200, q: 2, gain: 0.16 * n, pan });
        this.tone({ freq: 220, to: 130, dur: 0.08, gain: 0.1 * n, type: 'square', cutoff: 1200, pan });
        break;
      case 'clang':
        this.tone({ freq: 1400, to: 1100, dur: 0.18, gain: 0.1 * n, type: 'triangle', pan, wet: 0.4 });
        break;
      case 'pogo':
      case 'doubleJump':
      case 'wallJump':
        this.tone({ freq: 440, to: 720, dur: 0.1, gain: 0.07, pan });
        break;
      case 'kill':
        this.burst({ dur: 0.3, freq: 700, to: 150, gain: 0.2 * n, pan, wet: 0.3 });
        this.tone({ freq: this.scaleHz(4, 3), dur: 0.3, gain: 0.05, wet: 0.6, pan });
        break;
      case 'hurt':
        this.tone({ freq: 160, to: 60, dur: 0.35, gain: 0.3, type: 'sawtooth', cutoff: 600 });
        this.burst({ dur: 0.25, freq: 500, to: 140, gain: 0.2 });
        break;
      case 'death':
        this.tone({ freq: 392, to: 82, dur: 1.2, gain: 0.16, wet: 0.8 });
        this.burst({ dur: 1.0, freq: 600, to: 120, filter: 'lowpass', gain: 0.18, wet: 0.5 });
        break;
      case 'healStart':
        this.tone({ freq: 294, to: 440, dur: 0.9, gain: 0.05, attack: 0.5, wet: 0.5 });
        break;
      case 'heal':
        [0, 2, 4].forEach((d, i) => this.bell(this.scaleHz(d, 3), i * 0.07, 0.08, this.sfxBus));
        break;
      case 'grant':
        [0, 2, 4, 7, 9].forEach((d, i) => this.bell(this.scaleHz(d, 2), i * 0.14, 0.11, this.sfxBus));
        break;
      case 'ability':
        this.tone({ freq: 300, to: 900, dur: 0.22, gain: 0.1, wet: 0.5 });
        break;
      case 'abilityFail':
        this.tone({ freq: 170, to: 130, dur: 0.12, gain: 0.07, type: 'triangle' });
        break;
      case 'break':
        this.burst({ dur: 0.5, freq: 300, to: 90, filter: 'lowpass', gain: 0.3 * n, pan });
        break;
      case 'lowLumen':
      case 'timeLow':
        this.tone({ freq: 494, to: 440, dur: 0.3, gain: 0.07, wet: 0.5 });
        this.tone({ freq: 370, to: 330, dur: 0.4, gain: 0.07, delay: 0.25, wet: 0.5 });
        break;
      case 'enemyWindup':
        // Each attack is heard coming: a rising growl, deeper for guardians.
        this.tone({ freq: v > 0 ? 50 : 90, to: v > 0 ? 130 : 210, dur: 0.4, gain: (v > 0 ? 0.26 : 0.16) * n, type: 'sawtooth', cutoff: 520, attack: 0.15, pan });
        break;
      case 'enemyAttack':
        this.burst({ dur: 0.22, freq: 400, to: 1600, gain: 0.14 * n, pan });
        break;
      case 'shot':
        this.tone({ freq: 520, to: 260, dur: 0.14, gain: 0.08 * n, type: 'triangle', pan });
        break;
      case 'zoneWarn':
        this.tone({ freq: 880, to: 660, dur: 0.12, gain: 0.04 * n, pan });
        break;
      case 'zoneHit':
        this.burst({ dur: 0.25, freq: 900, to: 200, gain: 0.16 * n, pan });
        break;
      case 'spawn':
        this.tone({ freq: 120, to: 240, dur: 0.3, gain: 0.1 * n, type: 'triangle', pan, wet: 0.4 });
        break;
      case 'bossIntro':
      case 'bossPhase':
        this.tone({ freq: 55, to: 36, dur: 1.6, gain: 0.4, type: 'sawtooth', cutoff: 300, wet: 0.7 });
        this.burst({ dur: 1.4, freq: 200, to: 60, filter: 'lowpass', gain: 0.3, wet: 0.6 });
        break;
      case 'bossDown':
      case 'minibossDown':
        this.burst({ dur: 1.6, freq: 800, to: 80, filter: 'lowpass', gain: 0.3, wet: 0.7 });
        [0, 2, 4, 7, 9, 11].forEach((d, i) => this.bell(this.scaleHz(d, 2), 0.3 + i * 0.16, 0.11, this.sfxBus));
        break;
      case 'arenaStart':
      case 'gateClose':
        this.tone({ freq: 110, to: 70, dur: 0.4, gain: 0.2 * n, type: 'triangle', pan });
        break;
      case 'arenaClear':
        [0, 4, 7].forEach((d, i) => this.bell(this.scaleHz(d, 2), i * 0.12, 0.09, this.sfxBus));
        break;
      case 'pickup':
        this.tone({ freq: this.scaleHz(4 + Math.floor(Math.random() * 3), 3), dur: 0.25, gain: 0.07, wet: 0.5, pan });
        break;
      case 'plant':
        [0, 2, 4].forEach((d, i) => this.tone({ freq: this.scaleHz(d, 3), dur: 0.5, gain: 0.07, delay: i * 0.07, wet: 0.6, pan }));
        break;
      case 'shell':
        [0, 2, 4, 6, 9].forEach((d, i) => this.bell(this.scaleHz(d, 3), i * 0.11, 0.08, this.sfxBus));
        break;
      case 'checkpoint':
        this.bell(this.scaleHz(0, 2), 0, 0.12, this.sfxBus);
        this.bell(this.scaleHz(4, 2), 0.18, 0.1, this.sfxBus);
        break;
      case 'goal':
        [0, 2, 4, 7, 9, 11].forEach((d, i) => this.bell(this.scaleHz(d, 2), i * 0.16, 0.1, this.sfxBus));
        break;
      case 'kin':
        this.bell(this.scaleHz(Math.min(11, v + 1), 2), 0, 0.11, this.sfxBus);
        this.bell(this.scaleHz(Math.min(13, v + 3), 2), 0.12, 0.08, this.sfxBus);
        break;
      case 'secret':
        [7, 9, 11].forEach((d, i) => this.bell(this.scaleHz(d, 2), i * 0.13, 0.06, this.sfxBus));
        break;
      case 'gateOpen':
        this.tone({ freq: 196, to: 392, dur: 0.8, gain: 0.09 * n, wet: 0.6, pan });
        this.burst({ dur: 0.6, freq: 1800, gain: 0.05 * n, pan });
        break;
      case 'crumble':
        this.burst({ dur: 0.6, freq: 260, to: 90, filter: 'lowpass', gain: 0.24 * n, pan });
        break;
      case 'geyserWarn':
        this.burst({ dur: 0.9, freq: 500, to: 1500, q: 4, gain: 0.07 * n, attack: 0.5, pan });
        break;
      case 'geyser':
        this.burst({ dur: 1, freq: 1800, to: 600, filter: 'highpass', gain: 0.16 * n, attack: 0.05, pan, wet: 0.3 });
        break;
      case 'stoneWarn':
        this.burst({ dur: 0.07, freq: 2600, q: 3, gain: 0.12 * n, pan });
        this.burst({ dur: 0.09, freq: 1700, q: 3, gain: 0.1 * n, delay: 0.14, pan });
        break;
      case 'stoneLand':
        this.tone({ freq: 80, to: 40, dur: 0.25, gain: 0.3 * n, pan });
        this.burst({ dur: 0.25, freq: 200, filter: 'lowpass', gain: 0.2 * n, pan });
        break;
      case 'assist':
        [4, 2].forEach((d, i) => this.bell(this.scaleHz(d, 2), i * 0.2, 0.07, this.sfxBus));
        break;
      case 'respawn':
        this.tone({ freq: 196, to: 392, dur: 0.6, gain: 0.08, wet: 0.7 });
        break;
      default:
        break;
    }
  }

  /** For tests / the debug overlay. */
  get mix(): AudioMix | null {
    return this.lastMix;
  }
}
