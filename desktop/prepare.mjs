// Copies the production web build (../dist) into ./web, where the desktop app loads it from.
// Run `npm run build` in the project root first.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');
const web = join(here, 'web');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('No web build found. Run `npm run build` in the project root first.');
  process.exit(1);
}
rmSync(web, { recursive: true, force: true });
cpSync(dist, web, { recursive: true });
console.log('Copied the web build into desktop/web');
