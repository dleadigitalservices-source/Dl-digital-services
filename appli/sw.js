// Service worker : permet d'ouvrir l'application même sans réseau.
// Changer VERSION à chaque mise à jour pour que l'iPhone récupère les nouveaux fichiers.

const VERSION = 'dl-gestion-v1.1.0';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/config.js', 'js/util.js', 'js/store.js', 'js/legal.js', 'js/ui.js', 'js/demo.js',
  'js/docrender.js', 'js/reminders.js',
  'js/views/home.js', 'js/views/agenda.js', 'js/views/clients.js', 'js/views/documents.js',
  'js/views/payments.js', 'js/views/tasks.js', 'js/views/services.js', 'js/views/settings.js',
  'js/views/more.js', 'js/views/login.js',
  'icons/logo.png', 'icons/icon-192.png', 'icons/apple-touch-icon.png', 'icons/favicon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Fichiers de l'application : réseau d'abord (toujours la dernière version), copie locale si hors ligne.
// Les appels à la base de données et à l'annuaire ne passent jamais par le cache.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request).then((r) => r || caches.match('index.html'))),
  );
});
