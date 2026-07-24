import {
    Bell,
    BellRing,
    CheckCheck,
    CircleDollarSign,
    Radio,
    ShoppingCart,
    Star,
    Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/i18n-provider";
import { useAdminNotifications } from "./admin-notification-context";

export function AdminNotificationCenter() {
    const notifications = useAdminNotifications();
    const navigate = useNavigate();
    const { t, language } = useI18n();
    const isLive = notifications.realtimeStatus === "live";

    const remove = async (id: number) => {
        try {
            await notifications.remove(id);
            toast.success(t("notifications.deleted"));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t("notifications.deleteFailed"));
        }
    };
    const clear = async () => {
        try {
            await notifications.clear();
            toast.success(t("notifications.cleared"));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t("notifications.deleteFailed"));
        }
    };

    return (
        <DropdownMenu onOpenChange={(open) => open && notifications.markAllRead()}>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon"
                        className="relative rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        aria-label={t("common.notifications")}
                    />
                }
            >
                {notifications.unreadCount > 0 ? <BellRing className="size-5" /> : <Bell className="size-5" />}
                {notifications.unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 grid min-w-4.5 place-items-center rounded-full border-2 border-background bg-destructive px-1 text-[9px] font-bold leading-4 text-destructive-foreground">
                        {notifications.unreadCount > 9 ? "9+" : notifications.unreadCount}
                    </span>
                )}
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" sideOffset={10} className="w-[min(94vw,440px)] overflow-hidden rounded-2xl p-0 shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b bg-gradient-to-br from-primary/10 via-background to-background p-4">
                    <div className="flex items-center gap-2">
                        <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><BellRing className="size-4" /></span>
                        <div><p className="font-black">{t("notifications.salesActivity")}</p><p className="text-xs text-muted-foreground">{t("notifications.activityHelp")}</p></div>
                    </div>
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide", isLive ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600" : "border-amber-500/20 bg-amber-500/10 text-amber-600")}>
                        <Radio className="size-3" />{isLive ? t("notifications.live") : t("notifications.fallback")}
                    </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 text-xs text-muted-foreground">
                    <span>{notifications.items.length} {t("notifications.recentEvents")}</span>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5"><CheckCheck className="size-3.5 text-primary" />{t("notifications.openedRead")}</span>
                        {notifications.items.length > 0 ? <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => void clear()}><Trash2 className="size-3.5" />{t("notifications.clearAll")}</Button> : null}
                    </div>
                </div>

                <div className="max-h-[440px] overflow-y-auto p-2">
                    {notifications.items.map((item) => (
                        <div key={item.id} className="group relative rounded-xl hover:bg-muted focus-within:bg-muted">
                            <button type="button" onClick={() => navigate(item.link)} className="flex w-full gap-3 rounded-xl p-3 pe-12 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                <span className={cn("mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl", item.kind === "Payment" ? "bg-emerald-500/10 text-emerald-600" : item.kind === "Review" ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary")}>
                                    {item.kind === "Payment" ? <CircleDollarSign className="size-5" /> : item.kind === "Review" ? <Star className="size-5 fill-current" /> : <ShoppingCart className="size-5" />}
                                </span>
                                <span className="min-w-0 flex-1"><b className="block truncate text-sm">{item.title}</b><span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">{item.message}</span><span className="mt-1.5 block text-[10px] text-muted-foreground">{new Date(item.createdAt).toLocaleString(language === "en" ? "en-US" : language === "ps" ? "ps-AF" : "fa-AF")}</span></span>
                            </button>
                            <Button variant="ghost" size="icon" className="absolute end-2 top-2 size-8 opacity-70 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100" aria-label={t("notifications.deleteOne")} onClick={() => void remove(item.id)}><Trash2 className="size-4" /></Button>
                        </div>
                    ))}

                    {!notifications.items.length && (
                        <div className="px-5 py-12 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground"><Bell className="size-5" /></span><p className="mt-3 text-sm font-bold">{t("notifications.empty")}</p><p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted-foreground">{t("notifications.emptyHelp")}</p></div>
                    )}
                </div>
                <p className="border-t px-4 py-3 text-[11px] leading-5 text-muted-foreground">{t("notifications.retentionHelp")}</p>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
