/**
 * Arcade Hub — Service Worker
 * Cache-first strategy for offline play.
 */

const CACHE_NAME = "arcade-hub-v2";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/main.js",
  "/style.css",
  "/hub/achievements.js",
  "/hub/audio.js",
  "/hub/cards.js",
  "/hub/data.js",
  "/hub/filters.js",
  "/hub/icons.js",
  "/hub/profile.js",
  "/hub/settings.js",
  "/hub/stats-bar.js",
  "/hub/transitions.js",
  "/games/shared/engine.js",
  "/games/shared/hub-integration.js",
  "/games/shared/hub-nav.js",
  "/games/shared/hub-nav.css",
  "/games/physics-merger/index.html",
  "/games/physics-merger/main.js",
  "/games/bullet-heaven/index.html",
  "/games/bullet-heaven/main.js",
  "/games/neon-dash/index.html",
  "/games/neon-dash/main.js",
  "/games/tile-match/index.html",
  "/games/tile-match/main.js",
  "/games/idle-clicker/index.html",
  "/games/idle-clicker/main.js",
  "/games/vox-runner/index.html",
  "/games/vox-runner/main.js",
  "/games/word-scramble/index.html",
  "/games/word-scramble/main.js",
  "/games/rhythm-tap/index.html",
  "/games/rhythm-tap/main.js",
];

// Install: cache all static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache-first, falling back to network
self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") return;

  // Skip external requests (fonts, CDNs)
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Return cached version, update in background (stale-while-revalidate)
        const fetchPromise = fetch(event.request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => cached);
        return cached;
      }
      // Not in cache — fetch from network and cache
      return fetch(event.request).then((response) => {
        if (response.ok && url.pathname.match(/\.(js|css|html)$/)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
