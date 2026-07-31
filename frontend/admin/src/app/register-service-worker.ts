const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

function canRegisterServiceWorker() {
    return (
        "serviceWorker" in navigator &&
        (window.location.protocol === "https:" || localHosts.has(window.location.hostname))
    );
}

/**
 * Registers in development too. The worker uses network-first caching for Vite
 * modules, so live code is never hidden by stale cache while already-loaded
 * admin routes remain available if the frontend process stops.
 */
export function registerAdminServiceWorker() {
    if (!canRegisterServiceWorker()) return;

    window.addEventListener("load", () => {
        void navigator.serviceWorker
            .register("/service-worker.js", { updateViaCache: "none" })
            .then(async (registration) => {
                const readyRegistration = await navigator.serviceWorker.ready;
                void registration.update();
                await warmLoadedResources(readyRegistration);
                scheduleCriticalRoutePreload(readyRegistration);
            })
            .catch((error) => {
                console.warn("Admin PWA registration failed.", error);
            });
    });
}

function scheduleCriticalRoutePreload(registration: ServiceWorkerRegistration) {
    const preload = async () => {
        await Promise.allSettled([
            import("@/pages/purchases"),
            import("@/pages/manual-sales"),
            import("@/pages/products"),
            import("@/features/orders/pages/orders-page"),
            import("@/features/orders/pages/order-details-page"),
        ]);
        await warmLoadedResources(registration);
    };

    const requestIdleCallback = (
        window as Window & {
            requestIdleCallback?: (
                callback: () => void | Promise<void>,
                options?: { timeout?: number },
            ) => number;
        }
    ).requestIdleCallback;

    if (typeof requestIdleCallback === "function") {
        requestIdleCallback(preload, { timeout: 5_000 });
        return;
    }

    window.setTimeout(preload, 1_500);
}


async function warmLoadedResources(registration: ServiceWorkerRegistration) {
    const urls = new Set<string>(["/", "/index.html", window.location.pathname]);
    for (const entry of performance.getEntriesByType("resource")) {
        const resource = new URL(entry.name, window.location.origin);
        if (resource.origin !== window.location.origin) continue;
        if (resource.pathname.startsWith("/api/") || resource.pathname.startsWith("/hubs/")) continue;
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
