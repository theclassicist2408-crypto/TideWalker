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
| Health | Five masks (seven on Gentle), plus upgrades. A hit costs a mask, knocks back and grants about a second of invulnerability. |
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
| Skitter | Patrols, lunges | Jump the lunge, strike the recovery |
| Spitter | Lobs arcing shots | Cut shots from the air, close in |
| Gloomwing | Swoops in a line | Step aside, strike as it climbs |
| Needlefish | Darts through water | Slip off its line |
| Burrower | Hides, erupts under you | Step off the warning ring, strike while it is up |
| Lurker | Ambush from cover | Bait it, punish the miss |
| Shellback | Blocks from the front | Strike from behind, from above, or charged |
| Broodmother | Spawns mites | Kill her first |
| Mite | Fast, fragile swarmer | One hit each |
| Stormjelly | Drifts, discharges a ring | Wait out the ring |
| Emberhusk | Heavy, slow, slams | Keep moving, strike after the slam |
| Thornbloom | Armoured until it opens to fire | Strike while open, or charged |
| Voidling | Blinks and fires | Strike as it reappears |
| Sentinel | Duels at range: shots and charges | Close in after its attack |

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
| Enemy health | ×0.8 | ×1 | ×1.15 |
| Boss health | ×0.8 | ×1 | ×1 |
| Enemy speed | ×0.86 | ×1 | ×1.08 |
| Telegraph time | ×1.3 | ×1 | ×0.88 |
| Heal per vial | 2 | 1 | 1 |
| Time limits and chases | ×1.3 | ×1 | ×0.85 |

Intense bosses keep full health but attack faster with shorter warnings: harder without being longer.

## Presentation

- **Art:** everything painted by code. Ten palettes, parallax backgrounds by biome style, a
  procedural creature with squash, stretch and a following tail, painted enemies and bosses.
- **Feedback:** hit-stop on landed blows, knockback, screen shake (optional), haptics (optional),
  slash arcs, sparks, a guardian name and health bar.
- **Audio:** a generative score per area; a danger layer swells in fights and plays at full strength
  for guardians; muffled under water and when paused.
- **Accessibility:** text size, reduced motion, shake toggle, visual cues for sound, handedness,
  three difficulties; shapes and motion always back up colour.
