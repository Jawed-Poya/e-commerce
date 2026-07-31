const CACHE_VERSION = "pharmacy-store-v2";
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest", "/favicon.svg", "/placeholder-product.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

function isPublicCatalogRequest(url, request) {
  if (request.method !== "GET") return false;
  const path = url.pathname.toLowerCase();
  return path.includes("/api/company/public-profile") ||
    path.includes("/api/storefront") ||
    path.includes("/api/products") ||
    path.includes("/api/general-types");
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok || response.type === "opaque") cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached || new Response(
      JSON.stringify({ success: false, message: "This content is not available offline yet.", data: null }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    ));
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (isPublicCatalogRequest(url, request)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/hubs/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put("/index.html", copy));
          return response;
        })
        .catch(() => caches.match("/index.html")),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request).then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }),
    ),
  );
});
