// Retired service worker.
// An earlier version cached every GET (including /api responses and signed-in pages). Browsers that
// still have it installed fetch this file on their next visit; it clears the old caches and removes itself.
self.addEventListener("install", () => self.skipWaiting())

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.map((n) => caches.delete(n)))
      await self.registration.unregister()
      const clients = await self.clients.matchAll({ type: "window" })
      clients.forEach((c) => c.navigate(c.url))
    })()
  )
})
