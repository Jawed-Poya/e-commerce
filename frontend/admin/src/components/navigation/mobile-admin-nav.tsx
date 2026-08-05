import {
    Boxes,
    LayoutDashboard,
    Menu,
    Package,
    ShoppingCart,
    Users,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { useSidebar } from "@/components/ui/sidebar";
import { useAdminAuth } from "@/features/auth/auth-context";
import { hasPermission, Permissions } from "@/features/auth/permissions";
import { useI18n, type TranslationKey } from "@/i18n/i18n-provider";
import { cn } from "@/lib/utils";

const candidates: Array<{
    to: string;
    labelKey: TranslationKey;
    permission: string;
    icon: typeof LayoutDashboard;
}> = [
    { to: "/dashboard", labelKey: "nav.dashboard", permission: Permissions.DashboardView, icon: LayoutDashboard },
    { to: "/products", labelKey: "nav.products", permission: Permissions.ProductsView, icon: Package },
    { to: "/orders", labelKey: "nav.orders", permission: Permissions.OrdersView, icon: ShoppingCart },
    { to: "/operations", labelKey: "nav.operations", permission: Permissions.OperationsView, icon: Boxes },
    { to: "/customers", labelKey: "nav.customers", permission: Permissions.CustomersView, icon: Users },
];

export function MobileAdminNav() {
    const { user } = useAdminAuth();
    const { t, tr } = useI18n();
    const { setOpenMobile } = useSidebar();
    const items = candidates.filter((item) => hasPermission(user, item.permission)).slice(0, 4);

    return (
        <nav
            aria-label={tr("Mobile navigation")}
            className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur-xl md:hidden"
        >
            <div className="mx-auto grid max-w-lg grid-flow-col auto-cols-fr gap-1">
                {items.map((item) => {
                    const Icon = item.icon;
                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => cn(
                                "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 border-t-2 border-transparent px-1 text-[10px] font-medium text-muted-foreground transition-colors",
                                isActive && "border-primary bg-primary/5 text-primary",
                            )}
                        >
                            <Icon className="size-4.5" />
                            <span className="max-w-full truncate">{t(item.labelKey)}</span>
                        </NavLink>
                    );
                })}
                <button
                    type="button"
                    onClick={() => setOpenMobile(true)}
                    className="flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 border-t-2 border-transparent px-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <Menu className="size-4.5" />
                    <span>{tr("Menu")}</span>
                </button>
            </div>
        </nav>
    );
}
