# Tidewalker — design

## One line

A small luminous creature must cross a drowning shoreline before nightfall, using its own light to
reveal the way — while every glow calls something from beneath the water.

## Pillars

1. **Light is life, and light is risk.** One verb — glow — is both the tool and the danger. It shows
   the path, makes moonglass solid, opens gates and wakes kin; it also spends Lumen and is seen.
2. **The sea is the clock.** No timers on screen. The water itself rises, closes the low roads,
   wakes what lives in it, and makes the same place harder the longer you stay.
3. **Never cheap.** No instant deaths, no jump scares, no lives. Every threat announces itself;
   every dangerous place has a readable way through; failing costs seconds, not minutes.
4. **One thumb, full feel.** Everything is reachable with one hand, and every action answers with
   motion, sound and (where the device allows) touch.
5. **One mood.** Deep blues, small warm light, quiet music. Art, sound, text and pacing all serve it.

## The creature

A tideling: a round, soft body, a tapering tail, one fin, two dark eyes, a small light on a stalk.
It hops on land, swims freely, breaches like a dolphin. It has no attack. Its animation is entirely
procedural — squash and stretch on a damped spring, a follow-the-leader tail with a travelling
wave, breathing, blinking, eyes that widen and a body that trembles when something is near.

## Core loop

Read the shore → choose dark or light → move with the water's rhythm → reach the next lantern.

| System | Rule |
| --- | --- |
| Lumen | 100 (130 Gentle / 80 Intense). Glow drains it; open water saps it slowly. |
| Restoring | Moon pools, glow plants, fireflies, safe (cyan) currents, lanterns. On land it trickles back to a floor so a crossing that needs light is always possible after a rest. |
| Running dry | On land: dimmer and slower, nothing more. In open water: a visible, audible fade of several seconds, then the tide carries you to the last lantern. |
| Lumen Pulse | Costs 20, short cooldown. Reveals a wide area, makes moonglass solid for a moment, opens bloom gates, wakes kin, and shoves fish away dazed. |
| Hiding | Still and dark inside kelp = unseen, even at touching distance. |
| Shadow-fish | Never one-hit: a bite steals Lumen and knocks you clear with brief invulnerability. Only a creature with no light left is caught. |
| Tide | Derived from the terrain (`autoTide`): at an unhurried pace the sea stays a fixed margin below the walkable shore and closes that margin by the goal. |
| Assist | Three failures at one lantern: the tide slows, fish slow, Lumen drains less, and a trail of soft lights marks the safest route until the next lantern. Nothing is announced beyond one quiet line. |

## Shadow-fish

| Fish | Behaviour | Tells | Answer |
| --- | --- | --- | --- |
| Drifter | Patrols. Investigates light, then winds up and lunges in a straight line. | Surface ripples, a low tone, eyes kindling, a contracting violet ring before the lunge. | Go dark, move off its line, hide, or pulse. |
| Angler | Motionless behind a false lamp. Strikes if touched or stared at with glow. | The lamp pulses unevenly and turns violet as its patience runs out; glow from a distance shows the body. | Trust lamps that have fireflies. Pass in the dark, or wide. |
| The Hush | A huge eel on a fixed sweep, light or no light. Light makes it hurry. | Large ripples and a deep tone well before it arrives; always faintly visible. | Time the crossing, use the stones above, hide in kelp. A pulse only stalls it. |

Fish stay dormant until the tide has flooded their water — the rising sea literally brings them.

## Hazards and puzzle pieces

Moonglass (solid only in light) · crumbling ledges · currents (constant, tide-driven, pulsing,
reversing) · whirlpools · urchins · geyser vents · bloom gates (open to glow) · tide gates (lift
when the water reaches them) · loose stones in the ruins.

## Game feel

Fixed 60 Hz simulation with render interpolation; acceleration, friction and separate air control;
coyote time (0.11 s) and jump buffering (0.14 s); variable jump height; ledge forgiveness; dash
with after-images; camera look-ahead with a vertical dead zone; shake reserved for big impacts;
pooled particles for splashes, ripples, bubbles, dust, trails, rain, fireflies and pulses.

## Difficulty and pacing

- One new mechanic per chapter (see LEVELS.md). Early chapters have no fish at all.
- Tension rises inside each chapter with the tide, and across the story to chapter 9; chapter 10
  releases it.
- Gentle / Standard / Intense scale Lumen, tide speed, drain, fish speed and senses, bite size and
  fade time. Gentle also adds lanterns. Story content is identical on all three.

## Story (told without dialogue)

A storm scatters the lights of a reef. One small light wakes on a wrecked shore (1), learns the sea
is coming back (2), meets what light wakes (3), climbs the terraces (4), finds in the kelp that it
is not the only one left (5, the midpoint), passes the breathing caves (6), climbs a drowned city
that was built for lights like it (7), slips past its keeper (8), outruns the storm's return (9),
and comes home, where every light it wakes follows it in (10). The 20 Memory Shells fill in what
happened before the first chapter.

## Art direction

Painterly 2D silhouettes in layered parallax; a multiplied lightmap sinks unlit places into blue
shadow and lets warm light restore true colour; additive halos for everything that glows.
Palette per biome in `src/assets/data/palettes.ts`. Danger is darkness, motion and a red-violet
accent — never a red warning sign.

## Audio direction

See [docs/AUDIO.md](docs/AUDIO.md). Generative, layered and adaptive: exploration, tension, danger,
relief, sanctuary. As danger rises the music gets quieter and tenser, not louder.

## UI

Minimal and diegetic where possible: a Lumen ring, a tide gauge, shell pips, two buttons.
Gesture hints are animated glyphs with at most two words, shown only until the action is done once.
