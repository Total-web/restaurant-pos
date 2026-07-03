{
  "name": "Ticket POS - Restaurant Point of Sale",
  "short_name": "Ticket POS",
  "description": "Offline-capable restaurant order, ticket, and admin management app.",
  "start_url": "./index.html",
  "scope": "./",
  "id": "./index.html",
  "display": "standalone",
  "display_override": ["window-controls-overlay", "standalone"],
  "orientation": "any",
  "background_color": "#23241f",
  "theme_color": "#23241f",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-192-maskable.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
/* Ticket POS — service worker
   Strategy:
   - HTML shell: network-first (so a new deploy is picked up automatically),
     falling back to the cached copy when offline.
   - Everything else (icons, manifest, fonts): cache-first, falling back to
     network, so repeat visits load instantly and offline still works.
   Bump CACHE_VERSION whenever core assets change to force a clean cache. */

const CACHE_VERSION = 'ticket-pos-v1';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for same-origin static assets (icons, manifest, etc.)
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  // Cross-origin (Google Fonts, etc.) — try network, don't block offline load if it fails
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
