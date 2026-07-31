// Minimal service worker.
//
// Its only job is to make ArtistLine installable — Chrome requires a fetch
// handler before it offers "Install app". It deliberately does NOT cache:
// every screen here is driven by live Firestore data, and a stale cached
// bundle would show artists an out-of-date queue, which is worse than an
// error. Requests pass straight through to the network.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Drop caches left by any earlier version of this worker
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
