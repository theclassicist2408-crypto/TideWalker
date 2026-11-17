# Architecture

## The one rule

Gameplay is a pure simulation. `World` (`src/game/core/world.ts`) knows nothing about PixiJS, the
DOM, Web Audio or `localStorage`. Everything else observes it.

```
 touch / keys ──► InputManager ──► Intent ─┐
                  (Controls: pad + keys)   │
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
session (story / tutorial / rematch / drift / title), the state machine (`title → playing ⇄ paused`,
`playing → dead → playing` at the last lantern, `playing → complete`), hit-stop, and implements `UiHost`, the narrow interface
the menu screens use.

## Frame

1. `FixedLoop.advance(dt)` converts elapsed time into 0–5 fixed steps and an interpolation alpha.
2. Each step: skip it if a landed blow is holding the frame (hit-stop), else read an `Intent` and
   `World.step`.
3. Drain the World's event queue: renderer (particles, squash, shake), audio, haptics, save, HUD.
4. `AudioDirector.update` → `AudioEngine.update`.
5. `GameRenderer.frame(world, alpha)` interpolates positions and draws.

The simulation is identical at 30, 60, 120 or 144 FPS; only smoothness changes.

## World

| Module | Responsibility |
| --- | --- |
| `core/world.ts` | Owns all runtime state, the loadout, the event queue, projectile and zone pools, checkpoints, failure, respawn, assist, `waterAt(x)` |
| `entities/player.ts` | Run, jump, double jump, wall-cling, dash and air dash, glide, swim and dive; strikes and Lumen Strike; Pulse; healing; gifts; collision with ground, roof, platforms, blocks and gates |
| `entities/enemies.ts` | The `ENEMY` table (14 kinds) and their wind-up → attack → rest state machines |
| `entities/bosses.ts` | `BOSSES` (10), `MINIBOSSES` (20), the tutorial guardian; phases built from shared, telegraphed attack primitives |
| `entities/props.ts` | Currents, moonglass, crumbling ledges, geysers, gates, stones, pickups, shells, kin |
| `systems/terrain.ts` | `Heightfield`: piecewise-linear ground and cave roof; duplicate x = wall |
| `systems/tide.ts` | Keyframed water level + swell + breath; trend and progress |
| `systems/combat.ts` | Damage to the player, slash and Pulse resolution, gifts, arenas and waves, projectiles, telegraphed zones, spikes, level rules (chase, timer, darkness that hunts glow) |

Collision is deliberately simple and robust: the creature is a small box tested against a
heightfield (ground), an optional second heightfield (roof), one-way platforms, solid blocks and
gate columns. Water is a sea level plus still water held in basins (`level.lakes`).
There are no tiles and no physics engine.

Events are plain `{type, x, y, v}` records in a fixed-size preallocated queue, so the simulation
never allocates while running.

## Levels

`LevelBuilder` lays terrain left to right with a cursor and places entities relative to it; it also
records waypoints. `build()` validates the result and, with `autoTide`, derives the tide from the
terrain. Each area file (`levels/areas/aNN.ts`) lists ten level specs and a closing stretch;
`levels/progress.ts` holds the ability schedule and the minimum loadout for any level. Levels are
cached after first use. See `LEVELS.md`.

## Rendering (`src/game/effects`)

- **Atlas** — `assets/sprites/atlas.ts` paints every sprite onto one canvas at start-up; `Gfx`
  slices it into textures. One texture means sprites batch into very few draw calls.
- **Backdrop** — sky gradient, stars, moon, clouds and three parallax layers painted per biome
  (`assets/backgrounds/painters.ts`), drawn as tiling sprites in screen space.
- **Terrain** — built lazily in 512 px chunks as the camera reaches them and freed behind it;
  each chunk also scatters biome scenery deterministically.
- **Water** — one `Graphics` redrawn each frame for the visible span and visible basins, from
  reused buffers.
- **Combat** — `combatView.ts` draws enemies, bosses, slashes, shots, telegraph zones and the
  guardian's tells from pooled sprites.
- **Entities** — sprites built once per level, culled by x each frame.
- **Lightmap** — lights are drawn additively into a quarter-resolution render texture that starts at
  the biome's ambient colour, then multiplied over the scene.
- **Particles** — three fixed pools (`ParticleLayer`), round-robin recycled; no allocation.
- **Adaptive quality** — render resolution is capped at 2× and steps down if frames stay slow;
  Battery saver caps it at 1×.

## Input

`Controls` is pure: fed stick positions, button presses and releases with timestamps, it writes an
`Intent` with held states and edge-triggered actions (a tap of Light is a Pulse, a hold is a glow).
`InputManager` binds the on-screen pad (a floating stick and six buttons, each tracking its own
pointer) and the keyboard to it.

## Audio

`AudioDirector` maps game state to target loudness for each layer and smooths it — pure and
unit-tested. `AudioEngine` builds the Web Audio graph on the first user gesture and synthesises
everything. See `AUDIO.md`.

## UI

HUD and screens are DOM, styled in one stylesheet, laid over the canvas with safe-area insets.
`Ui` is a small screen stack with fades. Screens never import game internals; they call `UiHost`.

## Save

`SaveStore` is the only user of `localStorage` (key `tidewalker.save.v2`: tutorial, unlocks,
abilities, gifts, upgrades, guardians beaten, shells, secrets, best times, checkpoint, settings). Loading passes through
`sanitize`, which rebuilds a valid save from anything; storage failures fall back to memory.

## Test hooks

`window.__tide` exposes the `Game` instance. Automated playtests use `autoplay()` (attach the bot)
and `debugSpeed` (run several simulation steps per frame). They are inert unless called.
