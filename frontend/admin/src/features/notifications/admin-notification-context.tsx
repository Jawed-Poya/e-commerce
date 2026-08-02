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
import { useCompany } from "@/features/company/company-context";
import { useI18n } from "@/i18n/i18n-provider";
import { adminNotificationService } from "./admin-notification-service";
import { armExpiryAlertSound, playExpiryAlertSound } from "./expiry-alert-sounds";
import type { AdminNotification } from "./admin-notification-types";

const seenKey = "easycart-admin-notifications-seen";
const lastCheckKey = "easycart-admin-notifications-last-check";
const streamUrl = `${apiBaseUrl}/admin/notifications/stream`;

type RealtimeStatus = "connecting" | "live" | "reconnecting" | "polling";

type AdminNotificationContextValue = {
    items: AdminNotification[];
    unreadCount: number;
    canManage: boolean;
    realtimeStatus: RealtimeStatus;
    markAllRead: () => void;
    remove: (id: number) => Promise<void>;
    clear: () => Promise<void>;
    refresh: () => Promise<void>;
};

const AdminNotificationContext =
    createContext<AdminNotificationContextValue | null>(null);

export function AdminNotificationProvider({ children }: PropsWithChildren) {
    const auth = useAdminAuth();
    const { company, loading: companyLoading } = useCompany();
    const { t } = useI18n();
    const [items, setItems] = useState<AdminNotification[]>([]);
    const [seenIds, setSeenIds] = useState<number[]>(readSeenIds);
    const seenIdsRef = useRef(new Set(seenIds));
    const [realtimeStatus, setRealtimeStatus] =
        useState<RealtimeStatus>("connecting");
    const deliveredIds = useRef(new Set<number>());
    const pendingExpiryAlerts = useRef<AdminNotification[]>([]);
    const expiryAnnouncementTimer = useRef<number | null>(null);
    const hydrated = useRef(false);
    const lastCheck = useRef(
        localStorage.getItem(lastCheckKey) ??
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    );

    const enabled =
        auth.isAuthenticated &&
        !companyLoading &&
        (hasPermission(auth.user, Permissions.OrdersView) ||
            hasPermission(auth.user, Permissions.InventoryView) ||
            hasPermission(auth.user, Permissions.ReviewsView));
    const canManage = hasPermission(auth.user, Permissions.NotificationsManage);
    const expiryAlertsEnabled = company?.settings.expiryAlertsEnabled !== false;

    useEffect(() => {
        seenIdsRef.current = new Set(seenIds);
    }, [seenIds]);

    useEffect(() => {
        if (
            !company?.settings.expiryAlertsEnabled ||
            !company.settings.expiryAlertSoundEnabled
        ) return;
        return armExpiryAlertSound(company.settings.expiryAlertSound);
    }, [
        company?.settings.expiryAlertsEnabled,
        company?.settings.expiryAlertSound,
        company?.settings.expiryAlertSoundEnabled,
    ]);

    useEffect(() => {
        if (company?.settings.expiryAlertsEnabled !== false) return;

        pendingExpiryAlerts.current = [];
        if (expiryAnnouncementTimer.current !== null) {
            window.clearTimeout(expiryAnnouncementTimer.current);
            expiryAnnouncementTimer.current = null;
        }
        setItems((current) => current.filter((item) => item.kind !== "Expiry"));
    }, [company?.settings.expiryAlertsEnabled]);

    const announcePendingExpiryAlerts = useCallback(() => {
        expiryAnnouncementTimer.current = null;
        const expiryAlerts = pendingExpiryAlerts.current.filter(
            (item) => !seenIdsRef.current.has(item.id),
        );
        pendingExpiryAlerts.current = [];
        if (!expiryAlerts.length || company?.settings.expiryAlertsEnabled === false)
            return;

        const first = expiryAlerts[0];
        const count = expiryAlerts.length;
        const title = count === 1
            ? first.title
            : t("notifications.expiryBatchTitle").replace("{count}", String(count));
        const description = count === 1
            ? first.message
            : t("notifications.expiryBatchDescription").replace("{count}", String(count));

        if (
            company?.settings.expiryAlertsEnabled &&
            company.settings.expiryAlertSoundEnabled
        ) {
            void playExpiryAlertSound(company.settings.expiryAlertSound).catch(() => {
                // Browsers can block automatic audio until the first user interaction.
            });
        }

        toast.warning(title, {
            description,
            duration: 15_000,
            action: {
                label: t("notifications.openInventory"),
                onClick: () => window.location.assign(first.link),
            },
        });
    }, [
        company?.settings.expiryAlertSound,
        company?.settings.expiryAlertSoundEnabled,
        company?.settings.expiryAlertsEnabled,
        t,
    ]);

    const queueExpiryAnnouncement = useCallback((alerts: AdminNotification[]) => {
        if (company?.settings.expiryAlertsEnabled === false || !alerts.length)
            return;

        pendingExpiryAlerts.current.push(...alerts);
        if (expiryAnnouncementTimer.current !== null) return;

        expiryAnnouncementTimer.current = window.setTimeout(
            announcePendingExpiryAlerts,
            750,
        );
    }, [announcePendingExpiryAlerts, company?.settings.expiryAlertsEnabled]);

    useEffect(() => () => {
        if (expiryAnnouncementTimer.current !== null)
            window.clearTimeout(expiryAnnouncementTimer.current);
    }, []);

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

        const visibleFresh = expiryAlertsEnabled
            ? fresh
            : fresh.filter((item) => item.kind !== "Expiry");
        if (!visibleFresh.length) return;

        setItems((current) => {
            const byId = new Map(
                [...visibleFresh, ...current].map((item) => [item.id, item]),
            );
            return [...byId.values()]
                .sort(
                    (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime(),
                )
                .slice(0, 50);
        });

        const expiryAlerts = visibleFresh.filter(
            (item) => item.kind === "Expiry" && !seenIdsRef.current.has(item.id),
        );
        queueExpiryAnnouncement(expiryAlerts);

        if (!announce) return;
        visibleFresh
            .filter((item) => item.kind !== "Expiry")
            .forEach((item) =>
                toast(item.title, {
                    description: item.message,
                    action: {
                        label: t("notifications.open"),
                        onClick: () => window.location.assign(item.link),
                    },
                }),
            );
    }, [expiryAlertsEnabled, queueExpiryAnnouncement, t]);

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
            pendingExpiryAlerts.current = [];
            if (expiryAnnouncementTimer.current !== null) {
                window.clearTimeout(expiryAnnouncementTimer.current);
                expiryAnnouncementTimer.current = null;
            }
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
        seenIdsRef.current = new Set(ids);
        setSeenIds(ids);
    }, [items]);

    const remove = useCallback(async (id: number) => {
        await adminNotificationService.delete(id);
        setItems((current) => current.filter((item) => item.id !== id));
        deliveredIds.current.delete(id);
        setSeenIds((current) => {
            const next = current.filter((item) => item !== id);
            localStorage.setItem(seenKey, JSON.stringify(next));
            seenIdsRef.current = new Set(next);
            return next;
        });
    }, []);

    const clear = useCallback(async () => {
        await adminNotificationService.clear();
        setItems([]);
        deliveredIds.current.clear();
        pendingExpiryAlerts.current = [];
        setSeenIds([]);
        seenIdsRef.current = new Set();
        localStorage.setItem(seenKey, "[]");
    }, []);

    const unreadCount = items.filter(
        (item) => !seenIds.includes(item.id),
    ).length;
    const value = useMemo<AdminNotificationContextValue>(
        () => ({
            items,
            unreadCount,
            canManage,
            realtimeStatus,
            markAllRead,
            remove,
            clear,
            refresh,
        }),
        [canManage, clear, items, markAllRead, realtimeStatus, refresh, remove, unreadCount],
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
