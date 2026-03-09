const CACHE_NAME = 'datashare-v1';

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
    '/',
    '/favicon.png',
    '/icon-192.png',
    '/icon-512.png',
];

// Install — pre-cache essential assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch — Network-first strategy for API calls, Cache-first for static assets
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip cross-origin requests (like API calls to your server)
    if (url.origin !== location.origin) return;

    // For navigation requests (HTML pages) — Network first, fallback to cache
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const cloned = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
                    return response;
                })
                .catch(() => caches.match(request) || caches.match('/'))
        );
        return;
    }

    // For static assets — Cache first, fallback to network
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                // Update cache in background
                fetch(request).then((networkResponse) => {
                    // Prevent caching partial content (HTTP 206 status codes like videos/audio streams)
                    if (networkResponse.status !== 206) {
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse.clone()));
                    }
                }).catch(() => { /* ignore backgrounds fetch errors */ });
                return cachedResponse;
            }
            return fetch(request).then((response) => {
                // Skip caching on Partial content responses (video streams)
                if (response.status !== 206) {
                    const cloned = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
                }
                return response;
            });
        })
    );
});
