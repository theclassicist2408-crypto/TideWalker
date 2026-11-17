# Levels

Generated from the level code (`src/game/levels/areas/aNN.ts`) and checked by the tests in
`tests/levels.test.ts` and `tests/completable.test.ts`. Every level ends with a closing stretch in
the area's voice (a lantern, a run of the area's hazards and a locked fight), except bosses, chases
and the final gauntlet.

## Tutorial — The Shallows, before the fall

One level with every ability unlocked. Hints (an icon and at most a few words) teach, in order:
moving, jumping, double jump, wall-cling and wall-jump, dash and air dash, striking, the downward
strike and pogo, the charged Lumen Strike, glow and Pulse, swimming and diving, gliding, healing
(the level takes two masks first so Mend has something to do), lanterns, pausing, a guardian's
health bar and phases, and rematches. It ends with a sparring fight against the Echo of the Deep,
then the fall: the Tideborn wakes in Area 1 with only the blade.

## Abilities returned

| Ability | Where | How |
| --- | --- | --- |
| Dash | 1-2 | Shrine |
| Wall-cling and wall-jump | 1-5 | Brine Hound |
| Double jump | 2-2 | Shrine |
| Lumen Pulse | 2-6 | Lantern Thief |
| Dive | 3-1 | Shrine |
| Air dash | 3-5 | Knotfin |
| Lumen Strike (charge) | 4-2 | Shrine |
| Glide | 4-6 | Gate Scribe |

Boss gifts arrive in area order and are equipped at once: Tidebreaker, Eclipse Veil, Vinehook,
Echo Wave, Storm Step, Coral Shield, Ember Fang, Bloom Burst, Void Current, Tide Crown.

## 1. The Shallows

*What the storm left, and what crawled in after.*  
**Rule:** Stripped of everything: only the blade and your legs.  
**Boss:** The Drowned Warden — Keeper of the Shallows

| # | Level | Twist | Guardian | Shell |
| --- | --- | --- | --- | --- |
| 1 | Wreckwash | First ambush: the gates close behind you |  |  |
| 2 | Brine Steps | A shrine returns the dash; the way out needs it | Shrine → dash |  |
| 3 | Tide Race | The tide rises fast: climb or swim |  | a01-1 |
| 4 | Crumbling Causeway | Ledges fall away underfoot |  |  |
| 5 | Hound's Hollow | Guardian: the Brine Hound holds the wall-cling | Brine Hound → wall |  |
| 6 | The Chimney | A vertical climb, wall to wall |  |  |
| 7 | Lights Out | Darkness: you see only what is close |  | a01-2 (hidden) |
| 8 | Clatterjaw's Shelf | An optional guardian, and a prize for beating it | Old Clatterjaw → essence |  |
| 9 | Before the Gate | Against the clock |  |  |
| 10 | The Warden's Pool | Boss: the Drowned Warden | The Drowned Warden |  |

## 2. Moonlit Pools

*Still water, and things that sit very still in it.*  
**Rule:** Precise footing: moving ledges, moonglass, and foes that wait.  
**Boss:** The Moon-Eater — Thief of the Pools

| # | Level | Twist | Guardian | Shell |
| --- | --- | --- | --- | --- |
| 1 | Glasswater | False lights: lurkers wait behind a glow |  |  |
| 2 | Second Wind | A shrine returns the double jump | Shrine → double |  |
| 3 | The Sliding Stair | Moving ledges over open water |  | a02-1 |
| 4 | Shieldwall | Shellbacks: strike from above or behind |  |  |
| 5 | Moonglass Span | Bridges that exist only in light |  |  |
| 6 | Thief's Roost | Guardian: the Lantern Thief holds the Lumen Pulse | Lantern Thief → pulse |  |
| 7 | The Mirror Dark | Darkness, and ledges only your glow reveals |  | a02-2 (hidden) |
| 8 | Heron's Reach | Optional guardian: a heron that dives from above | Pale Heron → health |  |
| 9 | Ebb Run | Outrun the dark behind you |  |  |
| 10 | The Eater's Pool | Boss: the Moon-Eater | The Moon-Eater |  |

## 3. Kelp Abyss

*The floor falls away, and the fight goes under with it.*  
**Rule:** Underwater combat: dive, swim, and strike in three dimensions.  
**Boss:** The Kelp Sovereign — Root of the Abyss

