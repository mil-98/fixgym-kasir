// ================================================================
// sw.js — Service Worker untuk Fix Gym Kasir PWA
// ================================================================

const CACHE_NAME = "fixgym-kasir-v1";

// File yang akan di-cache untuk offline
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./api.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "https://cdn.tailwindcss.com",
  "https://cdn.jsdelivr.net/npm/chart.js",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css",
  "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&family=Bricolage+Grotesque:wght@700;800&display=swap"
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
