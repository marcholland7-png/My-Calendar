// Bump this string whenever you deploy a code change.
// It deletes all old caches and forces every client to load fresh files.
const CACHE = 'calendar-app-v4';

// Only static assets are cached — NOT index.html.
// index.html is always fetched from the network so code changes
// are visible immediately without any manual cache clearing.
const STATIC = ['./manifest.json', './icon.svg'];

// Allow the page to trigger an immediate takeover (used by the update logic in index.html)
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// When user taps a notification, focus the app or open it
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow('./');
    })
  );
});

// Push stub — no-op for now, avoids errors if a push event ever arrives
self.addEventListener('push', () => {});

self.addEventListener('install', e => {
  // Also skip waiting automatically on install
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC).catch(() => {})));
});

self.addEventListener('activate', e => {
  // Delete every previous cache version on activation
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;

  // HTML — always network, never cache
  // This guarantees code updates are visible on the next page load
  if (url.endsWith('/') || url.includes('.html')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Everything else — cache-first (icons, manifest)
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
