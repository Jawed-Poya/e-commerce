const BUILD_PRECACHE = [];
const CACHE_VERSION = "__BUILD_CACHE_VERSION__";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg",
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
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

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
  if (url.origin !== self.location.origin) return;

  // Authentication, customer, stock, and finance responses must never be
  // persisted in Cache Storage. Offline writes use the IndexedDB queue.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/hubs/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/index.html"));
    return;
  }

  // Hashed production assets are immutable. Vite development modules remain
  // network-first so code changes are immediate while an offline fallback is
  // still available after the development server is stopped.
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
