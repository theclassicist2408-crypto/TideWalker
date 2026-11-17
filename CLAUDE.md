# Tidewalker — project rules

Mobile-first HTML5 action-platformer. TypeScript (strict) + Vite + PixiJS v8. No backend. All art and audio are
procedural. Repository: https://github.com/theclassicist2408-crypto/TideWalker

## Commands

| Task | Command |
| --- | --- |
| Install | `npm install` |
| Run (dev server, port 5173) | `npm run dev` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Unit + integration tests | `npm test` |
| Level verification table | `npm run verify:levels` or `npx vite-node scripts/verify-levels.ts [area] [level]` (area 0 = tutorial) |
| Trace the bot on one level | `npx vite-node scripts/debug-bot.ts <area> <level> [gentle\|standard\|intense]` (env `LIMIT`, `EVERY`, `COLLECT`) |
| End-to-end tests (builds first) | `npm run test:e2e` |
| Production build | `npm run build` |
| Preview the build (port 4173) | `npm run preview` |
| Everything except e2e | `npm run check` |
| Regenerate PNG icons | `npm run icons` |
| Regenerate store screenshots | `npm run screenshots` (with `npm run preview` running) |

## Architecture

- `src/game/core` — `World` is the whole simulation: pure, deterministic, fixed 1/60 s steps, no
  Pixi, no DOM, no audio. `Game` wires input → World → renderer/audio/haptics/UI/save.
- `src/game/entities`, `src/game/systems` — functions that update one concern of a World: player,
  enemies (`ENEMY` table), bosses and minibosses (`BOSSES`, `MINIBOSSES`), props; combat, arenas,
  hazards and level rules live in `systems/combat.ts`.
- `src/game/levels` — levels are code: `LevelBuilder` + `motifs.ts`; `areas/aNN.ts` hold ten levels
  each plus the area's closing stretch. Call order is also the bot's route. `progress.ts` says which
  abilities a level may require (`ABILITY_SCHEDULE`).
- `src/game/effects` — everything PixiJS. Reads World state and events; never mutates gameplay.
- `src/game/audio` — `director.ts` is pure (state → mix); `engine.ts` is the only Web Audio code.
- `src/game/input` — `controls.ts` is pure and unit-tested; `input.ts` binds the touch pad and keyboard.
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
- Every enemy and boss attack is telegraphed (wind-up, zone marker or pose) before it can hurt.

## Level rules

- Ten areas of ten levels. Each area has one rule of its own; each level has its own twist line.
- Level 10 of each area is the boss, with a lantern at its door. Two or more minibosses per area;
  only those that return an ability are required.
- A level may only require abilities from `abilitiesAt(area, level)` or a shrine/guardian earlier
  in the same level. Harder leaps only on optional routes.
- Lanterns (checkpoints) no more than 2700 px apart (chases restart from the top by design).
- Water is never an instant failure. Basins hold still water (`basin`, `pit({ swim: true })`).
- Two Memory Shells per area, ids `aNN-1` / `aNN-2`, at least one hidden.

## Testing rules

- Any gameplay change: add or update a unit test in `tests/`.
- Any level or combat change: `npm test` must pass — the bot must finish the tutorial and every level
  on gentle, standard and intense with `minimumLoadout`, and collect every shell. Fix the level, not
  the test.
- Any UI or input change: update `e2e/` and run `npm run test:e2e`.
- Console must be free of errors; e2e fails on any console error.

## Git rules

- Branch `main`. Commit stable, passing milestones with descriptive messages; push after each.
- Never force-push, never rewrite history, never commit secrets, `.env`, signing keys, `dist/`,
  `android/` or `ios/`.

## Definition of done

`npm run check` and `npm run test:e2e` pass; no console errors; every level, boss and shell
verified by the bot; new behaviour is tested and documented; work is committed and pushed.
