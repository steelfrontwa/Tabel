const CACHE = 'tabel-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  // Corrected font URL from HTML
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  // Google Fonts font files (cached for true offline support)
  'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHapMsc5d-_kCZ6M45Zwpi.woff2',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      // Add all assets, but don't fail if some external resources aren't available
      return Promise.allSettled(ASSETS.map(url => cache.add(url)));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k.startsWith('tabel')).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);
  
  // Network-first for HTML (to get updates)
  if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful response
          if (response && response.status === 200) {
            const cache = caches.open(CACHE);
            cache.then(c => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => 
          caches.match(request)
            .then(cached => cached || caches.match('./index.html'))
        )
    );
  }
  // Cache-first for other resources
  else {
    e.respondWith(
      caches.match(request)
        .then(cached => cached || 
          fetch(request)
            .then(response => {
              // Cache successful responses
              if (response && response.status === 200 && request.method === 'GET') {
                caches.open(CACHE).then(c => c.put(request, response.clone()));
              }
              return response;
            })
            .catch(() => {
              // Offline fallback for common MIME types
              if (request.destination === 'image') {
                return caches.match('./index.html'); // Return index as fallback
              }
              return new Response('Offline - No cached version available', {
                status: 503,
                statusText: 'Service Unavailable',
              });
            })
        )
    );
  }
});
