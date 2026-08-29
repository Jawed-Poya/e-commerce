import { PackageOpen, ShoppingBag, Tag, X } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";

import { useI18n } from "../../i18n/i18n-provider";
import { cn } from "../../shared/lib/utils";
import { useStoreNotifications } from "./notification-context";

export function LiveNotificationBanner() {
    const notifications = useStoreNotifications();
    const { t } = useI18n();
    const item = notifications.liveNotification;

    useEffect(() => {
        if (!item) return;
        const timer = window.setTimeout(
            notifications.dismissLiveNotification,
            7_000,
        );
        return () => window.clearTimeout(timer);
    }, [item, notifications.dismissLiveNotification]);

    if (!item) return null;

    const Icon = item.kind === "Stock"
        ? PackageOpen
        : item.kind === "Cart" ? ShoppingBag : Tag;

    return (
        <aside
            className="fixed inset-x-3 top-3 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-primary/35 bg-popover/95 p-3 text-popover-foreground shadow-2xl shadow-slate-950/20 backdrop-blur-xl sm:inset-x-auto sm:end-5 sm:top-5 sm:w-[390px]"
            role="status"
            aria-live="polite"
        >
            <Link
                viewTransition
                to={item.link}
                onClick={() => {
                    notifications.markRead(item.id);
                    notifications.dismissLiveNotification();
                }}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
                <span
                    className={cn(
                        "grid size-11 shrink-0 place-items-center rounded-xl text-white shadow-sm",
                        item.kind === "Stock"
                            ? "bg-emerald-600"
                            : item.kind === "Cart" ? "bg-brand-orange" : "bg-primary",
                    )}
                >
                    <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                        <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
                            {t("notifications.live")}
                        </span>
                        <span className="truncate text-sm font-black">
                            {item.title}
                        </span>
                    </span>
                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                        {item.message}
                    </span>
                </span>
            </Link>
            <button
                type="button"
                onClick={notifications.dismissLiveNotification}
                className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={t("common.close")}
            >
                <X className="size-4" />
            </button>
        </aside>
    );
}
