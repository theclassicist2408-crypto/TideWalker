# Tidewalker — design

## One line

The Tide King drowned the moon and scattered the Tideborn's powers across the deep. A small
luminous creature with a light-blade takes them back, one guardian at a time.

## Pillars

1. **Fast and exact.** Quick acceleration, short coyote time and jump buffer, variable jump height,
   dash that carries momentum into a leap. The creature goes where the thumb says, at once.
2. **Every fight is readable.** No attack lands without a wind-up, a marked zone or a pose. Every
   enemy has an answer; every boss has openings and a stagger between phases.
3. **Progress you can feel.** Powers lost in the fall come back on a schedule, each one opening
   routes and changing fights. Boss gifts and optional guardians' upgrades add build choices.
4. **Hard, never cheap.** Lanterns are close; a fall sends you back at once with the lesson fresh.
   Water never kills. Difficulty changes warnings, health and toughness, never what exists.
5. **One mood.** Deep blues, small warm light, red-violet danger, quiet generative music.

## Core loop

Read the room → move and fight through it → reach the next lantern → face the guardian → earn a
power or gift → use it to go deeper.

| System | Rule |
| --- | --- |
| Health | Six masks (eight on Gentle), plus Armour and guardian upgrades. A hit costs a mask, knocks back and grants 1.2 s of invulnerability. |
| Light-blade | 10 damage, side / up / down. A down-strike in the air pogoes off foes, spikes and urchins and restores the double jump and air dash. |
| Lumen Strike | Hold Strike 0.55 s, release: 34 damage, longer reach, breaks shellback guards, thornbloom armour and cracked stone. Costs Lumen. |
| Lumen | 100 (+25 per upgrade). Powers glow (reveals moonglass, opens bloom gates), Pulse, Lumen Strike and gifts. Refills over time, faster in moon pools. |
| Lumen Pulse | Costs 30. Stuns and damages everything nearby, clears shots, grants a moment of safety. |
| Tide Essence | Landing hits fills it (a charged hit counts double). Hold Mend on safe footing for ~1 s to spend one vial and heal one mask (two on Gentle). Some levels forbid healing. |
| Gifts | One equipped at a time, switchable. Each costs Lumen and has a cooldown. |
| Arenas | Locked fights close red-violet wards behind you and send waves; survival arenas end on a timer; failing resets the fight. |
| Assist | Repeated falls at one lantern quietly slow the tide and lengthen warnings. |

## Enemies

| Kind | Behaviour | Answer |
| --- | --- | --- |
| Kind (code) | Sea creature | Behaviour and tell | Answer |
| --- | --- | --- | --- |
| skitter | Crab grunt | Patrols; raises its claw, then lunges | Jump the lunge, strike the recovery |
| spitter | Pufferfish | Inflates, spines up, then lobs a shot | Cut shots from the air, close in |
| gloomwing | Manta ray | Wings raised high, then a swooping dive | Step aside, strike as it climbs |
| needlefish | Needlefish | Draws back like a bowstring, then darts | Slip off its line |
| burrower | Sand eel | A mound with eyes; rises shaking, then erupts | Step off the ring, strike while it is up |
| lurker | Anglerfish | A swaying lure; the jaw gapes, then snaps | Bait it, punish the miss |
| shellback | Hermit-crab knight | Claw raised as a shield | Strike from behind, from above, or charged |
| broodmother | Octopus mother | Tentacles flare as she calls her brood | Kill her first |
| mite | Shrimp crab | Fast, fragile swarmer | One hit each |
| stormjelly | Jellyfish | Bell brightens, tentacles spread, then a ring | Wait out the ring |
| emberhusk | Magma lobster | Both claws raised high, then a slam | Keep moving, strike after the slam |
| thornbloom | Anemone | Petals folded shut (armoured); opens to fire | Strike while open, or charged |
| voidling | Ghost squid | Squeezes, blinks and fires | Strike as it reappears |
| sentinel | Swordfish knight | Spear drawn back, then thrust or a shot | Close in after its attack |

Every creature is a rig of shared atlas parts (`src/game/effects/foeRig.ts`): legs step with the
distance travelled, and every wind-up is shown by pose, shake and a red-violet glow.

Elites are drawn larger and paler-pink, and have half again the health. Enemy health scales gently with
the area.

