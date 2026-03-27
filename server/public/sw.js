// ══════════════════════════════════════════════════════════════════
// CallGuard Service Worker — Offline Mode
// Caches app shell + API responses for offline operation.
// When network is unavailable, serves cached responses.
// ══════════════════════════════════════════════════════════════════

const CACHE_NAME = "callguard-v2.1";

// App shell files to pre-cache on install
const APP_SHELL = [
  "/",
  "/index.html",
  "/app.js",
  "/callguard-app.jsx",
  "/api.js",
  "/vendor/react.production.min.js",
  "/vendor/react-dom.production.min.js",
  "/vendor/babel.min.js",
];

// API paths to cache responses from (network-first, cache-fallback)
const CACHEABLE_API = [
  "/ava/api/stats",
  "/ava/api/calls",
  "/ava/api/callbacks",
  "/ava/api/appointments",
  "/ava/api/scripts",
  "/api/dashboard/stats",
  "/api/dashboard/calls/log",
  "/health",
];

// ── Install: pre-cache app shell ──
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first for API, cache-first for static ──
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests (POST/PUT/PATCH go through normally)
  if (event.request.method !== "GET") return;

  // API requests: network-first with cache fallback
  const isApi = CACHEABLE_API.some((p) => url.pathname.startsWith(p));
  if (isApi) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets: cache-first with network fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache successful static responses
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
