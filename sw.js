const CACHE_NAME = 'coach-db-pwa-v2';

// Core local shell assets to pre-cache on install
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './favicon.ico',
    './icons/icon.svg',
    './icons/icon-72.png',
    './icons/icon-96.png',
    './icons/icon-128.png',
    './icons/icon-144.png',
    './icons/icon-152.png',
    './icons/icon-180.png',
    './icons/icon-192.png',
    './icons/icon-384.png',
    './icons/icon-512.png',
    './icons/icon-maskable-192.png',
    './icons/icon-maskable-512.png',
    './icons/apple-touch-icon.png',
    './icons/favicon-32.png',
    './icons/favicon-16.png'
];

// External CDN dependencies to cache
const CDN_ASSETS = [
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/sweetalert2@11'
];

// Service Worker Install
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('[SW] Pre-caching local app shell');
            // Cache local assets first
            await cache.addAll(PRECACHE_ASSETS);
            
            // Attempt to cache CDN assets gracefully (ignore failures so offline installs don't break)
            for (const url of CDN_ASSETS) {
                try {
                    const response = await fetch(url, { mode: 'cors' });
                    if (response && response.status === 200) {
                        await cache.put(url, response);
                    }
                } catch (err) {
                    console.warn('[SW] Could not pre-cache CDN asset:', url, err);
                }
            }
        }).then(() => self.skipWaiting())
    );
});

// Service Worker Activate
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Service Worker Fetch Event
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Only handle GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Navigation requests (HTML pages) -> Network-first with cache fallback
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    console.log('[SW] Network failed; returning cached index.html');
                    const cache = await caches.open(CACHE_NAME);
                    return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
                })
        );
        return;
    }

    // Firebase RTDB and Google Apps Script API calls -> Network-first with cache fallback
    if (url.hostname.includes('firebaseio.com') || url.hostname.includes('script.google.com')) {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    // Cache successful GET API responses for offline lookup
                    if (networkResponse && networkResponse.ok) {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    const cache = await caches.open(CACHE_NAME);
                    const cachedResponse = await cache.match(request);
                    if (cachedResponse) {
                        console.log('[SW] Serving cached API response for:', url.pathname);
                        return cachedResponse;
                    }
                    // Offline JSON fallback
                    return new Response(JSON.stringify({
                        status: 'error',
                        offline: true,
                        message: 'Network offline. Please check your internet connection.'
                    }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                })
        );
        return;
    }

    // Static Assets & CDN Resources (CSS, JS, Fonts, Images) -> Stale-While-Revalidate
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            const fetchPromise = fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const copy = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                }
                return networkResponse;
            }).catch(() => {
                // Ignore network errors for background revalidation
            });

            // Return cached response immediately if present, otherwise wait for network
            return cachedResponse || fetchPromise;
        })
    );
});

// Listen for message from client to trigger update skipWaiting
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
