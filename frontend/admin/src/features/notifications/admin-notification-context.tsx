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
import { toast } from "sonner";

import { apiBaseUrl } from "@/api/axios";
import { useAdminAuth } from "@/features/auth/auth-context";
import { getAdminToken } from "@/features/auth/auth-storage";
import { hasPermission, Permissions } from "@/features/auth/permissions";
import { adminNotificationService } from "./admin-notification-service";
import type { AdminNotification } from "./admin-notification-types";

const seenKey = "easycart-admin-notifications-seen";
const lastCheckKey = "easycart-admin-notifications-last-check";
const streamUrl = `${apiBaseUrl}/admin/notifications/stream`;

type RealtimeStatus = "connecting" | "live" | "reconnecting" | "polling";

type AdminNotificationContextValue = {
    items: AdminNotification[];
    unreadCount: number;
    realtimeStatus: RealtimeStatus;
    markAllRead: () => void;
    refresh: () => Promise<void>;
};

const AdminNotificationContext =
    createContext<AdminNotificationContextValue | null>(null);

export function AdminNotificationProvider({ children }: PropsWithChildren) {
    const auth = useAdminAuth();
    const [items, setItems] = useState<AdminNotification[]>([]);
    const [seenIds, setSeenIds] = useState<number[]>(readSeenIds);
    const [realtimeStatus, setRealtimeStatus] =
        useState<RealtimeStatus>("connecting");
    const deliveredIds = useRef(new Set<number>());
    const hydrated = useRef(false);
    const lastCheck = useRef(
        localStorage.getItem(lastCheckKey) ??
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    );

    const enabled =
        auth.isAuthenticated &&
        hasPermission(auth.user, Permissions.OrdersView);

    const receive = useCallback((
        incoming: AdminNotification[],
        announce = true,
    ) => {
        const fresh = incoming.filter((item) => {
            if (deliveredIds.current.has(item.id)) return false;
            deliveredIds.current.add(item.id);
            return true;
        });
        if (!fresh.length) return;

        setItems((current) => {
            const byId = new Map(
                [...fresh, ...current].map((item) => [item.id, item]),
            );
            return [...byId.values()]
                .sort(
                    (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime(),
                )
                .slice(0, 50);
        });

        if (!announce) return;
        fresh.forEach((item) =>
            toast(item.title, {
                description: item.message,
                action: {
                    label: "Open",
                    onClick: () => window.location.assign(item.link),
                },
            }),
        );
    }, []);

    const refresh = useCallback(async () => {
        if (!enabled) return;
        try {
            const response = await adminNotificationService.get(
                hydrated.current ? lastCheck.current : undefined,
            );
            lastCheck.current = response.serverTime;
            localStorage.setItem(lastCheckKey, response.serverTime);
            const announce = hydrated.current;
            receive(response.items, announce);
            hydrated.current = true;
        } catch {
            setRealtimeStatus((current) =>
                current === "live" ? current : "polling",
            );
        }
    }, [enabled, receive]);

    useEffect(() => {
        if (!enabled) {
            setItems([]);
            deliveredIds.current.clear();
            hydrated.current = false;
            setRealtimeStatus("polling");
            return;
        }

        const controller = new AbortController();
        let disposed = false;

        const connect = async () => {
            let retryDelay = 1_000;
            while (!disposed) {
                const token = getAdminToken();
                if (!token) return;

                setRealtimeStatus(
                    retryDelay === 1_000 ? "connecting" : "reconnecting",
                );

                try {
                    const response = await fetch(streamUrl, {
                        headers: { Authorization: `Bearer ${token}` },
                        signal: controller.signal,
                    });
                    if (!response.ok || !response.body)
                        throw new Error("Notification stream unavailable.");

                    setRealtimeStatus("live");
                    retryDelay = 1_000;
                    const reader = response.body
                        .pipeThrough(new TextDecoderStream())
                        .getReader();
                    let buffer = "";

                    while (!disposed) {
                        const { value, done } = await reader.read();
                        if (done) break;
                        buffer += value;
                        const events = buffer.split("\n\n");
                        buffer = events.pop() ?? "";

                        events.forEach((event) => {
                            const data = event
                                .split("\n")
                                .find((line) => line.startsWith("data: "))
                                ?.slice(6);
                            if (!data) return;
                            try {
                                receive([JSON.parse(data) as AdminNotification]);
                            } catch {
                                // Ignore malformed stream frames and keep listening.
                            }
                        });
                    }
                } catch {
                    if (disposed || controller.signal.aborted) return;
                    setRealtimeStatus("polling");
                    await new Promise((resolve) =>
                        window.setTimeout(resolve, retryDelay),
                    );
                    retryDelay = Math.min(retryDelay * 2, 30_000);
                }
            }
        };

        void connect();
        return () => {
            disposed = true;
            controller.abort();
        };
    }, [auth.user?.userId, enabled, receive]);

    useEffect(() => {
        if (!enabled) return;
        void refresh();
        const timer = window.setInterval(() => void refresh(), 60_000);
        return () => window.clearInterval(timer);
    }, [enabled, refresh]);

    const markAllRead = useCallback(() => {
        const ids = items.map((item) => item.id);
        localStorage.setItem(seenKey, JSON.stringify(ids));
        setSeenIds(ids);
    }, [items]);

    const unreadCount = items.filter(
        (item) => !seenIds.includes(item.id),
    ).length;
    const value = useMemo<AdminNotificationContextValue>(
        () => ({
            items,
            unreadCount,
            realtimeStatus,
            markAllRead,
            refresh,
        }),
        [items, markAllRead, realtimeStatus, refresh, unreadCount],
    );

    return (
        <AdminNotificationContext.Provider value={value}>
            {children}
        </AdminNotificationContext.Provider>
    );
}

export function useAdminNotifications() {
    const value = useContext(AdminNotificationContext);
    if (!value)
        throw new Error(
            "useAdminNotifications must be used inside AdminNotificationProvider.",
        );
    return value;
}

function readSeenIds(): number[] {
    try {
        const value = JSON.parse(localStorage.getItem(seenKey) ?? "[]");
        return Array.isArray(value)
            ? value.filter((item): item is number => typeof item === "number")
            : [];
    } catch {
        return [];
    }
}