| # | Level | Twist | Guardian | Shell |
| --- | --- | --- | --- | --- |
| 1 | The Drop | A shrine returns the dive; the way on is under water | Shrine → dive |  |
| 2 | Needles | Needlefish: dart packs in open water |  |  |
| 3 | Undertow | Currents that carry you, and currents that refuse you |  | a03-1 (hidden) |
| 4 | What the Sand Hides | Burrowers erupt where you stand |  |  |
| 5 | Knotfin's Tangle | Guardian: Knotfin holds the air dash | Knotfin → airdash |  |
| 6 | Thornwater | Urchin tunnels, above and below the water |  |  |
| 7 | The Green Dark | A drowned level in darkness |  | a03-2 (hidden) |
| 8 | The Weeping Float | Optional guardian: a float that drags you toward it | The Weeping Float → lumen |  |
| 9 | Riptide | A chase through flooded caves |  |  |
| 10 | The Sovereign's Root | Boss: the Kelp Sovereign | The Kelp Sovereign |  |

## 4. Drowned Ruins

*Someone built this for lights like you. Something else moved in.*  
**Rule:** Mixed companies: broods, shields and wings fighting together.  
**Boss:** The Abyss Choir — Voice of the Ruins

| # | Level | Twist | Guardian | Shell |
| --- | --- | --- | --- | --- |
| 1 | The Falling City | Stones fall as you pass beneath |  |  |
| 2 | The Scribe's Chisel | A shrine returns the charged strike; cracked walls bar the way | Shrine → charge |  |
| 3 | Brood Hall | Broodmothers: the room fills if you wait |  | a04-1 |
| 4 | The Long Stair | A climb against a rising tide |  |  |
| 5 | Light the Doors | Bloom doors, and hunters drawn by glow |  |  |
| 6 | The Gate Scribe | Guardian: the Gate Scribe holds the glide | Gate Scribe → glide |  |
| 7 | The Unlit Nave | Darkness, with a shell for those who glow |  | a04-2 (hidden) |
| 8 | The Bell Diver | Optional guardian: ground slams and rising spikes | Bell Diver → health |  |
| 9 | The Procession | A gauntlet: three fights without rest |  |  |
| 10 | The Choir Loft | Boss: the Abyss Choir | The Abyss Choir |  |

## 5. Storm Reach

*Above the water at last, and the sky wants you back in it.*  
**Rule:** Speed: wind in the air, faster foes, wider arenas.  
**Boss:** Squallmother — Guardian of Storm Reach

| # | Level | Twist | Guardian | Shell |
| --- | --- | --- | --- | --- |
| 1 | Squall Line | A headwind pushes you back in the air |  |  |
| 2 | Charged Air | Stormjellies: rings of lightning to step out of |  |  |
| 3 | Galewing | Optional guardian: sweeping dives across the arena | Galewing → pulse | a05-1 |
| 4 | The Watch | Sentinels: spear, then charge |  |  |
| 5 | Thunderhead | Against the clock, in the wind |  |  |
| 6 | Eye of the Storm | Survive the waves until the storm breaks |  |  |
| 7 | Thunder Calf | Optional guardian: charges under falling sparks | Thunder Calf → essence | a05-2 (hidden) |
| 8 | Whiteout | Fog hides every foe until it is close |  |  |
| 9 | The Updraft | A climb on vents and gliding leaps |  |  |
| 10 | The Squall Throne | Boss: Squallmother | Squallmother |  |

## 6. Coral Cathedral

*Beautiful, and every surface has a point on it.*  
**Rule:** Elites: stronger kin of foes you know, in rooms full of thorns.  
**Boss:** The Reef Pontiff — Guardian of the Coral Cathedral

| # | Level | Twist | Guardian | Shell |
| --- | --- | --- | --- | --- |
| 1 | Thorn Garden | Thornblooms: armoured until they open to fire |  |  |
| 2 | The Narrow Way | Spikes above and below a crumbling path |  |  |
| 3 | Rose Window | Moonglass bridges under fire |  | a06-1 |
| 4 | Choir Urchin | Optional guardian: spiralling shots and spike rows | Choir Urchin → lumen |  |
| 5 | The Elect | A duel with an elite sentinel |  |  |
| 6 | Vespers | No healing: the whole level on one life |  |  |
| 7 | The Crypt Below | Darkness where glowing draws the hunters |  | a06-2 (hidden) |
| 8 | Rosary Crab | Optional guardian: charges and five-shot fans | Rosary Crab → health |  |
| 9 | High Mass | A gauntlet of elite companies |  |  |
| 10 | The Reef Altar | Boss: the Reef Pontiff | The Reef Pontiff |  |

## 7. Sunken Forge

*The fires went out a long time ago. The heat did not.*  
**Rule:** A hostile place: vents, falling slag, shockwaves along the floor.  
**Boss:** The Cinder Smith — Guardian of the Sunken Forge

