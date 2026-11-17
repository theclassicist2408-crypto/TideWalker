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
| Tension | A low detuned drone and uneasy overtones a semitone apart | Tide height, low Lumen, nearby foes |
| Danger | A sub drone with tremolo and a heartbeat that quickens | A foe noticing or closing on you; full strength for a guardian |
| Relief | A short rising bell phrase | Escaping danger, a lantern, a Memory Shell, the goal |
| Sanctuary | The same harmony an octave up, brighter, with more bells | Drift |

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
| A foe winds up | Short rising tell | The foe crouches, swells or glows before it acts |
| A guardian marks an area | Low warning tone | A red-violet zone with a pulsing edge, then the strike |
| A blow lands on a foe | Thud, frame holds for a moment (hit-stop) | Flash, spark burst, knockback |
| A blow is blocked | Metallic clang | Spark on the shell, the creature recoils |
| You are hurt | Dull impact | A mask empties, the creature flashes, knockback |
| Lumen Strike ready | Bright chime | The blade gathers light |
| Arena seals / opens | Gate close / open | Red-violet wards rise / fade |
| Guardian enters, changes phase, falls | Boss sting, stagger tone, release | Name and health bar, stagger pose, burst of light |
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
