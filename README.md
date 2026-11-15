# Tidewalker

> A small luminous creature must cross a drowning shoreline before nightfall, using its own light
> to reveal the way — while every glow calls something from beneath the water.

Tidewalker is a cinematic, one-thumb, portrait mobile game for the browser. It is written in
TypeScript on PixiJS, runs offline, and needs no account, backend, ads or analytics.
Every picture is painted by code at start-up and every sound is synthesised while you play, so the
repository contains no binary art or audio and nothing borrowed.

![Title](docs/screenshots/01-title.png)

## The game

- **Story** — 10 handcrafted chapters across five biomes: storm-wrecked shore, moonlit tidal pools,
  kelp forest and sea caves, drowned ruins, and the glowing sanctuary.
- **Light is life** — hold to glow. Glow reveals moonglass ledges, opens bloom gates and wakes
  sleeping kin, but it spends Lumen and draws shadow-fish. Lumen is the only resource: there are no
  lives, timers, energy or paywalls, and running out on land never ends a run.
- **The tide** — the sea rises behind you through every chapter. Hurry and the pools ahead are still
  shallow; linger and you swim.
- **Three shadow-fish** — the Drifter investigates light, the Angler hangs a false lamp, the Hush
  sweeps its halls whether you shine or not. None can be fought; all can be read, hidden from or
  pushed away with a Lumen Pulse.
- **20 Memory Shells** unlock a wordless picture-story in the Memories gallery.
- **Drift** — an endless, procedurally generated, danger-free shore.
- **Daily Tide** — one short shore each day under a different night (spring tide, sea fret, squall…).
- **Accessibility** — Gentle / Standard / Intense, text size, reduced motion, screen-shake toggle,
  visual cues for sounds, left- or right-handed HUD, haptics toggle. No content is locked by difficulty.

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Travel (keeps going) | Swipe or drag left / right | ← → or A D |
| Stop | Tap | Release |
| Leap / breach from water | Swipe up (hold for height) | Space / ↑ / W |
| Crouch, drop through, dive | Swipe down | ↓ / S |
| Dash | Swipe again the way you are going | Q / C |
| Glow | Hold anywhere | Shift / G |
| Lumen Pulse | Double-tap, second finger, or the pulse button | E / X |
| Pause | Pause button | Esc / P |

The pulse and pause buttons swap sides for left-handed play (Settings → Controls).

## Run it locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev          # http://localhost:5173 — open on a phone via your LAN IP, or use a mobile viewport
```

## Test it

```bash
npm run typecheck    # TypeScript strict mode
npm run lint         # ESLint
npm test             # 187 unit + integration tests, including bot playthroughs of every level
npx playwright install chromium   # once
npm run test:e2e     # 53 end-to-end tests with real touch input on phone, tablet and desktop viewports
npm run check        # typecheck + lint + unit tests + production build
```

`npm test` includes a verification bot that plays all 10 chapters on every difficulty (and with the
tide far ahead), collects every Memory Shell, and clears every Daily Tide shore under every
condition, using only the inputs a player has. See [QA_CHECKLIST.md](QA_CHECKLIST.md).

## Production build

```bash
npm run build        # type-checks, then writes dist/ with an offline service worker
npm run preview      # serves dist/ at http://localhost:4173
```

`dist/` is a static site: host it anywhere (GitHub Pages, Netlify, Vercel, any CDN). When hosting
under a sub-path set `VITE_BASE_PATH` (see `.env.example`). The build output is about 0.75 MB
(≈ 220 kB gzipped) and makes no network requests after the first load.

## Package for Android and iOS

The project is ready to wrap with Capacitor (`capacitor.config.json` is included).
Full steps, icons, splash screens, haptics bridge and signing are in
[docs/PACKAGING.md](docs/PACKAGING.md); store metadata is in [STORE_PREP.md](STORE_PREP.md).

```bash
npm run build
npm i -D @capacitor/cli && npm i @capacitor/core @capacitor/android @capacitor/ios
npx cap add android && npx cap add ios
npx cap sync
npx cap open android   # or: npx cap open ios
```

## Architecture

```
src/
  main.ts                 entry: creates Game, registers the service worker
  game/
    core/                 World (the simulation), Game (coordinator), loop, camera, bot, types, tuning
    entities/             player physics, shadow-fish AI, environmental props
    systems/              terrain heightfield, tide, Lumen, Daily Tide selection
    levels/               builder DSL, motifs, chapters ch01–ch10, Daily layouts, Drift generator
    input/                gesture recogniser (pure) and touch/keyboard binding
    audio/                AudioDirector (state → mix, pure) and Web Audio engine
    effects/              PixiJS renderer, views, lightmap, particles, haptics
    save/                 localStorage save with sanitising loader
    ui/                   HUD and all menu screens (DOM + CSS)
  assets/
    sprites/              procedural sprite atlas painter
    backgrounds/          procedural parallax painters
    audio/                generative score data
    data/                 palettes, Memory Shell vignettes
    fonts/                font policy (system fonts only)
tests/                    Vitest unit and integration tests
e2e/                      Playwright end-to-end tests
scripts/                  level verification, icon and screenshot generators
docs/                     architecture, audio direction, packaging, screenshots
```

The simulation (`World`) is pure, deterministic, fixed-step logic with no rendering, audio or DOM.
The renderer, audio and haptics only read its state and consume its events. That separation is what
lets the bot and the tests play real levels headlessly. More in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); design intent in [DESIGN.md](DESIGN.md); chapter by
chapter notes in [LEVELS.md](LEVELS.md).

## Roadmap

- Native builds on TestFlight and Play internal testing, with the native haptics bridge.
- Tuning pass from human playtests (the bot proves fairness, not feel).
- Optional recorded score to sit alongside the generative one.
- More Daily Tide shores and conditions; photo mode; localisation of the few lines of text.
- Controller support.

## Licence

All code, art and audio in this repository are original to this project. No third-party assets are
included. Runtime dependency: [PixiJS](https://pixijs.com) (MIT).
