// Builds the web game and wraps it for Android or iOS with Capacitor.
// Usage: node scripts/mobile.mjs <android|ios> [open|run]
//   open (default): sync and open the native project in Android Studio / Xcode
//   run: sync and install on a connected device or running emulator/simulator
// Needs Android Studio (Android SDK) for android, and Xcode for ios. The native folders are
// generated, so they are not committed; this script creates them on first use.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const platform = process.argv[2];
const action = process.argv[3] ?? 'open';
if (platform !== 'android' && platform !== 'ios') {
  console.error('Usage: node scripts/mobile.mjs <android|ios> [open|run]');
  process.exit(1);
}
const sh = (cmd) => execSync(cmd, { stdio: 'inherit' });

sh('npm run build');
if (!existsSync(platform)) sh(`npx cap add ${platform}`);
sh(`npx cap sync ${platform}`);
sh(action === 'run' ? `npx cap run ${platform}` : `npx cap open ${platform}`);
