# Packaging for Mac, Windows, Android and iOS

Tidewalker is a static web app; every native build is a thin wrapper around `dist/`.

| Platform | Wrapper | Command | Output | Needs |
| --- | --- | --- | --- | --- |
| Any browser | — | `npm run build && npm run preview` | `dist/` | Node 22 |
| Phone over Wi-Fi | — | `npm run dev:lan` | a `Network:` address to open on the phone | same Wi-Fi |
| macOS | Electron (`desktop/`) | `npm run desktop:mac` | `desktop/release/*.dmg` (Apple Silicon and Intel) | — |
| Windows | Electron (`desktop/`) | `npm run desktop:win` | `desktop/release/Tidewalker-2.0.0-setup.exe` (installer), `-portable.exe` (no install), `-win.zip` | — (built on the Mac) |
| Run the desktop app now | Electron | `npm run desktop:start` | a window | — |
| Android | Capacitor 8 | `npm run mobile:android` | opens Android Studio | Android Studio (SDK 35+), JDK 21 |
| iOS | Capacitor 8 | `npm run mobile:ios` | opens Xcode | Xcode 16+, an Apple ID for a device |

`npm run mobile:android -- run` / `npm run mobile:ios -- run` installs straight onto a connected
device or a running emulator/simulator instead of opening the IDE.

## Desktop (Mac and Windows)

The desktop app lives in `desktop/` with its own `package.json`, so Electron never becomes a
dependency of the game. `desktop/prepare.mjs` copies `dist/` into `desktop/web/`;
`desktop/main.cjs` opens one window and serves that build from an `app://` origin (modules,
storage and the service worker behave as on the web). F11 / ⌃⌘F toggles full screen.

- The Mac build is **not signed or notarised**. On first launch, right-click the app → Open.
  For distribution, set `mac.identity` in `desktop/package.json` and notarise with your Apple
  Developer account.
- Windows: `Tidewalker-2.0.0-setup.exe` installs with Start menu and desktop shortcuts;
  `Tidewalker-2.0.0-portable.exe` runs without installing. Neither is signed, so SmartScreen
  warns until a code-signing certificate is added (`win.certificateFile` in `desktop/package.json`).
- Saves live in the app's own storage, separate from the browser's.

## Android and iOS

`capacitor.config.json` is at the project root; `scripts/mobile.mjs` builds the web app, creates
`android/` or `ios/` on first use (they are git-ignored), syncs and opens the IDE.
Change `appId` in `capacitor.config.json` to a bundle id you own before the first build.

1. Android: install Android Studio, open it once to install the SDK, then
   `npm run mobile:android`. Press Run, or Build → Build APK(s) for an installable file.
2. iOS: install Xcode from the App Store, open it once, then `npm run mobile:ios`. Pick your
   iPhone or a simulator and press Run; a free Apple ID is enough to run on your own phone.

Both play in portrait or landscape, with the touch pad; a Bluetooth controller works too.

## Icons and splash screens

Source art is `public/icon.svg`; `npm run icons` renders the PNG set into `public/icons/`
(including a 1024 px master and a maskable icon).

```bash
mkdir -p assets
cp public/icons/icon-1024.png assets/icon-only.png
cp public/icons/icon-1024.png assets/icon-foreground.png
# assets/icon-background.png : a flat 1024x1024 fill of #070b1c
# assets/splash.png and assets/splash-dark.png : 2732x2732, #070b1c with the creature centred small
npx capacitor-assets generate --iconBackgroundColor '#070b1c' --splashBackgroundColor '#070b1c'
```

Guidance: keep the creature inside the central 66% of the icon (Android adaptive icons crop to a
circle or squircle). The splash should be the plain night colour with the small light in the
centre, so it dissolves into the title screen.

## Platform settings

**Both**
- Portrait only.
- Full screen / edge to edge. The game already pads for `env(safe-area-inset-*)`.

**Android** (`android/app/src/main/AndroidManifest.xml`)
- On the main activity: `android:screenOrientation="portrait"`.
- Immersive mode: hide system bars in `MainActivity` with `WindowInsetsControllerCompat`.
- Add `<uses-permission android:name="android.permission.VIBRATE" />` for haptics.
- No other permissions are needed. No INTERNET permission is required for gameplay.

**iOS** (Xcode target → General / Info)
- Supported orientations: Portrait only (iPhone and iPad).
- Status bar hidden; "Requires full screen" on.
- No usage-description strings are needed: the game uses no camera, microphone, location or tracking.

## Haptics bridge

iOS Safari has no Vibration API, so in the browser iPhones get no haptics. In the native wrapper,
give the game a bridge. Create `src/native-haptics.ts` in the wrapper build (or inject it as a
script) with:

```ts
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const impact: Record<string, ImpactStyle> = {
  glow: ImpactStyle.Light, land: ImpactStyle.Light, pickup: ImpactStyle.Light, ui: ImpactStyle.Light,
  hardLand: ImpactStyle.Medium, sting: ImpactStyle.Medium, nearMiss: ImpactStyle.Medium,
  pulse: ImpactStyle.Heavy, bite: ImpactStyle.Heavy,
};

(window as any).TidewalkerHaptics = {
  play(name: string) {
    if (name === 'danger') void Haptics.notification({ type: NotificationType.Warning });
    else if (name === 'shell' || name === 'checkpoint') void Haptics.notification({ type: NotificationType.Success });
    else if (name === 'caught') void Haptics.notification({ type: NotificationType.Error });
    else void Haptics.impact({ style: impact[name] ?? ImpactStyle.Light });
  },
};
```

`src/game/effects/haptics.ts` looks for `window.TidewalkerHaptics` and uses it when present; the
in-game Haptics toggle still applies.

## Run on devices

```bash
npm run build && npx cap sync
npx cap run android      # or: npx cap open android
npx cap run ios          # or: npx cap open ios
```

Work through the Manual section of `QA_CHECKLIST.md` on real hardware.

## Release builds

**Android**
1. Create an upload keystore (keep it out of git; `.gitignore` already excludes `*.jks`, `*.keystore`):
   `keytool -genkey -v -keystore upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload`
2. Android Studio → Build → Generate Signed Bundle → Android App Bundle (`.aab`).
3. Upload to Play Console → Internal testing first.

**iOS**
1. Xcode → Signing & Capabilities → select your team; set version and build number.
2. Product → Archive → Distribute App → App Store Connect.
3. Test with TestFlight before submitting for review.

## Alternative: installable web app

Without any wrapper the game is already an installable PWA (manifest + offline service worker).
Android Chrome offers "Install app"; iOS Safari offers "Add to Home Screen". A Play Store listing
can also be produced from the PWA with a Trusted Web Activity (Bubblewrap) if a hosted URL exists.

## Expo

Expo is not required. If the app is ever moved to Expo, the same `dist/` can be shown in a
full-screen `react-native-webview` with `expo-haptics` providing the bridge above.
