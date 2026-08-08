/* ==========================================================
   cheat/deck — service worker
   App shell offline : le site (HTML/CSS/JS/données) reste
   consultable sans connexion une fois visité une première fois.
   Bump CACHE_VERSION à chaque changement de app.js/data.js/style.css
   pour forcer le renouvellement du cache chez les visiteurs.
   ========================================================== */
const CACHE_VERSION = 'cheatdeck-20260808a';
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css?v=20260808a',
  './app.js?v=20260808a',
  './data.js?v=20260808a',
  './icons.js?v=20260808a',
  './manifest.json',
  './favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return;

  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return; // laisse passer les CDN externes (fonts, lenis)

  // Navigation (chargement de la page) : réseau d'abord, secours sur le cache si hors-ligne.
  if(req.mode === 'navigate'){
    event.respondWith(
      fetch(req).then((res) => {
        caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', res.clone()));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Reste des assets same-origin : cache d'abord, réseau en secours (et mise à jour silencieuse du cache).
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        if(res && res.status === 200){
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, res.clone()));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
