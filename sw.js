// ================================================================
// sw.js — Service Worker untuk Fix Gym Kasir PWA
// ================================================================

const CACHE_NAME = "fixgym-kasir-v2";

// Hanya cache file lokal saja (hindari CORS error dari CDN)
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./api.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

// Install — cache semua asset
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      console.log("[SW] Caching assets...");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate — hapus cache lama
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function (name) { return name !== CACHE_NAME; })
          .map(function (name) {
            console.log("[SW] Deleting old cache:", name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch — Network first, fallback to cache
self.addEventListener("fetch", function (event) {
  // Jangan intercept request ke Google Apps Script (GAS)
  if (event.request.url.includes("script.google.com")) {
    return;
  }

  // Jangan intercept request ke CDN eksternal
  if (
    event.request.url.includes("cdn.tailwindcss.com") ||
    event.request.url.includes("cdn.jsdelivr.net") ||
    event.request.url.includes("cdnjs.cloudflare.com") ||
    event.request.url.includes("fonts.googleapis.com") ||
    event.request.url.includes("fonts.gstatic.com")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        // Kalau berhasil dari network, update cache
        if (response && response.status === 200 && response.type === "basic") {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(function () {
        // Kalau offline, ambil dari cache
        return caches.match(event.request).then(function (cached) {
          if (cached) return cached;
          // Fallback ke index.html untuk navigasi
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
      })
  );
});
