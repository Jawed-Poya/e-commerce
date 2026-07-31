const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function registerStorefrontServiceWorker() {
  if (
    !("serviceWorker" in navigator) ||
    (window.location.protocol !== "https:" && !localHosts.has(window.location.hostname))
  ) return;

  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register("/service-worker.js", { updateViaCache: "none" })
      .then(async (registration) => {
        const readyRegistration = await navigator.serviceWorker.ready;
        void registration.update();
        await warmLoadedResources(readyRegistration);
      })
      .catch((error) => console.warn("Storefront PWA registration failed.", error));
  });
}


async function warmLoadedResources(registration: ServiceWorkerRegistration) {
  const urls = new Set<string>(["/", "/index.html", window.location.pathname]);
  for (const entry of performance.getEntriesByType("resource")) {
    const resource = new URL(entry.name, window.location.origin);
    if (resource.origin !== window.location.origin) continue;
    if (resource.pathname.startsWith("/api/") || resource.pathname.startsWith("/hubs/")) continue;
    urls.add(`${resource.pathname}${resource.search}`);
  }

  await postMessageWithAck(registration.active, { type: "CACHE_URLS", urls: Array.from(urls) });
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
