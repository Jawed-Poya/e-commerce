const BUILD_PRECACHE = [];
const CACHE_VERSION = "__BUILD_CACHE_VERSION__";
const IS_DEVELOPMENT_WORKER = CACHE_VERSION === "__BUILD_CACHE_VERSION__";
const CACHE_PREFIX = "commerce-storefront";
const SHELL_CACHE = `${CACHE_PREFIX}-${CACHE_VERSION}-shell`;
const STATIC_CACHE = `${CACHE_PREFIX}-${CACHE_VERSION}-static`;
const IMAGE_CACHE = `${CACHE_PREFIX}-${CACHE_VERSION}-images`;
const PUBLIC_API_CACHE = `${CACHE_PREFIX}-${CACHE_VERSION}-public-api`;
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
const NETWORK_TIMEOUT_MS = 3500;
const API_TIMEOUT_MS = 4000;
const MAX_STATIC_ENTRIES = 250;
const MAX_IMAGE_ENTRIES = 180;
const MAX_PUBLIC_API_ENTRIES = 220;

function isCacheable(response) {
  return response && (response.ok || response.type === "opaque");
}

function offlineJson(message) {
  return new Response(
    JSON.stringify({ success: false, message, data: null }),
    {
      status: 503,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

async function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function trimCache(cacheName, maximumEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const excess = keys.length - maximumEntries;
  if (excess <= 0) return;
  await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
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
    if (!isCacheable(response)) {
      throw new Error(`Cannot cache the PWA shell: ${url}`);
    }
    await cache.put(url, response);
  }

  if (BUILD_PRECACHE.length > 0) {
    const requiredBuildFiles = [...new Set(BUILD_PRECACHE)]
      .filter((url) => url !== "/index.html");
    await cache.addAll(requiredBuildFiles);
  } else {
    await cacheSafely(
      SHELL_CACHE,
      APP_SHELL.filter((url) => url !== "/" && url !== "/index.html"),
    );
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(installShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const currentCaches = new Set([
      SHELL_CACHE,
      STATIC_CACHE,
      IMAGE_CACHE,
      PUBLIC_API_CACHE,
    ]);
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) =>
          (key.startsWith(`${CACHE_PREFIX}-`) || key.startsWith("pharmacy-store-")) &&
          !currentCaches.has(key),
        )
        .map((key) => caches.delete(key)),
    );

    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }

    await self.clients.claim();
  })());
});

async function navigationResponse(event) {
  const shell = await caches.open(SHELL_CACHE);
  const cached = await shell.match("/index.html");
  const update = (async () => {
    const preload = await event.preloadResponse;
    const response = preload || await fetchWithTimeout(event.request, NETWORK_TIMEOUT_MS);
    if (isCacheable(response)) {
      await shell.put("/index.html", response.clone());
    }
    return response;
  })();

  if (cached) {
    event.waitUntil(update.catch(() => undefined));
    return cached;
  }

  try {
    return await update;
  } catch {
    return new Response(
      "<!doctype html><html><body><main style='font-family:system-ui;padding:2rem'><h1>Offline</h1><p>Open this store once while online so its offline files can be installed.</p></main></body></html>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}

async function cacheFirst(request, cacheName, maximumEntries) {
  const cache = await caches.open(cacheName);
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheable(response)) {
    await cache.put(request, response.clone());
    await trimCache(cacheName, maximumEntries);
  }
  return response;
}

async function staticAssetResponse(request, cacheName, maximumEntries) {
  if (!IS_DEVELOPMENT_WORKER) {
    return cacheFirst(request, cacheName, maximumEntries);
  }

  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (isCacheable(response)) {
      await cache.put(request, response.clone());
      await trimCache(cacheName, maximumEntries);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error(`Offline asset is not cached: ${request.url}`);
  }
}

async function imageResponse(request) {
  try {
    return await staticAssetResponse(request, IMAGE_CACHE, MAX_IMAGE_ENTRIES);
  } catch {
    const fallback = await caches.match("/placeholder-product.svg");
    return fallback || new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><rect width="320" height="240" fill="#e5e7eb"/><path d="M88 168l48-52 35 37 22-24 39 39H88z" fill="#9ca3af"/><circle cx="119" cy="83" r="17" fill="#9ca3af"/></svg>',
      { headers: { "Content-Type": "image/svg+xml; charset=utf-8" } },
    );
  }
}

async function tokenScope(request) {
  const authorization = request.headers.get("Authorization") || "guest";
  const bytes = new TextEncoder().encode(authorization);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function publicCacheKey(request) {
  const url = new URL(request.url);
  url.searchParams.set("__offline_scope", await tokenScope(request));
  return new Request(url.toString(), { method: "GET" });
}

function canCacheJson(response) {
  if (!response.ok) return false;
  const cacheControl = response.headers.get("Cache-Control") || "";
  if (cacheControl.toLowerCase().includes("no-store")) return false;
  const contentType = (response.headers.get("Content-Type") || "").toLowerCase();
  return contentType.includes("application/json") || contentType.includes("application/manifest+json");
}

async function publicApiNetworkFirst(request) {
  const cache = await caches.open(PUBLIC_API_CACHE);
  const key = await publicCacheKey(request);
  const cached = await cache.match(key);

  try {
    const response = await fetchWithTimeout(request, API_TIMEOUT_MS);
    if (canCacheJson(response)) {
      await cache.put(key, response.clone());
      await trimCache(PUBLIC_API_CACHE, MAX_PUBLIC_API_ENTRIES);
    }
    return response;
  } catch {
    return cached || offlineJson("This content has not been opened on this device yet.");
  }
}

function isPublicApiRequest(url) {
  const path = url.pathname.toLowerCase();
  return path.includes("/api/company/public-profile") ||
    path.includes("/api/company/manifest.webmanifest") ||
    path.includes("/api/storefront") ||
    path.includes("/api/catalog") ||
    path.includes("/api/products") ||
    path.includes("/api/reviews") ||
    path.includes("/api/types") ||
    path.includes("/api/general-types");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  if (isPublicApiRequest(url)) {
    event.respondWith(publicApiNetworkFirst(request));
    return;
  }

  if (url.pathname.toLowerCase().startsWith("/api/") || url.pathname.toLowerCase().startsWith("/hubs/")) {
    return;
  }

  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(navigationResponse(event));
    return;
  }

  if (request.destination === "image") {
    event.respondWith(imageResponse(request));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font" ||
    url.pathname.startsWith("/assets/") ||
    BUILD_PRECACHE.includes(url.pathname)
  ) {
    event.respondWith(staticAssetResponse(request, STATIC_CACHE, MAX_STATIC_ENTRIES));
    return;
  }

  event.respondWith(staticAssetResponse(request, STATIC_CACHE, MAX_STATIC_ENTRIES));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === "CLEAR_PRIVATE_CACHES") {
    event.waitUntil(
      caches.delete(PUBLIC_API_CACHE)
        .then(() => event.ports[0]?.postMessage({ ok: true }))
        .catch((error) => event.ports[0]?.postMessage({ ok: false, message: String(error) })),
    );
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
      cacheSafely(STATIC_CACHE, urls)
        .then(() => trimCache(STATIC_CACHE, MAX_STATIC_ENTRIES))
        .then(() => event.ports[0]?.postMessage({ ok: true }))
        .catch((error) => event.ports[0]?.postMessage({ ok: false, message: String(error) })),
    );
  }
});
