// Service worker: кэширует "скелет" приложения для офлайн-работы как у настоящего приложения.
// При выпуске изменений увеличивай CACHE_VERSION — иначе старые файлы останутся в кэше.
const CACHE_VERSION = 'engquest-v2';

const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './data/units.js',
  './js/progress.js',
  './js/srs.js',
  './js/sound.js',
  './js/achievements.js',
  './js/journal.js',
  './js/speech.js',
  './js/exercises.js',
  './js/lesson.js',
  './js/main.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Cache-first: отдаём из кэша мгновенно, в фоне обновляем кэш свежей версией с сети.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
