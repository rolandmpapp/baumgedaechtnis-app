import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const files = [];
async function walk(directory, prefix = '') {
  for (const entry of await readdir(directory, {withFileTypes:true})) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) await walk(directory + '/' + entry.name, name + '/');
    else if (name !== 'sw.js') files.push(name);
  }
}
await writeFile('dist/.nojekyll', '');
await walk('dist');
files.sort();
const hash = createHash('sha256');
hash.update(await readFile(new URL(import.meta.url)));
for (const file of files) {hash.update(file); hash.update(await readFile('dist/' + file));}
const version = hash.digest('hex').slice(0,16);
const source = `// Generated from the complete build; no user data is cached here.
const PREFIX = 'baumgedaechtnis-pages:' + encodeURIComponent(new URL('./', self.location.href).pathname) + ':';
const CACHE = PREFIX + '${version}';
const BASE = new URL('./', self.location.href).href;
const ASSETS = ${JSON.stringify(files)}.map(file => new URL(file, BASE).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(BASE)) return;
  if (event.request.mode === 'navigate') {
    // Keep the HTML and its precached asset hashes on the same version.
    event.respondWith(caches.open(CACHE).then(cache => cache.match(new URL('index.html', BASE).href, {ignoreVary:true})).then(cached => cached || fetch(event.request)));
  } else if (ASSETS.includes(url.href)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request, {ignoreVary:true})).then(cached => cached || fetch(event.request)));
  }
});
`;
await writeFile('dist/sw.js', source);
console.log('Offline cache generated:', files.length, 'assets; version', version);
