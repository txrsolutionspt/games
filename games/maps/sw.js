// This name only changes when the caching STRATEGY below changes, not on
// every app edit — content freshness comes from the network-first fetch
// handler plus the app's own "?v=" cache-busting query strings on every
// local import (see search.html), not from bumping this.
const CACHE_NAME = "map-editor-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Network-first, falling back to cache: an online visit always gets
// whatever the server has right now (this app already had a real stale-
// cache bug once, from browsers caching JS modules independently of the
// HTML that referenced them — a cache-first service worker would risk
// reintroducing exactly that). Offline, this falls back to the last
// successful response for that exact URL, which is what makes the app
// (map editing against localStorage data) usable without a connection —
// map tiles and the Nominatim place search still need the network, since
// this only ever caches what was actually requested.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
