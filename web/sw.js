// Croisette — fonctionnement hors ligne sur téléphone
const CACHE = 'croisette-v1';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/apple-touch-icon.png']))); });
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  const save = r => { if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); } return r; };
  if (u.origin === location.origin) { e.respondWith(fetch(e.request).then(save).catch(() => caches.match(e.request).then(r => r || caches.match('./')))); return; }
  if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(save)));
});
