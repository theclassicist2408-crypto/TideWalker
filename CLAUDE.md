# Tidewalker — project rules

Mobile-first HTML5 game. TypeScript (strict) + Vite + PixiJS v8. No backend. All art and audio are
procedural. Repository: https://github.com/theclassicist2408-crypto/TideWalker

## Commands

| Task | Command |
| --- | --- |
| Install | `npm install` |
| Run (dev server, port 5173) | `npm run dev` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Unit + integration tests | `npm test` |
| Level verification table | `npx vite-node scripts/verify-levels.ts [chapter]` |
| Trace the bot on one level | `npx vite-node scripts/debug-bot.ts <chapter> <gentle\|standard\|intense>` |
| End-to-end tests (builds first) | `npm run test:e2e` |
| Production build | `npm run build` |
| Preview the build (port 4173) | `npm run preview` |
| Everything except e2e | `npm run check` |
| Regenerate PNG icons | `npm run icons` |
| Regenerate store screenshots | `npm run screenshots` (with `npm run preview` running) |

## Architecture

- `src/game/core` — `World` is the whole simulation: pure, deterministic, fixed 1/60 s steps, no
  Pixi, no DOM, no audio. `Game` wires input → World → renderer/audio/haptics/UI/save.
- `src/game/entities`, `src/game/systems` — functions that update one concern of a World.
- `src/game/levels` — levels are code: `LevelBuilder` + `motifs.ts`. Call order is also the bot's route.
- `src/game/effects` — everything PixiJS. Reads World state and events; never mutates gameplay.
- `src/game/audio` — `director.ts` is pure (state → mix); `engine.ts` is the only Web Audio code.
- `src/game/input` — `gestures.ts` is pure and unit-tested; `input.ts` binds DOM events.
- `src/game/ui` — DOM/CSS HUD and screens. Talks to the game only through the `UiHost` interface.
- `src/game/save` — the only code that touches `localStorage`.
- `src/assets` — procedural painters and data. No binary assets.

## Coding standards

- TypeScript strict; ES modules; no `any` outside the e2e page bridge.
- Gameplay logic never imports from `effects`, `audio`, `ui` or `pixi.js`.
- Tuning numbers live in `core/constants.ts`, not inline.
- No per-frame allocation in `World.step` or `GameRenderer.frame`: reuse objects, use the pools.
- New visuals go through the atlas (`assets/sprites/atlas.ts`) and the pooled `ParticleLayer`.
- Comments explain why. No TODOs, no placeholder art, no dead code.
- Add a dependency only if it replaces a substantial amount of code. Runtime deps: PixiJS only.

## Asset rules

- Everything is original and generated in code. Do not add downloaded images, fonts, music or sounds.
- Fonts are system stacks only (`src/assets/fonts/README.md`).
- Colour comes from `assets/data/palettes.ts`. Warm = alive/safe; red-violet = danger.
- Never signal state by colour alone; pair it with shape, motion or position.

## Level rules

- One new mechanic per chapter, taught by terrain; hints are icons with at most two words.
- Required leaps: rise ≤ 46 px, gap ≤ 64 px (ability is 90 px / 104 px). Harder leaps only on optional routes.
- Water is never an instant failure. Every pit has rungs or sloped banks. Lumen sources at least every ~900 px.
- Lanterns (checkpoints) no more than 2700 px apart, at least three per chapter.
- Two Memory Shells per chapter, ids `chNN-1` / `chNN-2`, one hidden. Vignette order follows shell ids.
- Use `autoTide` so the sea tracks the terrain; mark floors meant to flood with `floods()`.

## Testing rules

- Any gameplay change: add or update a unit test in `tests/`.
- Any level change: `npm test` must pass — the bot must finish every chapter on gentle, standard,
  intense and with `tideScale: 1.7`, and collect both shells. Fix the level, not the test.
- Any UI or input change: update `e2e/` and run `npm run test:e2e`.
- Console must be free of errors; e2e fails on any console error.

## Git rules

- Branch `main`. Commit stable, passing milestones with descriptive messages; push after each.
- Never force-push, never rewrite history, never commit secrets, `.env`, signing keys, `dist/`,
  `android/` or `ios/`.

## Definition of done

`npm run check` and `npm run test:e2e` pass; no console errors; every chapter and shell verified by
the bot; new behaviour is tested and documented; work is committed and pushed.
