const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const pwaDevelopmentEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_PWA_DEV === "true";

export async function clearStorefrontPwaPrivateCaches() {
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.getRegistration();
  await postMessageWithAck(
    navigator.serviceWorker.controller ?? registration?.active ?? null,
    { type: "CLEAR_PRIVATE_CACHES" },
  );
}

export function registerStorefrontServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  if (import.meta.env.DEV && !pwaDevelopmentEnabled) {
    window.addEventListener("load", () => {
      void clearDevelopmentPwaState();
    });
    return;
  }

  if (
    window.location.protocol !== "https:" &&
    !localHosts.has(window.location.hostname)
  ) {
    return;
  }

  window.addEventListener("load", () => {
    void installServiceWorker();
  });
}

async function installServiceWorker() {
  const hadController = navigator.serviceWorker.controller !== null;

  try {
    const registration = await navigator.serviceWorker.register(
      "/service-worker.js",
      { updateViaCache: "none" },
    );

    configureAutomaticUpdates(registration, hadController);
    const readyRegistration = await navigator.serviceWorker.ready;
    await registration.update();

    if (pwaDevelopmentEnabled) {
      await warmStorefrontRouteModules();
    }

    await warmLoadedResources(readyRegistration);
    window.dispatchEvent(new CustomEvent("pharmadb-pwa-ready"));
  } catch (error) {
    console.warn("Storefront PWA registration failed.", error);
  }
}

function configureAutomaticUpdates(
  registration: ServiceWorkerRegistration,
  hadController: boolean,
) {
  let reloading = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;

    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        worker.postMessage({ type: "SKIP_WAITING" });
      }
    });
  });

  const update = () => void registration.update();
  window.addEventListener("online", update);
  window.setInterval(update, 60 * 60_000);
}

async function clearDevelopmentPwaState() {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const removed = await Promise.all(
      registrations
        .filter(
          (registration) =>
            new URL(registration.scope).origin === window.location.origin,
        )
        .map((registration) => registration.unregister()),
    );

    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("pharmadb-storefront-") ||
              key.startsWith("pharmacy-store-") ||
              key.startsWith("storefront-"),
          )
          .map((key) => caches.delete(key)),
      );
    }

    const reloadKey = "storefront-pwa-dev-reset";
    const mustReleaseController =
      navigator.serviceWorker.controller !== null || removed.some(Boolean);
    if (
      mustReleaseController &&
      sessionStorage.getItem(reloadKey) !== "done"
    ) {
      sessionStorage.setItem(reloadKey, "done");
      window.location.reload();
      return;
    }
    sessionStorage.removeItem(reloadKey);
  } catch (error) {
    console.warn(
      "Could not clear the stale storefront development PWA state.",
      error,
    );
  }
}

async function warmStorefrontRouteModules() {
  await Promise.allSettled([
    import("../features/home/home-page"),
    import("../features/catalog/catalog-page"),
    import("../features/products/product-page"),
    import("../features/cart/cart-page"),
    import("../features/cart/wishlist-page"),
    import("../features/checkout/checkout-page"),
    import("../features/orders/order-success-page"),
    import("../features/orders/order-tracking-page"),
    import("../features/auth/auth-page"),
    import("../features/account/account-page"),
    import("../shared/components/not-found-page"),
  ]);
}

async function warmLoadedResources(registration: ServiceWorkerRegistration) {
  const urls = new Set<string>([
    "/",
    "/index.html",
    window.location.pathname,
  ]);
  for (const entry of performance.getEntriesByType("resource")) {
    const resource = new URL(entry.name, window.location.origin);
    if (resource.origin !== window.location.origin) continue;
    if (
      resource.pathname.startsWith("/api/") ||
      resource.pathname.startsWith("/hubs/")
    ) {
      continue;
    }
    urls.add(`${resource.pathname}${resource.search}`);
  }

  await postMessageWithAck(registration.active, {
    type: "CACHE_URLS",
    urls: Array.from(urls),
  });
}

function postMessageWithAck(worker: ServiceWorker | null, message: unknown) {
  if (!worker) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(resolve, 10_000);
    channel.port1.onmessage = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    worker.postMessage(message, [channel.port2]);
  });
}
