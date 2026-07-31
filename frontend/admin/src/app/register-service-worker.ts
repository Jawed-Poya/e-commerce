const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

function canRegisterServiceWorker() {
    return (
        "serviceWorker" in navigator &&
        (window.location.protocol === "https:" || localHosts.has(window.location.hostname))
    );
}

/**
 * Vite development modules must never be controlled by the production PWA
 * worker. A stale development registration keeps retrying localhost assets
 * after the dev server stops and produces ERR_CONNECTION_REFUSED noise.
 */
export function registerAdminServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    if (import.meta.env.DEV) {
        window.addEventListener("load", () => {
            void clearDevelopmentPwaState();
        });
        return;
    }

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

async function clearDevelopmentPwaState() {
    try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        const removed = await Promise.all(
            registrations
                .filter((registration) => new URL(registration.scope).origin === window.location.origin)
                .map((registration) => registration.unregister()),
        );

        if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));
        }

        const reloadKey = "admin-pwa-dev-reset";
        const mustReleaseController = navigator.serviceWorker.controller !== null || removed.some(Boolean);
        if (mustReleaseController && sessionStorage.getItem(reloadKey) !== "done") {
            sessionStorage.setItem(reloadKey, "done");
            window.location.reload();
            return;
        }
        sessionStorage.removeItem(reloadKey);
    } catch (error) {
        console.warn("Could not clear the stale admin development PWA state.", error);
    }
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
