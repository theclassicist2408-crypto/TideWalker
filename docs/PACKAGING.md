# Packaging for Android and iOS

Tidewalker is a static web app, so the native apps are thin wrappers around `dist/`.
These steps use [Capacitor](https://capacitorjs.com). The repository includes
`capacitor.config.json`; the generated `android/` and `ios/` folders are git-ignored and can be
recreated at any time.

Nothing here has been run against the stores from this repository: no native project has been
generated or submitted. Treat this as a prepared checklist.

## Prerequisites

- Node.js 20+
- Android: Android Studio (SDK 34+), JDK 17
- iOS: a Mac with Xcode 15+, CocoaPods, an Apple Developer account

## 1. Build the web app

```bash
npm install
npm run check        # typecheck, lint, tests, build
```

## 2. Add Capacitor

```bash
npm i @capacitor/core @capacitor/android @capacitor/ios @capacitor/haptics @capacitor/splash-screen
npm i -D @capacitor/cli @capacitor/assets
npx cap add android
npx cap add ios
npx cap sync
```

Change `appId` in `capacitor.config.json` to a bundle id you own before the first `cap add`.

## 3. Icons and splash screens

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

## 4. Platform settings

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

## 5. Haptics bridge

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

## 6. Run on devices

```bash
npm run build && npx cap sync
npx cap run android      # or: npx cap open android
npx cap run ios          # or: npx cap open ios
```

Work through the Manual section of `QA_CHECKLIST.md` on real hardware.

## 7. Release builds

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
