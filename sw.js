// ============================================================
// 🚀 SERVICE WORKER - Pippo Library PWA
// ============================================================

const CACHE_NAME = 'pippo-library-v1';
const RUNTIME_CACHE = 'pippo-library-runtime-v1';

// File da cachare all'installazione (App Shell)
const PRECACHE_URLS = [
    './',
    './index.html',
    './script.js',
    './exFAT/title.jpg',
    './exFAT/random_game.png',
    './exFAT/TG.png'
];

// ===== INSTALL =====
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Pre-caching app shell');
                return cache.addAll(PRECACHE_URLS.map(url => new Request(url, { cache: 'reload' })));
            })
            .then(() => self.skipWaiting())
            .catch((err) => console.warn('[SW] Pre-cache error:', err))
    );
});

// ===== ACTIVATE =====
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// ===== FETCH (strategia di caching) =====
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Ignora richieste non-GET
    if (request.method !== 'GET') return;

    // Ignora chrome-extension, ecc.
    if (!url.protocol.startsWith('http')) return;

    // ===== STRATEGIA 1: EXFAT.JSON e OLD_UPDATES.JSON (Network First) =====
    // Prova prima la rete, poi fallback alla cache
    if (url.pathname.endsWith('exFAT.json') || url.pathname.endsWith('old_updates.json')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Salva in cache la nuova versione
                    const responseClone = response.clone();
                    caches.open(RUNTIME_CACHE).then((cache) => {
                        cache.put(request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    // Offline: usa la cache
                    return caches.match(request).then((cached) => {
                        return cached || new Response(JSON.stringify([]), {
                            headers: { 'Content-Type': 'application/json' }
                        });
                    });
                })
        );
        return;
    }

    // ===== STRATEGIA 2: IMMAGINI (Cache First) =====
    // Usa la cache prima, poi la rete
    if (request.destination === 'image') {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((response) => {
                    // Salva in cache solo risposte valide
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(RUNTIME_CACHE).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                }).catch(() => {
                    // Fallback: placeholder
                    return new Response('', { status: 404 });
                });
            })
        );
        return;
    }

    // ===== STRATEGIA 3: TUTTO IL RESTO (Stale While Revalidate) =====
    // Usa cache subito, aggiorna in background
    event.respondWith(
        caches.match(request).then((cached) => {
            const fetchPromise = fetch(request).then((response) => {
                if (response.ok) {
                    const responseClone = response.clone();
                    caches.open(RUNTIME_CACHE).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            }).catch(() => cached);

            return cached || fetchPromise;
        })
    );
});

// ===== MESSAGGI DAL CLIENT =====
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data === 'CLEAR_CACHE') {
        caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name));
        });
    }
});