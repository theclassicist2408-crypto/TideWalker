# Tidewalker — QA checklist

Status as of version 1.0.0. "Auto" items are asserted by tests on every run; "Manual" items need a
person with a real device and are **not** covered by automation.

## Automated — `npm run check` and `npm run test:e2e`

| Area | What is checked | Where |
| --- | --- | --- |
| Movement | Acceleration, friction, jump height, variable jump, coyote time, input buffer, walls, dash, low-Lumen slowdown, swim, float, breach | `tests/movement.test.ts` |
| Lumen | Glow drain, light radius, no failure on land, trickle floor, water fade then sweep, pools/plants/fireflies, pulse cost and cooldown, difficulty scaling, Drift never drains | `tests/lumen.test.ts` |
| Tide | Keyframes, trend, progress, swell, breath, difficulty rates, tide-driven currents | `tests/tide.test.ts` |
| Collision | Heightfield, one-way platforms, moonglass, crumbling ledges, bloom and tide gates, cave roofs, urchins, geysers, level validation | `tests/collision.test.ts` |
| Shadow-fish | Patrol, attraction to light, telegraphed strike, bite ≠ death, kelp hiding, pulse, Angler patience, Hush sweep, dormancy, ripple warnings | `tests/fish.test.ts` |
| Save | Defaults, round trip, corrupted JSON, sanitising junk, unlocks and bests, Daily streaks, reset keeps settings, storage failures | `tests/save.test.ts` |
| Input | Swipes in 8 directions, hold to glow, glow while dragging, tap, double tap, second finger, flick dash, cancel/reset, jitter | `tests/input.test.ts` |
| Audio state | Layer rules, quieter-under-danger, under-water and pause muffling, sanctuary, smoothing, relief; engine safe before unlock; haptic patterns | `tests/audio.test.ts` |
| Level data | 10 chapters, 5 biomes, 20 unique shells with vignettes, 3 fish, 9 hazard kinds, lantern spacing, climbable walls, rising tides; Daily determinism; Drift validity | `tests/levels.test.ts` |
| Completability | Bot finishes every chapter on Gentle, Standard, Intense and with the tide at 1.7×; collects all 20 shells; clears 3 Daily shores × 7 conditions; Drift cannot fail | `tests/levels.completable.test.ts` |
| Integration | Lanterns, respawn restoring light/pickups/tide, tide cap, assist after 3 failures, resume from lantern, goal, end-to-end chapter with save, hidden shells, kin, secrets, loop at 30/60/120/144 FPS, camera | `tests/integration.test.ts` |
| Touch play | Real touch events: swipe, tap, swipe up, hold, double tap, pulse button, two fingers | `e2e/play.spec.ts` |
| Interruptions | Pause/resume, automatic pause when backgrounded, rotation and resize, audio unlock | `e2e/play.spec.ts` |
| Flow | Retry screen and respawn, full chapter → complete → next chapter, reload and Continue, final chapter → ending → credits | `e2e/play.spec.ts` |
| Menus | Every title button and Back, chapter locks, settings apply and persist, reset with confirmation, corrupted save, Memories viewer, Daily Tide, Drift | `e2e/menus.spec.ts` |
| Layout / access | Title, HUD and settings on 320×568, 393×851, 430×932, 820×1180, 1280×800; targets ≥ 44 px; no overlap or overflow; XL text; contrast ≥ 4.5:1; reduced motion; non-colour cues | `e2e/layout.spec.ts` |
| Desktop | Keyboard play, wide viewport | `e2e/desktop.spec.ts` |
| Performance | Frame rate floor, fixed scene-graph and DOM size, heap growth < 24 MB over 15 s of play, load < 6 s, total transfer < 1.5 MB, no external requests | `e2e/performance.spec.ts` |
| Offline | Reload and play with the network off after first visit | `e2e/performance.spec.ts` |
| Console | Any console error or uncaught exception fails the e2e test that produced it | `e2e/support.ts` |

Latest results: **187 / 187** unit and integration tests, **53 / 53** end-to-end tests, lint and
typecheck clean, production build succeeds.

## Manual — to do on real hardware before release

These cannot be verified from a headless browser. None has been done on a physical device yet.

- [ ] Play chapters 1–10 by hand on a mid-range Android phone and an iPhone; note anywhere that
      feels unfair, unclear or dull. (The bot proves levels are *possible*, not that they are *fun*.)
- [ ] Confirm 60 FPS on a mid-range phone and playable 30 FPS on a low-end one; check battery heat
      after 20 minutes; try Settings → Battery saver.
- [ ] Listen on phone speakers and headphones: balance of music/effects, no clipping, danger cues
      audible before fish are visible, thunder not startling.
- [ ] Haptics on Android (Vibration API). On iOS, haptics only work in the native wrapper via the
      bridge in `docs/PACKAGING.md`.
- [ ] Audio interruption: take a call, trigger Siri/Assistant, lock and unlock — sound returns.
- [ ] Notch / Dynamic Island / rounded corners: HUD clear of cut-outs in Safari, Chrome, and as an
      installed PWA.
- [ ] iOS Safari "Add to Home Screen" and Android "Install app": launches full screen, portrait,
      offline.
- [ ] One-handed reach: pulse button and pause with the thumb, both handedness settings.
- [ ] Colour-vision simulation (protanopia, deuteranopia, tritanopia) on the HUD and fish tells.
- [ ] Screen reader pass over the menus (buttons are real `<button>`s with labels; gameplay itself
      is visual).
- [ ] Very long session: an hour of Drift without growth in memory or stutter.

## Known limitations

- Feel, difficulty tuning and pacing are verified only by simulation, not by human playtests.
- Headless tests render WebGL in software; frame-rate assertions are a collapse guard, not proof of
  60 FPS on phones.
- iOS Safari has no Vibration API: no haptics in the browser on iPhone.
- Music is generative, so it has texture and mood but no composed themes.
- Text is English only.
