// Gör att appen startar snabbt och kan installeras på hemskärmen.
// Byt versionen när du laddar upp en ny version av appen.
const VERSION = 'hemkoll-v1';
const FILES = [
  './', './index.html', './css/app.css', './manifest.webmanifest',
  './js/app.js', './js/install.js', './js/config.js', './js/firebase.js', './js/data.js', './js/ui.js', './js/dates.js',
  './js/views/auth.js', './js/views/home.js', './js/views/binder.js', './js/views/reminders.js',
  './js/views/budget.js', './js/views/more.js', './js/views/add.js',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Nätet först, sparad kopia om nätet saknas.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
