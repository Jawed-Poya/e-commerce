import { Bell, CircleDollarSign, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAdminNotifications } from "./admin-notification-context";

export function AdminNotificationCenter() {
    const notifications = useAdminNotifications();
    const navigate = useNavigate();

    return (
        <DropdownMenu
            onOpenChange={(open) => open && notifications.markAllRead()}
        >
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon"
                        className="relative"
                        aria-label="Admin notifications"
                    />
                }
            >
                <Bell className="size-5" />
                {notifications.unreadCount > 0 && (
                    <span className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-destructive-foreground">
                        {notifications.unreadCount > 9
                            ? "9+"
                            : notifications.unreadCount}
                    </span>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
                <DropdownMenuLabel className="flex items-center justify-between px-4 py-3">
                    <span>Notifications</span>
                    <Badge variant="outline" className="gap-1 text-[10px]">
                        <span
                            className={`size-1.5 rounded-full ${
                                notifications.realtimeStatus === "live"
                                    ? "bg-emerald-500"
                                    : "bg-amber-500"
                            }`}
                        />
                        {notifications.realtimeStatus === "live"
                            ? "Live"
                            : "Fallback"}
                    </Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-[26rem] overflow-y-auto p-2">
                    {notifications.items.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => navigate(item.link)}
                            className="flex w-full gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted"
                        >
                            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                                {item.kind === "Payment" ? (
                                    <CircleDollarSign className="size-4" />
                                ) : (
                                    <ShoppingCart className="size-4" />
                                )}
                            </span>
                            <span className="min-w-0 flex-1">
                                <b className="block truncate text-sm">
                                    {item.title}
                                </b>
                                <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                                    {item.message}
                                </span>
                                <span className="mt-1.5 block text-[10px] text-muted-foreground">
                                    {new Date(item.createdAt).toLocaleString()}
                                </span>
                            </span>
                        </button>
                    ))}
                    {!notifications.items.length && (
                        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                            No order notifications yet.
                        </div>
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
