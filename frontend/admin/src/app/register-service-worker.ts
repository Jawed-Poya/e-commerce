const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const pwaDevelopmentEnabled =
    import.meta.env.DEV && import.meta.env.VITE_ENABLE_PWA_DEV === "true";

function canRegisterServiceWorker() {
    return (
        "serviceWorker" in navigator &&
        (window.location.protocol === "https:" ||
            localHosts.has(window.location.hostname))
    );
}

/**
 * Normal Vite development stays free from service-worker caching. Use
 * `npm run dev:pwa` when the offline lifecycle itself needs to be tested.
 */
export async function clearAdminPwaPrivateCaches() {
    if (!("serviceWorker" in navigator)) return;

    const registration = await navigator.serviceWorker.getRegistration();
    await postMessageWithAck(
        navigator.serviceWorker.controller ?? registration?.active ?? null,
        { type: "CLEAR_PRIVATE_CACHES" },
    );
}

export function registerAdminServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    if (import.meta.env.DEV && !pwaDevelopmentEnabled) {
        window.addEventListener("load", () => {
            void clearDevelopmentPwaState();
        });
        return;
    }

    if (!canRegisterServiceWorker()) return;

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
            await warmAdminRouteModules();
        }

        await warmLoadedResources(readyRegistration);
        window.dispatchEvent(new CustomEvent("commerce-pwa-ready"));
    } catch (error) {
        console.warn("Admin PWA registration failed.", error);
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
                        new URL(registration.scope).origin ===
                        window.location.origin,
                )
                .map((registration) => registration.unregister()),
        );

        if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(
                keys
                    .filter(
                        (key) =>
                            key.startsWith("commerce-admin-") ||
                            key.startsWith("pharmacy-admin-") ||
                            key.startsWith("admin-"),
                    )
                    .map((key) => caches.delete(key)),
            );
        }

        const reloadKey = "admin-pwa-dev-reset";
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
            "Could not clear the stale admin development PWA state.",
            error,
        );
    }
}

async function warmAdminRouteModules() {
    await Promise.allSettled([
        import("@/pages/dashboard"),
        import("@/pages/products"),
        import("@/features/products/components/product-editor-page"),
        import("@/features/products/components/product-bulk-create-page"),
        import("@/pages/product-details"),
        import("@/pages/reviews"),
        import("@/features/inventory/components/inventory-page"),
        import("@/pages/operations-dashboard"),
        import("@/pages/purchases"),
        import("@/pages/manual-sales"),
        import("@/pages/staff"),
        import("@/pages/expenses"),
        import("@/features/orders/pages/orders-page"),
        import("@/features/orders/pages/order-details-page"),
        import("@/pages/customers"),
        import("@/pages/customer-details"),
        import("@/pages/profile"),
        import("@/pages/company-settings"),
        import("@/features/finance/pages/financial-reports-page"),
        import("@/pages/trash"),
        import("@/features/audit/audit-page"),
        import("@/pages/general-types"),
        import("@/pages/storefront-content"),
        import("@/pages/users"),
        import("@/pages/roles"),
        import("@/pages/not-found"),
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
