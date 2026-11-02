// Keeps the viewer itself available offline. Notes and tools are handled by the page (see
// CLAUDE.md); this only covers the app shell. Serves the saved copy at once and refreshes it in
// the background, so a viewer update applies on the launch after it was published.
const CACHE = 'nb-shell-v1';
const SHELL = ['./', 'index.html', 'marked.min.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png',
  'date/', 'date/index.html', 'date/manifest.webmanifest', 'date/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

const isShell = (url) => {
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return false;
  return SHELL.includes(url.pathname.slice(scope.pathname.length) || './');
};

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (!isShell(url)) return;
  const key = url.origin + url.pathname;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const saved = await c.match(key);
    const fresh = fetch(e.request.url, { cache: 'no-cache' }).then((res) => {
      if (res.ok) c.put(key, res.clone());
      return res;
    });
    if (saved) {
      e.waitUntil(fresh.catch(() => {}));
      return saved;
    }
    return fresh;
  }));
});