| # | Level | Twist | Guardian | Shell |
| --- | --- | --- | --- | --- |
| 1 | Slagfall | Falling slag over a floor of spikes |  |  |
| 2 | Husks | Emberhusks: leap the wave when they strike the floor |  |  |
| 3 | The Bellows | A climb on steam vents with slag falling |  | a07-1 |
| 4 | Slagback | Optional guardian: slams under a rain of slag | Slagback → essence |  |
| 5 | Quench | A rising tide in a hall of spikes |  |  |
| 6 | Hammerfall | Cracked walls between you and each fight |  |  |
| 7 | The Cold Furnace | Darkness and shockwaves |  | a07-2 (hidden) |
| 8 | Bellows Eel | Optional guardian: beams from the pipes, then dives | Bellows Eel → lumen |  |
| 9 | The Anvil | Survive the forge waking up |  |  |
| 10 | The Smith's Floor | Boss: the Cinder Smith | The Cinder Smith |  |

## 8. Abyssal Gardens

*Everything here grows toward you.*  
**Rule:** Ambush: quiet ground that erupts, swarms, and foes on all sides.  
**Boss:** The Rootmother — Guardian of the Abyssal Gardens

| # | Level | Twist | Guardian | Shell |
| --- | --- | --- | --- | --- |
| 1 | Soft Ground | An ambush: the quiet path erupts |  |  |
| 2 | Swarm | Elite broodmothers flood the room |  |  |
| 3 | The Hanging Beds | Fights above and beneath the water |  | a08-1 |
| 4 | Sporeling Queen | Optional guardian: she summons a swarm of mites | Sporeling Queen → pulse |  |
| 5 | First Shadow | Voidlings: unseen until they strike |  |  |
| 6 | Thornway | Urchin tunnels with burrowers beneath |  |  |
| 7 | Nightbloom | Darkness, bloom doors, and hunters drawn to glow |  | a08-2 (hidden) |
| 8 | Thorn Knight | Optional guardian: a charging knight that blinks behind you | Thorn Knight → health |  |
| 9 | Overgrowth | Survive an ambush from every side |  |  |
| 10 | The Root | Boss: the Rootmother | The Rootmother |  |

## 9. The Silent Deep

*No light has ever been here. Yours is the first, and it is not welcome.*  
**Rule:** Darkness everywhere: glow to see, and be hunted for it.  
**Boss:** The Hush — Guardian of the Silent Deep

| # | Level | Twist | Guardian | Shell |
| --- | --- | --- | --- | --- |
| 1 | Lightless | Total darkness; glow reveals the path and wakes the hunters |  |  |
| 2 | Hold Your Breath | Stealth: every second of glow calls another hunter |  |  |
| 3 | The Black Water | A drowned level in the dark, with elite fish |  | a09-1 (hidden) |
| 4 | Mute Twin | Optional guardian: a blinking twin in the dark | Mute Twin → lumen |  |
| 5 | The Weight | Crushing depth: short leaps, hard falls |  |  |
| 6 | The Long Dark | No healing, in the dark |  |  |
| 7 | Doors in the Deep | Bloom doors that force you to shine |  | a09-2 (hidden) |
| 8 | Lightless Maw | Optional guardian: a maw that pulls you toward its spiral | Lightless Maw → health |  |
| 9 | The Narrowing | A gauntlet of elites without a lantern |  |  |
| 10 | Where Sound Ends | Boss: the Hush | The Hush |  |

## 10. Tide King's Throne

*Everything he took is here. So is he.*  
**Rule:** The final climb: every foe, every hazard, the hardest of each.  
**Boss:** The Tide King — He Who Drowned the Moon

| # | Level | Twist | Guardian | Shell |
| --- | --- | --- | --- | --- |
| 1 | The Gilded Stair | Elite companies on a climbing stair |  |  |
| 2 | Crownfall | Falling masonry, crumbling floors, moving ledges |  |  |
| 3 | The Drowned Court | A rising tide through the palace |  | a10-1 |
| 4 | Crown Guard | Optional guardian: crossing beams, then a seven-shot fan | Crown Guard → essence |  |
| 5 | The Stolen Moon | Bright as day: you are seen from afar |  |  |
| 6 | The Last Mile | A chase to the throne room doors |  |  |
| 7 | The Eclipse | Darkness, no healing |  | a10-2 (hidden) |
| 8 | The Herald | Optional guardian: blinks, then rains light | The Herald → health |  |
| 9 | The Antechamber | The last gauntlet, then a stand before the doors |  |  |
| 10 | The Throne | Final boss: the Tide King | The Tide King |  |
