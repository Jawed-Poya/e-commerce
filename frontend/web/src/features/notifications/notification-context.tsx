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

type NotificationContextValue = {
    items: StoreNotification[];
    unreadCount: number;
    permission: NotificationPermission | "unsupported";
    trackProduct: (productId: number) => void;
    enableBrowserNotifications: () => Promise<boolean>;
    markAllRead: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: PropsWithChildren) {
    const cart = useCart();
    const [items, setItems] = useState<StoreNotification[]>([]);
    const [trackedIds, setTrackedIds] = useState(getTrackedProductIds);
    const [seenIds, setSeenIds] = useState<number[]>(readSeenIds);
    const lastCheck = useRef(
        localStorage.getItem(lastCheckKey) ?? new Date().toISOString(),
    );

    const permission: NotificationPermission | "unsupported" =
        "Notification" in window ? Notification.permission : "unsupported";

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

            if (!response.items.length) return;

            setItems((current) => {
                const byId = new Map(
                    [...response.items, ...current].map((item) => [item.id, item]),
                );
                return [...byId.values()]
                    .sort(
                        (a, b) =>
                            new Date(b.createdAt).getTime() -
                            new Date(a.createdAt).getTime(),
                    )
                    .slice(0, 30);
            });

            if ("Notification" in window && Notification.permission === "granted") {
                response.items.forEach((item) => {
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
                });
            }
        } catch {
            // Store alerts are non-critical. The next poll retries automatically.
        }
    }, [trackedIds]);

    useEffect(() => {
        void poll();
        const timer = window.setInterval(() => void poll(), 30_000);
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
            trackProduct,
            enableBrowserNotifications,
            markAllRead,
        }),
        [
            enableBrowserNotifications,
            items,
            markAllRead,
            permission,
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
