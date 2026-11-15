import { defineConfig, loadEnv, type Plugin } from 'vite';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Writes dist/sw.js with a precache list of every built file so the game runs offline. */
function offlineServiceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'tidewalker-offline-sw',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const files: string[] = [];
      const walk = (dir: string): void => {
        for (const name of readdirSync(dir)) {
          const full = join(dir, name);
          if (statSync(full).isDirectory()) walk(full);
          else if (name !== 'sw.js') files.push('./' + relative(outDir, full).split('\\').join('/'));
        }
      };
      walk(outDir);
      const version = Date.now().toString(36);
      const source = `const CACHE = 'tidewalker-${version}';
const FILES = ${JSON.stringify(['./', ...files])};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true, ignoreVary: true }).then((hit) => hit || fetch(e.request).catch(() => (e.request.mode === 'navigate' ? caches.match('./') : Response.error()))),
  );
});
`;
      writeFileSync(join(outDir, 'sw.js'), source);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    base: env.VITE_BASE_PATH || './',
    plugins: [offlineServiceWorker()],
    build: {
      target: 'es2020',
      sourcemap: false,
      chunkSizeWarningLimit: 900,
    },
    server: { host: true, port: 5173 },
  };
});
