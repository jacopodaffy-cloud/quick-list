/* QuickList service worker — network-first with offline fallback */
const CACHE = 'quicklist-v63';
const ASSETS = ['./', './index.html', './theme.js?v=61', './config.js?v=61', './i18n.js?v=61', './app.css?v=61', './app.js?v=61', './manifest.webmanifest', './icon.svg', './icon-maskable.svg', './icon-192.png', './icon-512.png'];
/* Translation resource files. Precached so switching language still works
   offline, but added BEST-EFFORT: addAll() is atomic, so a single missing
   locale would fail the whole install and leave the app with no service
   worker at all. Each locale is allowed to fail on its own instead. */
const LOCALES = ['it', 'es', 'fr', 'de', 'pt-BR', 'nl', 'pl', 'ru', 'tr', 'zh-Hans', 'ja', 'ar', 'hi']
  .map(c => './i18n/' + c + '.js?v=61');

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS).then(() => Promise.all(LOCALES.map(u => c.add(u).catch(() => { })))))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Promise.reject(new Error('offline')))))
  );
});
