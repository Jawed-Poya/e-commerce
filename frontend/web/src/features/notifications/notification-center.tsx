import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell, BellRing, CheckCheck, CircleAlert, LoaderCircle, PackageOpen, RotateCw, ShoppingBag, Tag, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

import { Button } from "../../shared/components/ui/button";
import { cn } from "../../shared/lib/utils";
import { useStoreNotifications } from "./notification-context";
import { useI18n } from "../../i18n/i18n-provider";
import { useCompany } from "../company/company-context";

export function NotificationCenter() {
    const notifications = useStoreNotifications();
    const { company } = useCompany();
    const { language, t } = useI18n();
    const [confirmClear, setConfirmClear] = useState(false);
    const locale = language === "en" ? "en-US" : "fa-AF";

    const clearNotifications = () => {
        if (!confirmClear) {
            setConfirmClear(true);
            return;
        }
        notifications.clearAll();
        setConfirmClear(false);
    };

    return (
        <DropdownMenu.Root onOpenChange={(open) => !open && setConfirmClear(false)}>
            <DropdownMenu.Trigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    aria-label={t("notifications.title")}
                >
                    {notifications.unreadCount ? (
                        <BellRing className="size-5" />
                    ) : (
                        <Bell className="size-5" />
                    )}
                    {notifications.unreadCount > 0 && (
                        <span className="absolute -right-1 -top-1 grid min-w-4.5 place-items-center rounded-full border-2 border-background bg-brand-orange px-1 text-[9px] font-bold leading-4 text-white">
                            {notifications.unreadCount > 9
                                ? "9+"
                                : notifications.unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    align="end"
                    sideOffset={10}
                    className="z-50 w-[min(92vw,390px)] overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl"
                >
                    <div className="flex items-center justify-between border-b p-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="font-black">{t("notifications.title")}</p>
                                <span className={`size-2 rounded-full ${notifications.realtimeStatus === "live" ? "bg-emerald-500" : "bg-amber-500"}`} />
                                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                    {notifications.realtimeStatus === "live" ? t("notifications.live") : t("notifications.fallback")}
                                </span>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                {t("notifications.description")}
                            </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                            {notifications.unreadCount > 0 ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 rounded-lg px-2 text-[10px] font-bold"
                                    onClick={notifications.markAllRead}
                                    title={t("notifications.markRead")}
                                >
                                    <CheckCheck className="size-3.5" />
                                    <span className="hidden sm:inline">{t("notifications.markRead")}</span>
                                </Button>
                            ) : null}
                            {notifications.items.length > 0 ? (
                                <Button
                                    variant={confirmClear ? "destructive" : "ghost"}
                                    size="sm"
                                    className="h-8 rounded-lg px-2 text-[10px] font-bold"
                                    onClick={clearNotifications}
                                    title={t(confirmClear ? "notifications.clearConfirm" : "notifications.clear")}
                                >
                                    <Trash2 className="size-3.5" />
                                    <span>{t(confirmClear ? "notifications.clearConfirm" : "notifications.clear")}</span>
                                </Button>
                            ) : null}
                        </div>
                    </div>

                    {notifications.permission === "default" && (
                        <div className="border-b bg-primary/5 p-4">
                            <p className="text-xs leading-5 text-muted-foreground">
                                {t("notifications.enableDescription", { company: company?.name ?? "" })}
                            </p>
                            <Button
                                size="sm"
                                className="mt-3 rounded-lg"
                                onClick={() =>
                                    void notifications.enableBrowserNotifications()
                                }
                            >
                                <BellRing /> {t("notifications.enable")}
                            </Button>
                        </div>
                    )}

                    {notifications.permission === "denied" && (
                        <div className="flex items-start gap-3 border-b bg-amber-500/10 p-4 text-amber-800 dark:text-amber-300">
                            <CircleAlert className="mt-0.5 size-4 shrink-0" />
                            <p className="text-xs leading-5">
                                {t("notifications.blocked")}
                            </p>
                        </div>
                    )}

                    {notifications.permission === "granted" &&
                    notifications.browserPushStatus === "registering" && (
                        <div className="flex items-center gap-3 border-b bg-primary/5 p-4">
                            <LoaderCircle className="size-4 animate-spin text-primary" />
                            <p className="text-xs text-muted-foreground">
                                {t("notifications.pushConnecting")}
                            </p>
                        </div>
                    )}

                    {notifications.permission === "granted" &&
                    notifications.browserPushStatus === "error" && (
                        <div className="flex items-center gap-3 border-b bg-amber-500/10 p-4">
                            <CircleAlert className="size-4 shrink-0 text-amber-600" />
                            <p className="min-w-0 flex-1 text-xs leading-5 text-muted-foreground">
                                {t("notifications.pushError")}
                            </p>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 shrink-0 rounded-lg px-2 text-[10px] font-bold"
                                onClick={() => void notifications.enableBrowserNotifications()}
                            >
                                <RotateCw className="size-3.5" />
                                {t("notifications.retry")}
                            </Button>
                        </div>
                    )}

                    <div className="max-h-[390px] overflow-y-auto p-2">
                        {notifications.items.map((item) => (
                            <DropdownMenu.Item key={item.id} asChild>
                                <Link viewTransition
                                    to={item.link}
                                    onClick={() => notifications.markRead(item.id)}
                                    className="flex gap-3 rounded-xl p-3 outline-none transition hover:bg-muted focus:bg-muted"
                                >
                                    <span
                                        className={cn(
                                            "grid size-10 shrink-0 place-items-center rounded-xl",
                                            item.kind === "Stock"
                                                ? "bg-emerald-500/10 text-emerald-600"
                                                : item.kind === "Cart"
                                                  ? "bg-brand-orange/10 text-brand-orange"
                                                  : "bg-primary/10 text-primary",
                                        )}
                                    >
                                        {item.kind === "Stock" ? (
                                            <PackageOpen className="size-5" />
                                        ) : item.kind === "Cart" ? (
                                            <ShoppingBag className="size-5" />
                                        ) : (
                                            <Tag className="size-5" />
                                        )}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-bold">
                                            {item.title}
                                        </span>
                                        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                                            {item.message}
                                        </span>
                                        <span className="mt-1.5 block text-[10px] text-muted-foreground">
                                            {new Date(item.createdAt).toLocaleString(locale)}
                                        </span>
                                    </span>
                                </Link>
                            </DropdownMenu.Item>
                        ))}

                        {!notifications.items.length && (
                            <div className="px-5 py-10 text-center">
                                <Bell className="mx-auto size-8 text-muted-foreground" />
                                <p className="mt-3 text-sm font-bold">{t("notifications.emptyTitle")}</p>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                    {t("notifications.emptyDescription")}
                                </p>
                            </div>
                        )}
                    </div>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}
