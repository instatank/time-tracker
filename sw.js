const CACHE = 'dayos-v140';

// Install: become active immediately, don't wait for old SW to finish
self.addEventListener('install', () => self.skipWaiting());

// Activate: wipe all old caches, take control, then FORCE RELOAD all open
// tabs so they escape any previous broken SW state
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window' });
    await Promise.all(clients.map(c => c.navigate(c.url)));
  })());
});

// No fetch interception — requests go straight to network.
// App always loads the latest version. Offline not needed for a personal tracker.

// ── Push notifications ───────────────────────────────────────
// Background pushes from the Vercel cron (/api/cron-reminders) arrive as
// data-only FCM messages; we read title/body off `data` and render the
// notification ourselves so the platform doesn't double-fire.
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch {}
  // FCM data-only messages wrap fields under `data`; FCM `notification`
  // pushes put them at the top level. Handle both shapes.
  const src   = payload.data || payload || {};
  const title = src.title || 'DayOS';
  const body  = src.body  || '';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: './icon.svg',
      badge: './icon.svg',
      tag:  src.window || 'dayos-reminder',
      data: { url: src.url || './' },
    })
  );
});

// Tap notification → focus the open app tab or open a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = (event.notification.data && event.notification.data.url) || './';
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) { c.navigate(url).catch(() => {}); return c.focus(); }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
