// Minimal service worker: makes the app installable and lets it open offline (the shell only — meals, chat and scans still need internet).
// It never touches requests to other origins, so Supabase and AI calls are never cached.
const CACHE = 'nutribharat-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Built files have a hash in their name, so they can be served from the cache forever.
  if (url.pathname.startsWith('/_expo/static/') || /\.(png|svg|ico|webmanifest)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  // Pages: always try the network first so users get the newest version, and fall back to the saved shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); }
        return res;
      }).catch(() => caches.match('/').then((hit) => hit || Response.error()))
    );
  }
});
