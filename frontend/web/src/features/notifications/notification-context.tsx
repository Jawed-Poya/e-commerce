import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type PropsWithChildren,
} from "react";

import { apiUrl, customerTokenKey } from "../../shared/api/api-client";
import { useI18n } from "../../i18n/i18n-provider";
import { useAuth } from "../auth/auth-context";
import { useCart } from "../cart/cart-context";
import {
    getStoreNotifications,
    getStorePushPublicKey,
    saveStorePushSubscription,
    type StoreNotification,
} from "./notification-api";
import {
    addTrackedProduct,
    getTrackedProductIds,
} from "./tracked-products";

const lastCheckKey = "easycart-notifications-last-check";
const seenKey = "easycart-notifications-seen";
const activityKey = "easycart-notifications-activity";
const hubUrl = apiUrl("/hubs/store-notifications");
const reconnectDelays = [2_000, 5_000, 10_000, 30_000] as const;

type RealtimeStatus = "connecting" | "live" | "reconnecting" | "polling";
type BrowserPushStatus =
    | "unsupported"
    | "disabled"
    | "registering"
    | "ready"
    | "error";

type NotificationContextValue = {
    items: StoreNotification[];
    unreadCount: number;
    permission: NotificationPermission | "unsupported";
    browserPushStatus: BrowserPushStatus;
    realtimeStatus: RealtimeStatus;
    liveNotification: StoreNotification | null;
    trackProduct: (productId: number) => void;
    enableBrowserNotifications: () => Promise<boolean>;
    dismissLiveNotification: () => void;
    markRead: (id: number) => void;
    markAllRead: () => void;
    clearAll: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: PropsWithChildren) {
    const cart = useCart();
    const auth = useAuth();
    const { t } = useI18n();
    const [items, setItems] = useState<StoreNotification[]>(readStoredItems);
    const [trackedIds, setTrackedIds] = useState(getTrackedProductIds);
    const [seenIds, setSeenIds] = useState<number[]>(readSeenIds);
    const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
        () => ("Notification" in window ? Notification.permission : "unsupported"),
    );
    const [browserPushStatus, setBrowserPushStatus] = useState<BrowserPushStatus>(
        () => webPushSupported()
            ? Notification.permission === "granted" ? "registering" : "disabled"
            : "unsupported",
    );
    const [realtimeStatus, setRealtimeStatus] =
        useState<RealtimeStatus>("connecting");
    const [liveNotification, setLiveNotification] =
        useState<StoreNotification | null>(null);
    const deliveredIds = useRef(new Set(items.map((item) => item.id)));
    const previousCartLineKeys = useRef<Set<string> | null>(null);
    const localNotificationSequence = useRef(0);
    const lastCheck = useRef(
        localStorage.getItem(lastCheckKey) ?? new Date().toISOString(),
    );

    const showBrowserNotification = useCallback(async (item: StoreNotification) => {
        if (!("Notification" in window) || Notification.permission !== "granted")
            return;

        const options: NotificationOptions = {
            body: item.message,
            icon: "/pwa-192.png",
            badge: "/pwa-192.png",
            tag: `easycart-${item.kind.toLowerCase()}-${item.id}`,
            data: { link: item.link },
        };

        // ServiceWorkerRegistration.showNotification is the reliable path on
        // mobile/PWA browsers. The Notification constructor is kept only as a
        // desktop fallback for browsers without an active service worker.
        if ("serviceWorker" in navigator) {
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    await registration.showNotification(item.title, options);
                    return;
                }
            } catch {
                // Fall through to the desktop Notification API.
            }
        }

        try {
            const browserNotification = new Notification(item.title, options);
            browserNotification.onclick = () => {
                window.focus();
                window.location.assign(item.link);
                browserNotification.close();
            };
        } catch {
            // The in-app notification center still receives the event.
        }
    }, []);

    const receiveNotifications = useCallback(
        (incoming: StoreNotification[]) => {
            if (!incoming.length) return;

            const newItems = incoming.filter((item) => {
                if (deliveredIds.current.has(item.id)) return false;
                deliveredIds.current.add(item.id);
                return true;
            });

            if (!newItems.length) return;
            setItems((current) => {
                const byId = new Map(
                    [...newItems, ...current].map((item) => [item.id, item]),
                );
                return [...byId.values()]
                    .sort(
                        (a, b) =>
                            new Date(b.createdAt).getTime() -
                            new Date(a.createdAt).getTime(),
                    )
                    .slice(0, 30);
            });
            newItems.forEach((item) => void showBrowserNotification(item));
            if (document.visibilityState === "visible") {
                setLiveNotification(newItems[newItems.length - 1]);
            }
        },
        [showBrowserNotification],
    );

    useEffect(() => {
        writeStoredItems(items);
    }, [items]);

    const syncTrackedIds = useCallback(() => {
        const next = getTrackedProductIds();
        setTrackedIds((current) =>
            sameNumberArray(current, next) ? current : next,
        );
    }, []);

    const trackProduct = useCallback((productId: number) => {
        addTrackedProduct(productId);
        syncTrackedIds();
    }, [syncTrackedIds]);

    useEffect(() => {
        [...cart.items.map((item) => item.id), ...cart.wishlist].forEach(
            addTrackedProduct,
        );
        syncTrackedIds();
    }, [cart.items, cart.wishlist, syncTrackedIds]);

    useEffect(() => {
        const nextLineKeys = new Set(cart.items.map((item) => item.lineKey));
        const previous = previousCartLineKeys.current;
        previousCartLineKeys.current = nextLineKeys;

        // Do not notify for cart contents restored from localStorage on startup.
        if (previous === null) return;

        const added = cart.items.filter((item) => !previous.has(item.lineKey));
        if (!added.length) return;

        const now = Date.now();
        receiveNotifications(added.map((item, index) => ({
            id: -(now * 1000 + localNotificationSequence.current++ + index),
            title: t("notifications.cartAddedTitle"),
            message: t("notifications.cartAddedMessage", { product: item.name }),
            kind: "Cart" as const,
            productId: item.id,
            productName: item.name,
            link: "/cart",
            createdAt: new Date().toISOString(),
        })));
    }, [cart.items, receiveNotifications, t]);

    useEffect(() => {
        window.addEventListener("easycart-tracked-products-changed", syncTrackedIds);
        return () =>
            window.removeEventListener("easycart-tracked-products-changed", syncTrackedIds);
    }, [syncTrackedIds]);

    const syncPushSubscription = useCallback(async () => {
        if (!webPushSupported()) {
            setBrowserPushStatus("unsupported");
            return false;
        }
        if (Notification.permission !== "granted") {
            setBrowserPushStatus("disabled");
            return false;
        }

        setBrowserPushStatus("registering");
        try {
            const registration = await getReadyServiceWorkerRegistration();
            if (!registration) {
                setBrowserPushStatus("error");
                return false;
            }

            const { publicKey } = await getStorePushPublicKey();
            const applicationServerKey = urlBase64ToUint8Array(publicKey);
            let subscription = await registration.pushManager.getSubscription();
            if (
                subscription &&
                !sameBytes(subscription.options.applicationServerKey, applicationServerKey)
            ) {
                await subscription.unsubscribe();
                subscription = null;
            }
            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey,
                });
            }

            const json = subscription.toJSON();
            const p256dh = json.keys?.p256dh ?? base64FromBuffer(
                subscription.getKey("p256dh"),
            );
            const authKey = json.keys?.auth ?? base64FromBuffer(
                subscription.getKey("auth"),
            );

            if (!p256dh || !authKey) {
                setBrowserPushStatus("error");
                return false;
            }

            await saveStorePushSubscription({
                endpoint: subscription.endpoint,
                p256dh,
                auth: authKey,
                productIds: trackedIds,
            });
            setBrowserPushStatus("ready");
            return true;
        } catch (error) {
            setBrowserPushStatus("error");
            console.warn("Storefront Web Push subscription could not be synchronized.", error);
            return false;
        }
    }, [trackedIds]);

    const poll = useCallback(async () => {
        if (!trackedIds.length) return;

        try {
            const response = await getStoreNotifications(
                lastCheck.current,
                trackedIds,
            );
            lastCheck.current = response.serverTime;
            localStorage.setItem(lastCheckKey, response.serverTime);
            receiveNotifications(response.items);
        } catch {
            setRealtimeStatus((current) =>
                current === "live" ? current : "polling",
            );
        }
    }, [receiveNotifications, trackedIds]);

    const trackedKey = trackedIds.join(",");
    useEffect(() => {
        if (!trackedIds.length) {
            setRealtimeStatus("polling");
            return;
        }

        let disposed = false;
        let connection: import("@microsoft/signalr").HubConnection | null = null;
        let retryTimer: number | null = null;
        let retryAttempt = 0;
        let reconnectNow: (() => void) | null = null;
        setRealtimeStatus("connecting");

        void import("@microsoft/signalr").then(({ HubConnectionBuilder, HubConnectionState, LogLevel }) => {
            if (disposed) return;
            connection = new HubConnectionBuilder()
                .withUrl(hubUrl, {
                    accessTokenFactory: () =>
                        localStorage.getItem(customerTokenKey) ?? "",
                })
                .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
                .configureLogging(LogLevel.Warning)
                .build();

            connection.on("storeNotification", (item: StoreNotification) => {
                receiveNotifications([item]);
                // Keep the polling cursor based on server time. A customer device clock
                // can be ahead of the API server and must not cause persisted events to be skipped.
            });
            connection.onreconnecting(() => setRealtimeStatus("reconnecting"));
            connection.onreconnected(async () => {
                if (connection?.state === HubConnectionState.Connected) {
                    try {
                        await connection.invoke("Subscribe", trackedIds);
                        retryAttempt = 0;
                        setRealtimeStatus("live");
                        await poll();
                    } catch {
                        setRealtimeStatus("polling");
                        await connection.stop();
                    }
                }
            });
            const connect = async () => {
                if (
                    disposed ||
                    !connection ||
                    connection.state !== HubConnectionState.Disconnected
                ) return;

                setRealtimeStatus(retryAttempt === 0 ? "connecting" : "reconnecting");
                try {
                    await connection.start();
                    if (disposed) {
                        await connection.stop();
                        return;
                    }
                    await connection.invoke("Subscribe", trackedIds);
                    retryAttempt = 0;
                    setRealtimeStatus("live");
                    await poll();
                } catch {
                    if (!disposed) {
                        try {
                            await connection.stop();
                        } finally {
                            scheduleRetry();
                        }
                    }
                }
            };

            function scheduleRetry() {
                if (disposed || retryTimer !== null) return;
                setRealtimeStatus("polling");
                const delay = reconnectDelays[
                    Math.min(retryAttempt, reconnectDelays.length - 1)
                ];
                retryAttempt += 1;
                retryTimer = window.setTimeout(() => {
                    retryTimer = null;
                    void connect();
                }, delay);
            }

            reconnectNow = () => {
                if (disposed || connection?.state !== HubConnectionState.Disconnected)
                    return;
                if (retryTimer !== null) window.clearTimeout(retryTimer);
                retryTimer = null;
                retryAttempt = 0;
                void connect();
            };

            window.addEventListener("online", reconnectNow);
            document.addEventListener("visibilitychange", reconnectNow);
            void connect();

            connection.onclose(() => {
                if (!disposed) scheduleRetry();
            });
        }).catch(() => {
            if (!disposed) setRealtimeStatus("polling");
        });

        return () => {
            disposed = true;
            if (retryTimer !== null) window.clearTimeout(retryTimer);
            if (reconnectNow) {
                window.removeEventListener("online", reconnectNow);
                document.removeEventListener("visibilitychange", reconnectNow);
            }
            void connection?.stop();
        };
        // trackedKey and customer identity intentionally rebuild subscriptions.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auth.user?.userId, auth.user?.customerTypeId, receiveNotifications, trackedKey]);

    useEffect(() => {
        void poll();
        const timer = window.setInterval(() => void poll(), 30_000);
        const refresh = () => {
            if ("Notification" in window) setPermission(Notification.permission);
            void poll();
        };
        const refreshWhenVisible = () => {
            if (document.visibilityState === "visible") refresh();
        };

        window.addEventListener("online", refresh);
        window.addEventListener("focus", refresh);
        document.addEventListener("visibilitychange", refreshWhenVisible);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener("online", refresh);
            window.removeEventListener("focus", refresh);
            document.removeEventListener("visibilitychange", refreshWhenVisible);
        };
    }, [poll]);

    useEffect(() => {
        if (permission !== "granted") return;

        const sync = () => void syncPushSubscription();
        sync();
        window.addEventListener("commerce-pwa-ready", sync);
        return () => window.removeEventListener("commerce-pwa-ready", sync);
    }, [
        auth.user?.customerTypeId,
        auth.user?.userId,
        permission,
        syncPushSubscription,
        trackedKey,
    ]);

    const enableBrowserNotifications = useCallback(async () => {
        if (!webPushSupported()) {
            setBrowserPushStatus("unsupported");
            return false;
        }
        const result = Notification.permission === "default"
            ? await Notification.requestPermission()
            : Notification.permission;
        setPermission(result);
        if (result === "granted") {
            await Promise.all([poll(), syncPushSubscription()]);
        } else {
            setBrowserPushStatus("disabled");
        }
        return result === "granted";
    }, [poll, syncPushSubscription]);

    const markAllRead = useCallback(() => {
        const ids = items.map((item) => item.id);
        localStorage.setItem(seenKey, JSON.stringify(ids));
        setSeenIds(ids);
    }, [items]);

    const markRead = useCallback((id: number) => {
        setSeenIds((current) => {
            if (current.includes(id)) return current;
            const next = [...current, id];
            localStorage.setItem(seenKey, JSON.stringify(next));
            return next;
        });
    }, []);

    const clearAll = useCallback(() => {
        const nextSeenIds = [...new Set([...seenIds, ...items.map((item) => item.id)])];
        localStorage.setItem(seenKey, JSON.stringify(nextSeenIds));
        setSeenIds(nextSeenIds);
        setItems([]);
        setLiveNotification(null);
    }, [items, seenIds]);
    const dismissLiveNotification = useCallback(
        () => setLiveNotification(null),
        [],
    );

    const unreadCount = items.filter((item) => !seenIds.includes(item.id)).length;
    const value = useMemo<NotificationContextValue>(
        () => ({
            items,
            unreadCount,
            permission,
            browserPushStatus,
            realtimeStatus,
            liveNotification,
            trackProduct,
            enableBrowserNotifications,
            dismissLiveNotification,
            markRead,
            markAllRead,
            clearAll,
        }),
        [
            enableBrowserNotifications,
            clearAll,
            browserPushStatus,
            dismissLiveNotification,
            items,
            liveNotification,
            markRead,
            markAllRead,
            permission,
            realtimeStatus,
            trackProduct,
            unreadCount,
        ],
    );

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useStoreNotifications() {
    const value = useContext(NotificationContext);
    if (!value)
        throw new Error(
            "useStoreNotifications must be used inside NotificationProvider.",
        );
    return value;
}

function readSeenIds(): number[] {
    try {
        const value = JSON.parse(localStorage.getItem(seenKey) ?? "[]") as number[];
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

function readStoredItems(): StoreNotification[] {
    try {
        const value = JSON.parse(localStorage.getItem(activityKey) ?? "[]") as unknown;
        if (!Array.isArray(value)) return [];
        return value.filter(isStoreNotification).slice(0, 30);
    } catch {
        return [];
    }
}

function writeStoredItems(items: StoreNotification[]) {
    try {
        localStorage.setItem(activityKey, JSON.stringify(items.slice(0, 30)));
    } catch {
        // The live in-memory inbox remains available when storage is blocked/full.
    }
}

function isStoreNotification(value: unknown): value is StoreNotification {
    if (!value || typeof value !== "object") return false;
    const item = value as Partial<StoreNotification>;
    return typeof item.id === "number" &&
        typeof item.title === "string" &&
        typeof item.message === "string" &&
        (item.kind === "Price" || item.kind === "Stock" || item.kind === "Cart") &&
        typeof item.productId === "number" &&
        typeof item.productName === "string" &&
        typeof item.link === "string" &&
        typeof item.createdAt === "string";
}

function sameNumberArray(left: number[], right: number[]) {
    return left.length === right.length &&
        left.every((value, index) => value === right[index]);
}

function urlBase64ToUint8Array(value: string) {
    const padding = "=".repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = window.atob(base64);
    return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function webPushSupported() {
    return window.isSecureContext &&
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window;
}

async function getReadyServiceWorkerRegistration() {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing?.active) return existing;

    return Promise.race<ServiceWorkerRegistration | null>([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 5_000)),
    ]);
}

function sameBytes(
    current: ArrayBuffer | null,
    expected: Uint8Array<ArrayBuffer>,
) {
    if (!current) return false;
    const left = new Uint8Array(current);
    return left.length === expected.length &&
        left.every((value, index) => value === expected[index]);
}

function base64FromBuffer(buffer: ArrayBuffer | null) {
    if (!buffer) return "";
    let binary = "";
    for (const byte of new Uint8Array(buffer)) {
        binary += String.fromCharCode(byte);
    }
    return window.btoa(binary);
}
