// Service worker: makes the attendee app work on a flaky venue connection.
//
// - Same-origin requests: network first (so edits show immediately),
//   falling back to the last cached copy when offline.
// - Google Fonts: cache first (they never change).
// - Admin pages, admin API and GitHub API calls are never cached.
//
// Bump VERSION to force old caches to be dropped.

const VERSION = 'v2';
const CACHE = `nights-${VERSION}`;
// Paths are relative to the service worker's folder, so this works at the
// site root and under a sub-path such as https://<user>.github.io/<repo>/.
const SHELL = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/api.js',
  'js/dom.js',
  'js/icons.js',
  'js/lyrics.js',
  'js/prefs.js',
  'js/wakeLock.js',
  'js/shared/db.js',
  'js/components/songList.js',
  'js/components/lyricsViewer.js',
  'icon.svg',
  'manifest.webmanifest',
];
const SCOPE_PATH = new URL('./', self.location).pathname; // e.g. "/" or "/70_80_Nights/"

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.origin !== self.location.origin) return;
  const path = url.pathname.slice(SCOPE_PATH.length);
  if (path.startsWith('admin') || path.startsWith('api/admin') || path.startsWith('js/admin')) return;

  event.respondWith(networkFirst(request, url));
});

async function networkFirst(request, url) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    // Offline navigation to any path → serve the app shell.
    if (request.mode === 'navigate') {
      const shell = await cache.match('index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}
