import {
    HubConnectionBuilder,
    HubConnectionState,
    LogLevel,
} from "@microsoft/signalr";
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

import { apiOrigin, customerTokenKey } from "../../shared/api/api-client";
import { useAuth } from "../auth/auth-context";
import { useCart } from "../cart/cart-context";
import {
    getStoreNotifications,
    type StoreNotification,
} from "./notification-api";
import {
    addTrackedProduct,
    getTrackedProductIds,
} from "./tracked-products";

const lastCheckKey = "easycart-notifications-last-check";
const seenKey = "easycart-notifications-seen";
const hubUrl = `${apiOrigin}/hubs/store-notifications`;

type RealtimeStatus = "connecting" | "live" | "reconnecting" | "polling";

type NotificationContextValue = {
    items: StoreNotification[];
    unreadCount: number;
    permission: NotificationPermission | "unsupported";
    realtimeStatus: RealtimeStatus;
    trackProduct: (productId: number) => void;
    enableBrowserNotifications: () => Promise<boolean>;
    markAllRead: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: PropsWithChildren) {
    const cart = useCart();
    const auth = useAuth();
    const [items, setItems] = useState<StoreNotification[]>([]);
    const [trackedIds, setTrackedIds] = useState(getTrackedProductIds);
    const [seenIds, setSeenIds] = useState<number[]>(readSeenIds);
    const [realtimeStatus, setRealtimeStatus] =
        useState<RealtimeStatus>("connecting");
    const deliveredIds = useRef(new Set<number>());
    const lastCheck = useRef(
        localStorage.getItem(lastCheckKey) ?? new Date().toISOString(),
    );

    const permission: NotificationPermission | "unsupported" =
        "Notification" in window ? Notification.permission : "unsupported";

    const showBrowserNotification = useCallback((item: StoreNotification) => {
        if (!("Notification" in window) || Notification.permission !== "granted")
            return;

        const browserNotification = new Notification(item.title, {
            body: item.message,
            icon: "/favicon.svg",
            tag: `easycart-${item.id}`,
        });
        browserNotification.onclick = () => {
            window.focus();
            window.location.assign(item.link);
            browserNotification.close();
        };
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
            newItems.forEach(showBrowserNotification);
        },
        [showBrowserNotification],
    );

    const trackProduct = useCallback((productId: number) => {
        addTrackedProduct(productId);
        setTrackedIds(getTrackedProductIds());
    }, []);

    useEffect(() => {
        [...cart.items.map((item) => item.id), ...cart.wishlist].forEach(
            addTrackedProduct,
        );
        setTrackedIds(getTrackedProductIds());
    }, [cart.items, cart.wishlist]);

    useEffect(() => {
        const sync = () => setTrackedIds(getTrackedProductIds());
        window.addEventListener("easycart-tracked-products-changed", sync);
        return () =>
            window.removeEventListener("easycart-tracked-products-changed", sync);
    }, []);

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
        const connection = new HubConnectionBuilder()
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
            if (connection.state === HubConnectionState.Connected) {
                await connection.invoke("Subscribe", trackedIds);
                setRealtimeStatus("live");
                await poll();
            }
        });
        connection.onclose(() => {
            if (!disposed) setRealtimeStatus("polling");
        });

        const connect = async () => {
            setRealtimeStatus("connecting");
            try {
                await connection.start();
                if (disposed) return;
                await connection.invoke("Subscribe", trackedIds);
                setRealtimeStatus("live");
            } catch {
                if (!disposed) setRealtimeStatus("polling");
            }
        };

        void connect();
        return () => {
            disposed = true;
            void connection.stop();
        };
        // trackedKey and customer identity intentionally rebuild subscriptions.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auth.user?.userId, auth.user?.customerTypeId, receiveNotifications, trackedKey]);

    useEffect(() => {
        void poll();
        const timer = window.setInterval(() => void poll(), 60_000);
        return () => window.clearInterval(timer);
    }, [poll]);

    const enableBrowserNotifications = useCallback(async () => {
        if (!("Notification" in window)) return false;
        const result = await Notification.requestPermission();
        if (result === "granted") await poll();
        return result === "granted";
    }, [poll]);

    const markAllRead = useCallback(() => {
        const ids = items.map((item) => item.id);
        localStorage.setItem(seenKey, JSON.stringify(ids));
        setSeenIds(ids);
    }, [items]);

    const unreadCount = items.filter((item) => !seenIds.includes(item.id)).length;
    const value = useMemo<NotificationContextValue>(
        () => ({
            items,
            unreadCount,
            permission,
            realtimeStatus,
            trackProduct,
            enableBrowserNotifications,
            markAllRead,
        }),
        [
            enableBrowserNotifications,
            items,
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
