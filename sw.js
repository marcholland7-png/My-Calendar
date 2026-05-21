// Bump this string whenever you deploy a code change.
// It deletes all old caches and forces every client to load fresh files.
const CACHE = 'calendar-app-v5';

const STATIC = ['./manifest.json', './icon.svg'];

// In-memory store of scheduled notification timers
const _pending = new Map();

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();

  // Main thread asks SW to schedule a notification (survives tab close)
  if (e.data?.type === 'SCHEDULE_NOTIF') {
    const { nid, fireAt, title, body } = e.data;
    if (_pending.has(nid)) return;
    const ms = fireAt - Date.now();
    if (ms <= 0 || ms > 8 * 24 * 60 * 60 * 1000) return;
    const tid = setTimeout(() => {
      _pending.delete(nid);
      self.registration.showNotification(title, {
        body, icon: './icon.svg', badge: './icon.svg', tag: nid
      }).then(() => {
        // Tell any open tabs to mark this notification as shown
        self.clients.matchAll({ includeUncontrolled: true })
          .then(cs => cs.forEach(c => c.postMessage({ type: 'NOTIF_SHOWN', nid })));
      }).catch(() => {});
    }, ms);
    _pending.set(nid, tid);
  }

  // Main thread handled a notification — cancel the SW timer to avoid double-fire
  if (e.data?.type === 'CANCEL_NOTIF') {
    const tid = _pending.get(e.data.nid);
    if (tid !== undefined) { clearTimeout(tid); _pending.delete(e.data.nid); }
  }
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

self.addEventListener('push', () => {});

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC).catch(() => {})));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  if (url.endsWith('/') || url.includes('.html')) {
    e.respondWith(fetch(e.request));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
