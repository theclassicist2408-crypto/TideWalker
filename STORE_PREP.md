# Store preparation

Everything needed to fill in an App Store Connect and Google Play Console listing.
Nothing has been submitted; no store accounts, listings or builds exist yet.

## Identity

| Field | Value |
| --- | --- |
| Name | Tidewalker |
| Subtitle (iOS, 30) | Carry your light home |
| Short description (Play, 80) | A small light crosses a drowning shore. Glow to see — and to be seen. |
| Bundle / application id | `com.tidewalker.game` (placeholder — replace with an id you own) |
| Version | 1.0.0 |
| Category | Games → Adventure (secondary: Puzzle / Casual) |
| Price | Decide before submission. The game contains no ads and no in-app purchases. |
| Orientation | Portrait |
| Languages | English |

## Description

> The storm set you down among broken things.
>
> You are a small light on a long shore, and the sea is coming back for it.
>
> **Hold to glow.** Your light shows the way: ledges of moonglass that only exist while lit, doors
> that open to brightness, sleeping lights that wake to yours. But light spends itself — and in the
> dark water, something is always watching for it.
>
> **Tidewalker** is a quiet, cinematic adventure played with one thumb.
>
> • Ten handcrafted chapters across storm shores, moonlit pools, kelp forests, drowned ruins and a
>   glowing reef
> • A rising tide instead of a timer: hurry and the way is dry, linger and you swim
> • Shadow-fish you cannot fight — only outwit, hide from, or startle with a pulse of light
> • Twenty hidden Memory Shells that tell, without a word, how you were lost
> • Drift: an endless, peaceful shore with nothing to fear
> • Daily Tide: one short crossing each day under a different night
> • Gentle, Standard and Intense — every chapter and the ending are open on all three
> • Plays offline. No ads. No purchases. No account. Nothing tracked.

## Keywords (iOS, 100 characters)

`atmospheric,adventure,ocean,light,glow,tide,relaxing,one hand,offline,story,calm,platformer`

## What's new (1.0.0)

First release.

## Age rating

No violence, gore, combat, gambling, user-generated content, chat, or web access.
Mild peril (creatures in dark water; failure fades the screen and returns you to a lantern).
Expected: Apple 4+, Google Play Everyone / PEGI 3 (questionnaire answers: no to every content category;
"mild fantasy peril" if asked for detail).

## Privacy

- Data collected: **none**. No analytics, no advertising SDKs, no accounts, no network requests
  after the app is installed.
- Data stored: progress and settings, on the device only (`localStorage`), removable with
  Settings → Reset progress or by uninstalling.
- Apple privacy nutrition label: "Data Not Collected".
- Google Play Data safety: no data collected, no data shared.
- A privacy policy URL is still required by both stores. Suggested text:

  > Tidewalker does not collect, transmit or share any personal information. Your progress and
  > settings are saved only on your device. The game contains no advertising and no analytics.
  > Contact: (your support email)

- Children: the game is suitable for children but is not directed specifically at them; with no
  data collection it meets the stricter requirements either way.

## Screenshots

`npm run screenshots` (with `npm run preview` running) writes 1290 × 2796 portrait PNGs to
`docs/screenshots/`. That size is accepted for iPhone 6.7" and for Google Play phones.

| File | Suggested caption |
| --- | --- |
| `01-title.png` | Carry your light home |
| `02-light-makes-a-way.png` | Hold to glow. Light makes a way. |
| `03-quiet-mirrors.png` | But light is seen. |
| `04-green-cathedral.png` | Not every lamp is a friend. |
| `05-sunken-stair.png` | A city built for small lights. |
| `06-nightfall-surge.png` | The sea is right behind you. |
| `07-hearthreef.png` | Every light you wake comes with you. |
| `08-memories.png` | Twenty shells. One story, without a word. |

Also needed and not yet produced:
- iPad 12.9" screenshots (2048 × 2732) if the iPad is supported: run the script with a tablet viewport.
- Google Play feature graphic, 1024 × 500: the title scene, logotype left, creature right.
- Optional preview video, 15–30 s portrait: first glow on the moonglass bridge → a Drifter passing
  under the stones → the tide gate → home.

## Icon

`public/icon.svg` (source), `public/icons/icon-1024.png` (store icon). The small light and the
creature on deep blue; no text. Keep the subject inside the central two-thirds for adaptive masks.

## Splash

Flat `#070b1c` with the small warm light centred. See `docs/PACKAGING.md`.

## Support and legal

- Support URL and marketing URL: needed for both stores (a simple page hosting the web build works).
- Copyright line: `© 2026 (your name or studio)`.
- All art, audio and code are original to this project; the only third-party runtime code is PixiJS
  (MIT), which requires keeping its licence notice — it is preserved in the bundled build.
- Export compliance (Apple): the app uses no encryption beyond the OS's HTTPS → "No".

## Submission steps

**Google Play**
1. Play Console → Create app → Game, paid or free.
2. Complete: App access (all available), Ads (none), Content rating, Target audience, Data safety, Privacy policy.
3. Store listing: texts above, icon 512, feature graphic, at least 2 phone screenshots.
4. Upload the `.aab` to Internal testing → verify on devices → promote to Production.

**App Store**
1. App Store Connect → New App → iOS, bundle id, SKU.
2. App Privacy: Data Not Collected. Age rating questionnaire. Pricing.
3. Version page: texts above, 6.7" screenshots, support URL, copyright.
4. Upload the archive from Xcode → TestFlight → Submit for Review.

## Before submitting

- Finish the Manual section of `QA_CHECKLIST.md` on real devices.
- Replace the placeholder bundle id, add support email / URLs and the copyright holder.
- Decide price and territories.
