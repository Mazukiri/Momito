// Momito service worker (A6): caches the static app shell only — never
// authenticated page HTML, never cross-origin API responses (the API lives on
// a different origin in both dev and production). Bump CACHE_VERSION whenever
// this file changes so old clients pick up the new shell instead of serving a
// stale one forever.
const CACHE_VERSION = 'v1';
const CACHE_NAME = `momito-shell-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline';
const PRECACHE_URLS = ['/', OFFLINE_URL];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never intercept cross-origin requests — this is where the API lives, and
  // its responses must always hit the network (or fail loudly), never be
  // served stale from a cache.
  if (url.origin !== self.location.origin) return;

  // Page navigations: try the network first (always want fresh, authenticated
  // content); on failure, show the precached offline page. Deliberately never
  // cache navigation HTML itself — this app's pages are per-user and
  // session-gated ("SW caches shell only" scope guard means static assets,
  // not page content).
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Same-origin static assets (Next's /_next/static/*, icons, manifest, fonts):
  // network-first with a cache fallback, caching successful responses so the
  // shell's chrome can still render while offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
