# Architecture

## The one rule

Gameplay is a pure simulation. `World` (`src/game/core/world.ts`) knows nothing about PixiJS, the
DOM, Web Audio or `localStorage`. Everything else observes it.

```
 touch / keys ──► InputManager ──► Intent ─┐
                  (GestureRecognizer)      │
 verification bot ──────────────► Intent ──┤
                                           ▼
                                     World.step(intent, 1/60)
                                           │  state + events
        ┌──────────────┬───────────────────┼─────────────────┬──────────────┐
        ▼              ▼                   ▼                 ▼              ▼
   GameRenderer   AudioDirector        Haptics             Hud          SaveStore
   (PixiJS)       → AudioEngine     (Vibration API /     (DOM)        (localStorage)
                   (Web Audio)       native bridge)
```

`Game` (`core/game.ts`) is the only class that knows all of them. It owns the frame loop, the
session (story / daily / drift / title), the state machine (`title → playing ⇄ paused`,
`playing → failed → playing`, `playing → complete`) and implements `UiHost`, the narrow interface
the menu screens use.

## Frame

1. `FixedLoop.advance(dt)` converts elapsed time into 0–5 fixed steps and an interpolation alpha.
2. Each step: read an `Intent`, `World.step`.
3. Drain the World's event queue: renderer (particles, squash, shake), audio, haptics, save, HUD.
4. `AudioDirector.update` → `AudioEngine.update`.
5. `GameRenderer.frame(world, alpha)` interpolates positions and draws.

The simulation is identical at 30, 60, 120 or 144 FPS; only smoothness changes.

## World

| Module | Responsibility |
| --- | --- |
| `core/world.ts` | Owns all runtime state, the event queue, checkpoints, failure, respawn, assist |
| `entities/player.ts` | Land, air, wading and swimming physics; glow; pulse; dash; collision |
| `entities/fish.ts` | Drifter / Angler / Hush state machines, bites, pulse reaction |
| `entities/props.ts` | Currents, moonglass, crumbling ledges, geysers, gates, stones, pickups, shells, kin |
| `systems/terrain.ts` | `Heightfield`: piecewise-linear ground and cave roof; duplicate x = wall |
| `systems/tide.ts` | Keyframed water level + swell + breath; trend and progress |
| `systems/lumen.ts` | Drain, restore, shelter flags, the fade that ends a run in open water |
| `systems/daily.ts` | Date → shore + condition; applies a condition to a level copy |

Collision is deliberately simple and robust: the creature is a small box tested against a
heightfield (ground), an optional second heightfield (roof), one-way platforms and gate columns.
There are no tiles and no physics engine.

Events are plain `{type, x, y, v}` records in a fixed-size preallocated queue, so the simulation
never allocates while running.

## Levels

`LevelBuilder` lays terrain left to right with a cursor and places entities relative to it; it also
records waypoints. `build()` validates the result and, with `autoTide`, derives the tide from the
terrain. Levels are cached after first use. See `LEVELS.md`.

## Rendering (`src/game/effects`)

- **Atlas** — `assets/sprites/atlas.ts` paints every sprite onto one canvas at start-up; `Gfx`
  slices it into textures. One texture means sprites batch into very few draw calls.
- **Backdrop** — sky gradient, stars, moon, clouds and three parallax layers painted per biome
  (`assets/backgrounds/painters.ts`), drawn as tiling sprites in screen space.
- **Terrain** — built lazily in 512 px chunks as the camera reaches them and freed behind it;
  each chunk also scatters biome scenery deterministically.
- **Water** — one `Graphics` redrawn each frame for the visible span only.
- **Entities** — sprites built once per level, culled by x each frame.
- **Lightmap** — lights are drawn additively into a quarter-resolution render texture that starts at
  the biome's ambient colour, then multiplied over the scene.
- **Particles** — three fixed pools (`ParticleLayer`), round-robin recycled; no allocation.
- **Adaptive quality** — render resolution is capped at 2× and steps down if frames stay slow;
  Battery saver caps it at 1×.

## Input

`GestureRecognizer` is a pure state machine fed `(id, x, y, t)` samples; it produces an `Intent`
with a *latched* direction (the creature keeps travelling, so one thumb is enough) and edge-triggered
actions. `InputManager` binds pointer and keyboard events and picks whichever the player used last.

## Audio

`AudioDirector` maps game state to target loudness for each layer and smooths it — pure and
unit-tested. `AudioEngine` builds the Web Audio graph on the first user gesture and synthesises
everything. See `AUDIO.md`.

## UI

HUD and screens are DOM, styled in one stylesheet, laid over the canvas with safe-area insets.
`Ui` is a small screen stack with fades. Screens never import game internals; they call `UiHost`.

## Save

`SaveStore` is the only user of `localStorage` (key `tidewalker.save.v1`). Loading passes through
`sanitize`, which rebuilds a valid save from anything; storage failures fall back to memory.

## Test hooks

`window.__tide` exposes the `Game` instance. Automated playtests use `autoplay()` (attach the bot)
and `debugSpeed` (run several simulation steps per frame). They are inert unless called.
