importScripts('./version.js');

// cache name follows the game version so every release invalidates cleanly
const CACHE_NAME = 'apex-racer-cache-v' +
  (typeof VERSION_INFO !== 'undefined' ? VERSION_INFO.version : 'dev');
const PRECACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './version.js',
  './lib/babylon.min.js',
  './track.js',
  './car.js',
  './race.js',
  './ghost.js',
  './autopilot.js',
  './input.js',
  './audio.js',
  './hud.js',
  './scene.js',
  './game.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
