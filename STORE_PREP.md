# Store preparation

Everything needed to fill in an App Store Connect and Google Play Console listing.
Nothing has been submitted; no store accounts, listings or builds exist yet.

## Identity

| Field | Value |
| --- | --- |
| Name | Tidewalker |
| Subtitle (iOS, 30) | Take back your light |
| Short description (Play, 80) | A fast action-platformer: ten drowned areas, ten bosses, one small light. |
| Bundle / application id | `com.tidewalker.game` (placeholder — replace with an id you own) |
| Version | 2.0.0 |
| Category | Games → Action (secondary: Adventure) |
| Price | Decide before submission. The game contains no ads and no in-app purchases. |
| Orientation | Portrait |
| Languages | English |

## Description

> The Tide King drowned the moon, and the fall took everything you had.
>
> You are a small Tideborn with a blade of light. Take your powers back from the guardians of the
> deep — and then take back the moon.
>
> **Tidewalker** is a fast, precise action-platformer built for touch.
>
> • Ten drowned areas, a hundred levels, each with a twist of its own
> • Ten bosses with phases and patterns to learn — each one leaves you a new power
> • Twenty guardians, fourteen kinds of foe, and fights you win by reading them
> • Run, wall-jump, double jump, dash, dive, glide and pogo off danger with a downward strike
> • Lumen powers your Pulse, your charged strike and your gifts; Tide Essence heals you
> • A tutorial that teaches every move before the fall
> • Gentle, Standard and Intense — every boss stands on all three
> • Twenty hidden Memory Shells that tell, without a word, what was lost
> • Plays offline. No ads. No purchases. No account. Nothing tracked.

## Keywords (iOS, 100 characters)

`action,platformer,boss,metroidvania,ocean,light,sword,challenge,offline,touch,adventure,hard`

## What's new (2.0.0)

A new game in place of the old: real combat, ten bosses, twenty guardians, fourteen enemies, a
hundred levels across ten areas, a full tutorial, abilities and gifts to earn back, and a touch pad.

## Age rating

Fantasy combat with no blood or gore: a small creature strikes stylised sea creatures with light,
which burst into sparks. No gambling, user-generated content, chat or web access.
Expected: Apple 9+ (infrequent/mild cartoon or fantasy violence), Google Play Everyone 10+ /
PEGI 7 (mild fantasy violence). Answer the questionnaires accordingly.

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
| `01-title.png` | Take back your light |
| `02-shallows-fight.png` | Fast, exact, and every foe can be read |
| `03-warden.png` | Ten bosses. Learn them. Beat them. |
| `04-kelp-abyss.png` | Dive, and the fight goes under with you |
| `05-storm-reach.png` | Ten drowned areas, a hundred levels |
| `06-reef-pontiff.png` | Every guardian leaves you a new power |
| `07-sunken-forge.png` | Wall-jump, dash, glide, pogo |
| `08-tide-king.png` | He drowned the moon. Take it back. |
| `09-the-deep.png` | Rematch any boss you have beaten |

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
