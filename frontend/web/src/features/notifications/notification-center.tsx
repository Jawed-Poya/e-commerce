import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell, BellRing, CheckCheck, PackageOpen, Tag } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "../../shared/components/ui/button";
import { cn } from "../../shared/lib/utils";
import { useStoreNotifications } from "./notification-context";

export function NotificationCenter() {
    const notifications = useStoreNotifications();

    return (
        <DropdownMenu.Root onOpenChange={(open) => open && notifications.markAllRead()}>
            <DropdownMenu.Trigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    aria-label="Product notifications"
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
                            <p className="font-black">Product alerts</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Price changes and restocks for products you follow.
                            </p>
                        </div>
                        <CheckCheck className="size-4 text-primary" />
                    </div>

                    {notifications.permission !== "granted" && (
                        <div className="border-b bg-primary/5 p-4">
                            <p className="text-xs leading-5 text-muted-foreground">
                                Enable browser alerts to see changes while this shop is open in another tab.
                            </p>
                            <Button
                                size="sm"
                                className="mt-3 rounded-lg"
                                onClick={() =>
                                    void notifications.enableBrowserNotifications()
                                }
                            >
                                <BellRing /> Enable alerts
                            </Button>
                        </div>
                    )}

                    <div className="max-h-[390px] overflow-y-auto p-2">
                        {notifications.items.map((item) => (
                            <DropdownMenu.Item key={item.id} asChild>
                                <Link
                                    to={item.link}
                                    className="flex gap-3 rounded-xl p-3 outline-none transition hover:bg-muted focus:bg-muted"
                                >
                                    <span
                                        className={cn(
                                            "grid size-10 shrink-0 place-items-center rounded-xl",
                                            item.kind === "Stock"
                                                ? "bg-emerald-500/10 text-emerald-600"
                                                : "bg-primary/10 text-primary",
                                        )}
                                    >
                                        {item.kind === "Stock" ? (
                                            <PackageOpen className="size-5" />
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
                                            {new Date(item.createdAt).toLocaleString()}
                                        </span>
                                    </span>
                                </Link>
                            </DropdownMenu.Item>
                        ))}

                        {!notifications.items.length && (
                            <div className="px-5 py-10 text-center">
                                <Bell className="mx-auto size-8 text-muted-foreground" />
                                <p className="mt-3 text-sm font-bold">No alerts yet</p>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                    Open a product or save it to your wishlist. We will watch it for you.
                                </p>
                            </div>
                        )}
                    </div>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}