## Bosses

Each boss is built from shared attack primitives (charge, slam, fan, rain, spikes, beam, summon,
blink, spiral, dive, pull, shrink, sweep), every one telegraphed. Crossing a health threshold
staggers the boss (a chance to heal) and starts a harder phase with new attacks and shorter gaps.
Flying bosses come down to recover, which is when they can be struck.

| Area | Boss | Gift |
| --- | --- | --- |
| 1 | The Drowned Warden | Tidebreaker — slam down; shockwave stuns, breaks cracked stone |
| 2 | The Moon-Eater | Eclipse Veil — dim your light; harder to see and be seen |
| 3 | The Kelp Sovereign | Vinehook — pull yourself to a wall or foe |
| 4 | The Abyss Choir | Echo Wave — a line of sound that wounds |
| 5 | Squallmother | Storm Step — blink through harm |
| 6 | The Reef Pontiff | Coral Shield — a shell that takes one blow |
| 7 | The Cinder Smith | Ember Fang — your strikes burn |
| 8 | The Rootmother | Bloom Burst — slow healing spores |
| 9 | The Hush | Void Current — drag foes to you |
| 10 | The Tide King | Tide Crown — for a few breaths, everything quickens |

## Difficulty

| | Gentle | Standard | Intense |
| --- | --- | --- | --- |
| Extra masks | +2 | 0 | 0 |
| Enemy health | ×0.7 | ×0.88 | ×1.05 |
| Boss health | ×0.7 | ×0.88 | ×0.95 |
| Enemy speed | ×0.82 | ×0.94 | ×1.02 |
| Telegraph time | ×1.45 | ×1.15 | ×0.96 |
| Heal per vial | 2 | 1 | 1 |
| Time limits and chases | ×1.3 | ×1 | ×0.85 |

Intense bosses attack faster with shorter warnings rather than lasting longer. Foes gain 8% health
per area; the Forge's Blade gives 12% damage per level, so a player who upgrades keeps pace and the
later areas feel as hard as the early ones.

## Growing stronger

| System | Rule |
| --- | --- |
| Plasma | Every foe drops it (3 + 1.5 per area; elites ×3); minibosses 60 + 20 per area, bosses 150 + 50 per area. Carried plasma is banked at each lantern and the goal; a fall loses what was carried. |
| Diamonds | The first defeat of a guardian (2 for a boss, 1 for a miniboss), a chest every fourth level, and every trial's grand chest. |
| Forge upgrades | Blade (8 levels, +12% damage each), Armour (4, +1 mask each), Lumen Core (4, +20 Lumen), Essence Flask (3, +1 vial). Later levels also cost diamonds. |
| Swords | Tide Blade (start), Ember Fang, Stormcaller, Reefbreaker, Hollow Edge, Moonbrand. Each has power, reach and speed, and turns the charged strike into its art. Each unlocks for purchase on reaching its area. |
| Techniques | Third Cut (third quick strike ×1.5 and wider), Rising Cut (an upward strike lifts you, ×1.25), Dash Strike (strike out of a dash ×1.5), Plunge (down-strike ×2 with a burst on landing). |
| Chests | One on every level, struck open: plasma; a diamond every fourth level; a relic every third. |
| Relics | One-time Thunder Seal (lightning on every foe in sight), Frost Seal (freeze them), Tide Draught (full heal), Nova Shard (a blast all around). |
| Trials | Arches on levels 2, 5 and 8 of each area (not on chases, timed or flooded levels). Push up to step through to a fenced fight of elites past the goal; win it for a grand chest (plasma, diamonds, a relic). A fall returns you to your lantern. |

## Presentation

- **Art:** everything painted by code. Ten palettes, parallax backgrounds by biome style, a
  procedural creature with squash, stretch and a following tail, painted enemies and bosses.
- **Feedback:** hit-stop on landed blows, knockback, screen shake (optional), haptics (optional),
  slash arcs, sparks, a guardian name and health bar.
- **Audio:** a generative score per area; a danger layer swells in fights and plays at full strength
  for guardians; muffled under water and when paused.
- **Accessibility:** text size, reduced motion, shake toggle, visual cues for sound, handedness,
  three difficulties; shapes and motion always back up colour.
