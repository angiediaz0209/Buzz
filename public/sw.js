// Service worker for Buzz.
//
// This runs on client phones over venue wifi, which is the worst network the
// app ever sees. Its job is to make a repeat open cost nothing.
//
// An earlier version of this file deliberately cached nothing, reasoning that a
// stale bundle would show an out-of-date queue. That was wrong, and it is worth
// spelling out why so it doesn't get "fixed" back: queue data never travels
// through here. Firestore talks to its own servers on its own connection, which
// this worker passes straight through and never stores. What gets cached is only
// the shell — the HTML, the JS bundle, the CSS, the icons. Caching those cannot
// make a number stale, because no number lives in them.
//
// The one real tradeoff: after a deploy, a phone with a warm cache runs the
// previous shell for one more open while the new one downloads in the
// background, and picks it up next time. That is the cost of not re-downloading
// ~220 KB every single time somebody scans a code.

const VERSION = 'v2';
const SHELL_CACHE = `buzz-shell-${VERSION}`;
const ASSET_CACHE = `buzz-assets-${VERSION}`;
const KEEP = [SHELL_CACHE, ASSET_CACHE];

// The app is served from / on Firebase Hosting and /Buzz/ on GitHub Pages.
// registration.scope already carries whichever it is.
const SHELL_URL = new URL('./index.html', self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // Warm the shell so the very next open is instant, even offline.
      try {
        const cache = await caches.open(SHELL_CACHE);
        await cache.add(new Request(SHELL_URL, { cache: 'reload' }));
      } catch {
        // A failed warm-up is not fatal; the first navigation fills it.
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older versions of this worker, keep the current pair.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

/** Vite writes content-hashed filenames, so an asset URL never changes meaning. */
const isHashedAsset = (url) => url.pathname.includes('/assets/');

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetching = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  // Serve what we have and update in the background; only wait when we have
  // nothing.
  if (cached) return cached;

  const fresh = await fetching;
  if (fresh) return fresh;
  throw new Error('offline and nothing cached');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never interfere with anything but plain GETs.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Firestore, Auth and anything else off-origin goes straight to the network,
  // uncached. This is the line that keeps queue data live.
  if (url.origin !== self.location.origin) return;

  // SPA navigations: every route renders from the same shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match(SHELL_URL);

        const fetching = fetch(request)
          .then((response) => {
            if (response && response.ok) cache.put(SHELL_URL, response.clone());
            return response;
          })
          .catch(() => null);

        if (cached) return cached;
        return (await fetching) || Response.error();
      })()
    );
    return;
  }

  // Hashed bundles are immutable: cache-first, never re-validated.
  if (isHashedAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;

        const response = await fetch(request);
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      })()
    );
    return;
  }

  // Icons, mascot, manifest: use what we have, refresh quietly.
  event.respondWith(
    staleWhileRevalidate(request, ASSET_CACHE).catch(() => fetch(request))
  );
});
