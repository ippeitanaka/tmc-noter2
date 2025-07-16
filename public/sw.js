// サービスワーカーの基本的な実装
self.addEventListener("install", (event) => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim())
})

// オフライン対応のための基本的なキャッシュ
const CACHE_NAME = "tmc-noter-cache-v1"
const urlsToCache = [
  "/",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
  "/favicon.ico",
  "/images/tmc-noter-logo.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache)
    }),
  )
})

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // キャッシュがあればそれを返す
      if (response) {
        return response
      }
      // なければネットワークからフェッチ
      return fetch(event.request)
    }),
  )
})
