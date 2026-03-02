const CACHE_NAME = "novyra-v1"
const STATIC_CACHE_URLS = [
  "/",
  "/ask",
  "/ai-agent",
  "/profile",
  "/community",
  "/about",
  "/offline",
]

// Install event - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_CACHE_URLS)
    })
  )
})

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    })
  )
})

// Fetch event - serve from cache when offline
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached version if available
      if (cachedResponse) {
        return cachedResponse
      }

      // Otherwise fetch from network
      return fetch(event.request)
        .then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response
          }

          // Clone the response for caching
          const responseToCache = response.clone()

          // Cache the response
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })

          return response
        })
        .catch(() => {
          // Return offline page for navigation requests
          if (event.request.mode === "navigate") {
            return caches.match("/offline")
          }
          // Return a generic offline response for other requests
          return new Response("Offline", {
            status: 503,
            statusText: "Service Unavailable",
            headers: new Headers({
              "Content-Type": "text/plain",
            }),
          })
        })
    })
  )
})

// Background sync for form submissions when offline
self.addEventListener("sync", (event) => {
  if (event.tag === "background-sync") {
    event.waitUntil(doBackgroundSync())
  }
})

async function doBackgroundSync() {
  // Handle background sync for form submissions
  // This would integrate with your API to sync offline actions
  console.log("Performing background sync...")
}

// Push notifications (optional)
self.addEventListener("push", (event) => {
  if (!event.data) return

  const data = event.data.json()
  const options = {
    body: data.body,
    icon: "/icon-192x192.png",
    badge: "/badge-72x72.png",
    vibrate: [200, 100, 200],
    data: {
      url: data.url || "/",
    },
    actions: [
      {
        action: "open",
        title: "Open",
        icon: "/action-open.png",
      },
      {
        action: "close",
        title: "Close",
        icon: "/action-close.png",
      },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  if (event.action === "open") {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || "/")
    )
  }
})
