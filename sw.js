// Service Worker: deja la app instalable y funcionando sin internet.
// Estrategia: responde del cache al instante y actualiza por debajo
// (stale-while-revalidate), así los cambios llegan en la siguiente carga.
// Para cambios de estructura, sube la versión CACHE para limpiar caches viejos.

const CACHE = 'pianitos-v0.1.2';
const CORE = [
  './',
  './index.html',
  './css/style.css',
  './js/songs.js',
  './js/audio.js',
  './js/midi.js',
  './js/keyboard-dev.js',
  './js/game.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const sameOrigin = new URL(e.request.url).origin === location.origin;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      // actualiza por debajo (no bloquea la respuesta)
      const fresh = fetch(e.request).then((res) => {
        if (res.ok && sameOrigin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => null);
      return hit || fresh || caches.match('./index.html');
    })
  );
});
