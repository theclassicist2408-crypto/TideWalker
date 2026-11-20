/** Named vibration patterns in milliseconds (vibrate, pause, vibrate …). */
export const HAPTIC_PATTERNS = {
  glow: [8],
  pulse: [28, 36, 60],
  land: [10],
  hardLand: [22],
  danger: [14, 70, 14],
  sting: [40],
  bite: [90],
  pickup: [6],
  shell: [14, 40, 14, 40, 26],
  checkpoint: [20, 50, 20],
  caught: [60, 60, 120],
  nearMiss: [12, 30, 12],
  ui: [5],
} as const;

export type HapticName = keyof typeof HAPTIC_PATTERNS;

/**
 * Controller rumble for each pattern: [heavy motor, light motor] from 0 to 1. Blows and falls
 * use the heavy motor; small ticks only the light one.
 */
const RUMBLE: Record<HapticName, [number, number]> = {
  glow: [0, 0.25],
  pulse: [0.55, 0.7],
  land: [0, 0.3],
  hardLand: [0.5, 0.4],
  danger: [0.15, 0.35],
  sting: [0.6, 0.5],
  bite: [0.9, 0.7],
  pickup: [0, 0.2],
  shell: [0.2, 0.5],
  checkpoint: [0.2, 0.45],
  caught: [0.8, 0.8],
  nearMiss: [0.1, 0.4],
  ui: [0, 0.15],
};

/** Native wrappers (Capacitor) can provide richer haptics by defining this bridge on window. */
interface HapticBridge {
  play(name: HapticName, pattern: readonly number[]): void;
}

/**
 * Haptic feedback. Uses the Vibration API where it exists (Android browsers) and an optional
 * native bridge (`window.TidewalkerHaptics`) when wrapped as an app, since iOS Safari has no
 * vibration support. Always silent when disabled in settings.
 */
export class Haptics {
  enabled = true;
  /** Rumbles a connected controller (heavy, light, ms); set by the game when input is ready. */
  rumble: ((strong: number, weak: number, ms: number) => void) | null = null;
  private lastDanger = 0;

  get supported(): boolean {
    return this.bridge() !== null || (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function');
  }

  private bridge(): HapticBridge | null {
    const w = typeof window !== 'undefined' ? (window as unknown as { TidewalkerHaptics?: HapticBridge }) : null;
    return w?.TidewalkerHaptics ?? null;
  }

  play(name: HapticName): void {
    if (!this.enabled) return;
    const pattern = HAPTIC_PATTERNS[name];
    if (this.rumble) {
      let ms = 0;
      for (const v of pattern) ms += v;
      const [strong, weak] = RUMBLE[name];
      this.rumble(strong, weak, Math.max(40, ms));
    }
    const bridge = this.bridge();
    try {
      if (bridge) bridge.play(name, pattern);
      // Chrome refuses (and logs) vibration before the page has been touched or clicked; a
      // controller press does not count, so a pad-only player relies on rumble alone.
      else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && navigator.userActivation?.hasBeenActive !== false) navigator.vibrate(pattern as unknown as number[]);
    } catch {
      // Vibration can be blocked by the browser; feedback is optional.
    }
  }

  /** A distinct double tick that repeats while danger stays close. `now` in seconds. */
  danger(level: number, now: number): void {
    if (level < 0.6) return;
    const gap = 1.5 - level * 0.7;
    if (now - this.lastDanger > gap) {
      this.lastDanger = now;
      this.play('danger');
    }
  }
}
