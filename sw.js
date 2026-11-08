// Mode hors connexion : l'appli est gardée en cache sur l'appareil.
// À chaque nouvelle version mise en ligne, changer ce numéro.
const CACHE = 'zephir-v16';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'icones/icone-192.png', 'icones/icone-512.png', 'icones/apple-touch-icon.png', 'icones/zephir.jpg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Réseau d'abord (pour avoir la dernière version), cache si pas de réseau.
// Les polices Google sont aussi gardées en cache après le premier chargement.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const mine = url.origin === location.origin;
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!mine && !fonts) return;
  e.respondWith(
    // no-cache : GitHub Pages dit aux navigateurs de garder les fichiers 10 min ; on redemande toujours si le fichier a changé
    fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : undefined)))
  );
});

// Notification envoyée par le serveur (push/worker.js), même si l'appli est fermée.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data.json(); } catch (err) {}
  e.waitUntil(self.registration.showNotification(d.title || 'ZEPHIR', { body: d.body || '', tag: d.tag || undefined, icon: 'icones/icone-192.png' }));
});

// Toucher une notification ouvre l'appli (ou la remet devant).
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(l => l.length ? l[0].focus() : self.clients.openWindow('./')));
});
