/**
 * Show Up — Service Worker
 *
 * Strategy:
 *   - App shell (HTML, images, fonts): cache-first so repeat visits load instantly
 *   - API calls (/api/*): always network — never serve stale data
 *
 * Cache is versioned. Bump CACHE_NAME when deploying breaking changes
 * to force clients to fetch the new shell.
 */

const CACHE_NAME = 'showup-shell-v30';

const SHELL = [
  '/',
  '/index.html',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/logo.png',
  '/logo-holographique-exact.png',
];

// ── Install: cache the shell ─────────────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL))
  );
  self.skipWaiting(); // activate immediately
});

// ── Activate: delete stale caches ────────────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim(); // take control of open tabs immediately
});

// ── Fetch: route requests ─────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache API calls — always go to network
  if (url.pathname.startsWith('/api/')) return;

  // Network-first for the HTML shell so new deploys appear on a normal reload
  // (falls back to cache when offline). This avoids stale pages / hard refreshes.
  const isHTML = request.mode === 'navigate' ||
                 url.pathname === '/' ||
                 url.pathname === '/index.html';

  if (isHTML) {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('/index.html', clone));
        }
        return response;
      }).catch(() =>
        caches.match(request).then(c => c || caches.match('/index.html'))
      )
    );
    return;
  }

  // Cache-first for everything else (images, fonts, etc.)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      // Not in cache — fetch from network and cache for next time
      return fetch(request).then(response => {
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Offline and not cached — nothing we can do for non-shell assets
      });
    })
  );
});
