# Tidewalker — QA checklist

Status as of version 2.0.0 (the action redesign). "Automated" items are asserted by tests on every
run; "Manual" items need a person with a real device and are **not** covered by automation.

## Automated — `npm run check` and `npm run test:e2e`

| Area | What is checked | Where |
| --- | --- | --- |
| Movement | Run speed and braking, jump height and short hop, coyote time and buffer, double jump (gated, once per flight), wall-cling, slide and wall-climb, cave roofs not clingable, dash and air dash (gated), dash-leap distance, glide, swimming and dive gating, wind, solid blocks, still water in basins, dive-gated sumps | `tests/movement.test.ts` |
| Combat | Strike damage, Essence gain, one hit per swing, shellback guard, thornbloom armour, pogo off spikes, Lumen Strike cost and cracked stone, Pulse cost, stun and safety, Pulse failure, healing (root, cost, cancel, no Essence, no-heal levels), damage and i-frames, death and respawn, spikes, difficulty scaling | `tests/combat.test.ts` |
| Enemies | Wind-up before every hit, lobbed shots, hidden burrowers, patrol leash | `tests/combat.test.ts` |
| Arenas | Lock, waves in order, clear and reopen, survival timer, reset after a fall | `tests/combat.test.ts` |
| Gifts | Ten distinct gifts; each usable, then on cooldown; Lumen cost enforced | `tests/combat.test.ts` |
| Economy | Plasma drops by rank, banking at lanterns, loss on a fall, none in the tutorial; chests open once and stay open; trials placed past the goal, entered by pushing up, fenced, exited only after the fight, a fall returns to the lantern, no goal from inside; every sword's art; Third Cut and Rising Cut; relics spent once; Forge prices, caps and loadout; sword and technique unlocks; sanitising | `tests/economy.test.ts` |
| Training | The tutorial asks for all sixteen moves behind ordered gates; a gate opens only after each move twice; counts are capped and announced; only counted in the tutorial; ground and air dash separate; combo and charged strike count; the healing lesson always has a wound and Essence | `tests/training.test.ts` |
| Gamepad | Presses on the frame only, held-at-connect ignored, non-standard devices ignored, dead zone and d-pad | `tests/gamepad.test.ts` |
| Forge (browser) | Buying an upgrade, refusing an unaffordable one, a bought sword carried into play | `e2e/menus.spec.ts` |
| Bosses | Ten bosses in area order with 2+ phases and rising pressure; unique gifts; 20+ minibosses, 2+ per area; each guardian placed exactly once; bosses guard level 10; telegraph before every attack; phase stagger; defeat clears hazards and opens the arena; difficulty scaling; reset after a fall; every phase of every boss runs without fault | `tests/bosses.test.ts` |
| Level data | 10 areas × 10 levels with the designed names; unique twists; deterministic build; 12+ enemy kinds all used; 2 shells per area with one hidden; lanterns ≤ 2700 px apart and at every boss door; sensible length | `tests/levels.test.ts` |
| Progression | Every ability returned once at its scheduled level; no level requires an ability not yet held; optional guardians grant upgrades; loadout grows by area; the tutorial teaches every mechanic | `tests/levels.test.ts` |
| Completability | The bot finishes the tutorial and all 100 levels on Gentle, Standard and Intense with the weakest loadout possible there, and collects all 20 shells | `tests/completable.test.ts` |
| Save | Fresh save, unlocks and best times, abilities/upgrades/guardians/gifts, gift cycling, shells/checkpoints/hints, settings across reset, corrupt and hostile data, storage failure | `tests/save.test.ts` |
| Input | Edge vs hold, quick taps between frames, tap = Pulse vs hold = glow, stick dead zone, reset | `tests/controls.test.ts` |
| Audio state | Boss theme, thinner melody under danger, under-water and pause muffling, calm menus and Drift, relief swell | `tests/audio.test.ts` |
| Integration | Tutorial with its guardian; Area 1 from an empty save (dash shrine, Brine Hound and wall-cling, the Warden and Tidebreaker, Area 2 opens); boss rematch from the lantern | `tests/integration.test.ts` |
| Performance (sim) | Under 1 ms per step through the final boss on Intense; projectile and zone pools bounded; no difficulty removes a fight | `tests/performance.test.ts` |
| Touch play | Real touch events on the pad: stick runs, Jump leaps, Strike swings | `e2e/play.spec.ts` |
| Flow | Begin → tutorial with HUD and pad; pause/resume; tutorial completion saved; respawn at the lantern | `e2e/play.spec.ts` |
| Menus | Ten areas and locks; level unlocks, best time, Onward; boss rematch from the map; settings persist (difficulty, handedness); Memories and Credits | `e2e/menus.spec.ts` |
| Layout / access | Title, pad, pause, HUD, boss bar and settings on 320×568, 393×851, 430×932, 844×390 (sideways), 820×1180, 1280×800; targets ≥ 44 px; no overlaps; XL text; every button named | `e2e/layout.spec.ts` |
| Desktop | Keyboard strike, run, jump, pause; left-click strike and right-button glow; focusable menus | `e2e/desktop.spec.ts` |
| Performance (browser) | Frame-rate floor and fixed scene-graph/DOM size through a boss fight; fast load; no external requests | `e2e/performance.spec.ts` |
| Offline | Reload and play with the network off after the first visit | `e2e/performance.spec.ts` |
| Console | Any console error or uncaught exception fails the e2e test that produced it | `e2e/support.ts` |

