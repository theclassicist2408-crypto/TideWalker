# Audio direction

There are no audio files. `src/game/audio/engine.ts` synthesises the score, the weather and every
effect with Web Audio from the data in `src/assets/audio/patches.ts`.

## Mood

Night, open air, distance. Slow pads, single bell tones, a lot of reverb. Calm and a little lonely
at first; thinner and lower as the sea rises; warm and full only at home.

## Adaptive layers

| Layer | Sound | Rises with |
| --- | --- | --- |
| Exploration | Slow chord pads and sparse bells in the biome's mode | Default; falls as tension and danger rise |
| Tension | A low detuned drone and uneasy overtones a semitone apart | Tide height, low Lumen, nearby fish |
| Danger | A sub drone with tremolo and a heartbeat that quickens | A fish noticing or closing on you |
| Relief | A short rising bell phrase | Escaping danger, a lantern, a Memory Shell, the goal |
| Sanctuary | The same harmony an octave up, brighter, with more bells | Chapter 10 and Drift |

Rule: as danger rises the melodic layers fall. The game gets *quieter* and tenser, never louder.
`AudioDirector` (`director.ts`) holds these rules as a pure function and smooths every change over
seconds so nothing ever cuts.

Under water and while paused the whole mix is low-pass filtered.

## Score per biome

| Biome | Root | Mode | Character |
| --- | --- | --- | --- |
| Storm shore | D | Aeolian | Dark, slow, wide gaps between bells |
| Tidal pools | E | Dorian | Clear, a little hopeful |
| Kelp and caves | C | Minor pentatonic | Hollow, close |
| Drowned ruins | C♯ | Aeolian | Solemn |
| Sanctuary | F | Lydian | Bright, floating, frequent bells |

Chords change every 8–10 seconds; bell notes are chosen at random from the scale at irregular
intervals, so the music never loops.

## Weather beds

Filtered noise: wind (band-pass with a slow sweep), rain (high-pass), waves (low-pass with swell),
and a deep rumble under water. Lightning calls thunder.

## Effects and what they tell the player

| Cue | Sound | Visual equivalent |
| --- | --- | --- |
| Fish somewhere near | Soft plip / deep tone for the Hush | Ripples and bubbles on the surface |
| Fish noticed you | Low falling tone | Eyes kindle, violet ring, HUD eye icon |
| Fish about to strike | Rising growl | Contracting violet ring, body shake |
| Fish off-screen and close | Danger layer, heartbeat | Violet glow on that screen edge (Visual sound cues) |
| Near miss | Bright whoosh | White ring, small shake |
| Low Lumen / fading | Two falling tones | Ring thins and core pulses; vignette closes in |
| Vent about to blow | Rising hiss | Bubbles at the vent |
| Stone about to fall | Two cracks | Stone wobbles, dust falls |
| Thunder | Low rumble | Lightning flash |

Every important audio cue has a visual one, so the game is playable with the sound off.

## Technical notes

- The context is created on the first user gesture (browser autoplay rules) and suspended when the
  tab is hidden or the app is backgrounded; `statechange` handles interruptions such as calls.
- Effects are panned and attenuated by their position relative to the camera.
- Volumes (overall, music, effects) are in Settings and saved.
