import * as React from "react";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarRail,
} from "@/components/ui/sidebar";

import {
    LayoutDashboard,
    PackageIcon,
    SettingsIcon,
    Warehouse,
    ShoppingCart,
    Users,
    Star,
} from "lucide-react";
import { useI18n } from "@/i18n/i18n-provider";
import { useAdminAuth } from "@/features/auth/auth-context";
import { hasPermission, Permissions } from "@/features/auth/permissions";

const data = {
    navMain: [
        {
            title: "Dashboard",
            url: "/dashboard",
            icon: <LayoutDashboard />,
            permission: Permissions.DashboardView,
        },
        {
            title: "Products",
            url: "/products",
            icon: <PackageIcon />,
            permission: Permissions.ProductsView,
        },
        {
            title: "Reviews",
            url: "/reviews",
            icon: <Star />,
            permission: Permissions.ProductsManage,
        },
        {
            title: "Inventory",
            url: "/inventory",
            icon: <Warehouse />,
            permission: Permissions.InventoryView,
        },
        {
            title: "Orders",
            url: "/orders",
            icon: <ShoppingCart />,
            permission: Permissions.OrdersView,
        },
        {
            title: "Customers",
            url: "/customers",
            icon: <Users />,
            permission: Permissions.CustomersView,
        },
        {
            title: "System",
            url: "/system",
            icon: <SettingsIcon />,
            items: [
                {
                    title: "Storefront hero",
                    url: "/system/storefront",
                    permission: Permissions.SystemManage,
                },
                {
                    title: "General Types",
                    url: "/system/general-types",
                    permission: Permissions.SystemManage,
                },
                {
                    title: "Users",
                    url: "/system/users",
                    permission: Permissions.UsersView,
                },
                {
                    title: "Roles & Permissions",
                    url: "/system/roles",
                    permission: Permissions.RolesManage,
                },
            ],
        },
    ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const { language } = useI18n();
    const { user } = useAdminAuth();
    const navItems = data.navMain
        .map((item) => ({
            ...item,
            items: item.items?.filter(
                (subItem) =>
                    !subItem.permission ||
                    hasPermission(user, subItem.permission),
            ),
        }))
        .filter(
            (item) =>
                (!item.permission || hasPermission(user, item.permission)) &&
                (!item.items || item.items.length > 0),
        );

    return (
        <Sidebar
            side={language === "en" ? "left" : "right"}
            dir={language === "en" ? "ltr" : "rtl"}
            collapsible="icon"
            {...props}
        >
            <SidebarHeader>
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary px-4 text-primary-foreground">
                        E
                    </div>
                    <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                        <span className="font-semibold">Ecommerce Admin</span>
                        <span className="text-xs text-muted-foreground">
                            Control Panel
                        </span>
                    </div>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={navItems} />
            </SidebarContent>
            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
