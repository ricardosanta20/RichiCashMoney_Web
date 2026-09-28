// V9.1
self.addEventListener('install', (e) => {
    // Obliga al navegador a instalar la nueva versión inmediatamente
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    // Destruye todos los cachés antiguos almacenados en el dispositivo
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => caches.delete(key)));
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    // Obliga a buscar siempre en la red, sin guardar copias ocultas
    e.respondWith(fetch(e.request));
});