Latest results: **182 / 182** unit and integration tests, **49 / 49** end-to-end tests, lint and
typecheck clean, production build succeeds; the verification bot passes all 323 level runs.

## Manual — to do on real hardware before release

- [ ] Desktop: launch the .dmg on Apple Silicon and Intel Macs and the Windows zip on Windows 10/11;
      keyboard and an Xbox / PlayStation controller; full screen; resize.
- [ ] Android and iOS builds from `npm run mobile:android` / `mobile:ios` on real phones.

None of these has been done on a physical device yet.

- [ ] Play the tutorial and Areas 1–3 by hand on a mid-range Android phone and an iPhone: is the
      pad comfortable, do fights feel fair, are telegraphs readable at phone size? (The bot proves
      levels are *possible*, not that they are *fun*.)
- [ ] Every boss by hand on Standard and Intense: phase changes readable, openings long enough.
- [ ] 60 FPS on a mid-range phone in a busy boss fight; playable 30 FPS on a low-end one; battery
      heat after 20 minutes; Settings → Battery saver.
- [ ] Multi-touch: holding the stick while tapping Jump, Strike and Dash with the other thumb.
- [ ] Listen on speakers and headphones: hit and boss sounds balanced, no clipping.
- [ ] Haptics on Android. On iOS, only in the native wrapper (`docs/PACKAGING.md`).
- [ ] Audio interruption: a call, Siri/Assistant, lock and unlock — sound returns.
- [ ] Notch / Dynamic Island / rounded corners: HUD and pad clear of cut-outs.
- [ ] Installed PWA on iOS and Android: full screen, portrait, offline.
- [ ] Colour-vision simulation on the HUD, wards, telegraphs and elites.
- [ ] Screen reader pass over the menus.

## Known limitations

- Feel, difficulty and pacing are tuned by simulation, not human playtests.
- The verification bot is weaker than a skilled player against duelling enemies (sentinels); a few
  Intense line-ups in Area 10 were thinned so the bot can prove them, and may feel easier than the
  rest of that area.
- Headless tests render WebGL in software; frame-rate assertions guard against collapse, not prove
  60 FPS on phones.
- Bosses share a set of attack primitives and painted bodies; they differ by pattern, tint and
  pacing rather than bespoke animation.
- iOS Safari has no Vibration API: no haptics in the browser on iPhone.
- Music is generative: texture and mood, no composed themes.
- Text is English only.
