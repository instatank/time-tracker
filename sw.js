const CACHE = 'dayos-v4';

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
