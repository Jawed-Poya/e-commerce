const BUILD_PRECACHE = [];
const CACHE_VERSION = "__BUILD_CACHE_VERSION__";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const PUBLIC_DATA_CACHE = `${CACHE_VERSION}-public-data`;
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/placeholder-product.svg",
  "/pwa-192.png",
  "/pwa-512.png",
  ...BUILD_PRECACHE,
];

function isCacheable(response) {
  return response && (response.ok || response.type === "opaque");
}

async function cacheSafely(cacheName, urls) {
  const cache = await caches.open(cacheName);
  await Promise.allSettled(
    [...new Set(urls)].map(async (url) => {
      const response = await fetch(url, { cache: "reload" });
      if (isCacheable(response)) await cache.put(url, response);
    }),
  );
}

async function installShell() {
  const cache = await caches.open(SHELL_CACHE);
  for (const url of ["/", "/index.html"]) {
    const response = await fetch(url, { cache: "reload" });
    if (!isCacheable(response)) throw new Error(`Cannot cache the PWA shell: ${url}`);
    await cache.put(url, response);
  }
  await cacheSafely(SHELL_CACHE, APP_SHELL.filter((url) => url !== "/" && url !== "/index.html"));
}

self.addEventListener("install", (event) => {
  event.waitUntil(installShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![SHELL_CACHE, RUNTIME_CACHE, PUBLIC_DATA_CACHE].includes(key))
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

function isPublicCatalogRequest(url) {
  const path = url.pathname.toLowerCase();
  return path.includes("/api/company/public-profile") ||
    path.includes("/api/storefront") ||
    path.includes("/api/products") ||
    path.includes("/api/types") ||
    path.includes("/api/general-types");
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(PUBLIC_DATA_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (isCacheable(response)) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached || new Response(
      JSON.stringify({ success: false, message: "This content is not available offline yet.", data: null }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    ));
  return cached || network;
}

async function networkFirst(request, fallback) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (isCacheable(response)) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (fallback ? await caches.match(fallback) : undefined) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheable(response)) {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (isPublicCatalogRequest(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/hubs/")) return;
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/index.html"));
    return;
  }

  if (url.pathname.startsWith("/assets/") || BUILD_PRECACHE.includes(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === "CACHE_URLS" && Array.isArray(event.data.urls)) {
    const urls = event.data.urls.filter((value) => {
      if (typeof value !== "string") return false;
      const url = new URL(value, self.location.origin);
      return url.origin === self.location.origin &&
        !url.pathname.startsWith("/api/") &&
        !url.pathname.startsWith("/hubs/");
    });
    event.waitUntil(
      cacheSafely(RUNTIME_CACHE, urls)
        .then(() => event.ports[0]?.postMessage({ ok: true }))
        .catch((error) => event.ports[0]?.postMessage({ ok: false, message: String(error) })),
    );
  }
});
