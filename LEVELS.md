# Tidewalker — levels

Levels are TypeScript: `src/game/levels/chapters/chNN.ts` built with `LevelBuilder`
(`builder.ts`) and reusable phrases in `motifs.ts`. The order of builder calls is also the route the
verification bot follows, so a level cannot be authored without also describing how to cross it.

## Chapters

"Bot" is the verification bot's time on Standard; it plays near-optimally and never hesitates.
Expect a first human playthrough to take roughly two to three times as long.

| # | Name | Biome | Teaches | Length | Bot | Lanterns | Fish | Hidden way |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Wreckwash | Storm shore | Light: travel, leap, glow, moonglass | 7878 px | 54 s | 4 | — | — |
| 2 | The First Rising | Storm shore | The tide: swimming, breaching, currents | 8464 px | 65 s | 3 | — | high |
| 3 | Quiet Mirrors | Tidal pools | Shadow: Drifters, hiding, Lumen Pulse | 7832 px | 61 s | 3 | 8 Drifters | ledge |
| 4 | Moonwell Terraces | Tidal pools | Vents, crumbling ledges, bloom gates | 7658 px | 83 s | 3 | 1 Drifter | crown |
| 5 | The Green Cathedral | Kelp forest | False light: Anglers; first kin | 7948 px | 65 s | 3 | 5 Anglers, 4 Drifters | deep |
| 6 | Hollow Undertow | Sea caves | Turning currents, urchins, a breathing tide | 7982 px | 73 s | 3 | 3 Drifters, 1 Angler | sump |
| 7 | The Sunken Stair | Drowned ruins | Tide gates, falling stones | 7466 px | 94 s | 3 | 1 Angler | lintel |
| 8 | Choir of the Drowned | Drowned ruins | The Hush | 7442 px | 106 s | 3 | 4 Hush, 2 Drifters, 1 Angler | crypt |
| 9 | Nightfall Surge | Storm shore | Whirlpools; everything at once | 7616 px | 100 s | 3 | 3 Drifters, 1 Hush | eye |
| 10 | Hearthreef | Sanctuary | Home: glow without fear, 12 kin | 6690 px | 99 s | 3 | 1 Hush (first third only) | lamp |

Bot total: about 13 minutes. Estimated first playthrough: 25–35 minutes.

Each chapter holds two Memory Shells (`chNN-1`, `chNN-2`). One sits in plain sight off the main
road; the other is hidden and only shimmers into view when lit by glow or a pulse.

## Structure of a chapter

1. A calm opening that restates what the last chapter taught.
2. The new mechanic in its safest possible form (for example the first Drifter swims *under* a road
   of stones you can walk across dry).
3. A lantern and a moon pool.
4. The mechanic again, combined with something already known.
5. A lantern.
6. A final stretch that asks for it under tide pressure, then a pool and the goal beacon.

## Authoring rules (enforced by tests)

- Required leaps stay well inside ability: rise ≤ 46 px and gap ≤ 64 px against 90 px / 104 px.
- Any wall taller than 60 px has rocks or a vent beside it.
- Water never kills: pits have rungs on their walls, lagoons have sloped banks.
- Lanterns are at most 2700 px apart (about 25 s) and there are at least three per chapter.
- Wide water carries fireflies near the surface so a careful swimmer cannot be starved of Lumen.
- The first chapter has nothing that hunts.

## The tide

`b.autoTide(m0, m1, …)` derives the keyframes from the terrain. Stretches made by `pit`, `basin`
or marked with `floods()` are treated as water features and ignored, so the sea tracks the
*walkable* shore: `m0` px below it at the start, closing to `m1` px by the goal, at a pace of about
66 px/s. Because the sea is level, it can only be as high as every stretch still ahead allows.
Chapter 6 adds a slow "breath" so its currents reverse; chapter 1 uses a fixed low tide.

## Motifs (`motifs.ts`)

`gullies` small leaps · `ledges` steps · `moonBridge` and `moonStairs` crossings on light ·
`cliff` a rock ladder · `stones` stepping stones, optionally crumbling · `rest` pool + lantern ·
`geyserLift` a vent up a wall · `lagoon` open water with optional kelp · `haunt` a lagoon with a
fish · `urchins` · `bloomDoor` · `tideCourt` a sunken court behind a tide gate.

## Verifying a level

```bash
npx vite-node scripts/verify-levels.ts 7      # table: gentle, standard, intense, flooded, collector
npx vite-node scripts/debug-bot.ts 7 intense  # trace: where the bot is, what bit it, where it stuck
npm test                                       # the same checks as assertions
```

"Flooded" runs the tide at 1.7× so the whole level is crossed under water — the state a very slow
player ends up in. "Collector" must gather both shells.

## Daily Tide

`src/game/levels/daily.ts` holds three short handcrafted shores (The Skerry, The Causeway,
The Reedbed). `src/game/systems/daily.ts` picks one shore and one of seven conditions from the
date, so everyone gets the same night: Spring Tide, Dark Moon, Sea Fret, Squall, Bright Moon,
Still Water, Ebb Tide. All 21 combinations are bot-verified.

## Drift

`src/game/levels/drift.ts` generates a 26 000 px peaceful shore from a seed (hills, shallow pools,
kelp, moonglass arcs, pools, plants, fireflies, kin) and the game chains seeds forever. No fish, no
urchins, no stones, no drain, no failure. The only number is how far you have wandered.
