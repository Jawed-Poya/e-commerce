"use client";

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
    ChartBarIcon,
    LayoutDashboard,
    MegaphoneIcon,
    PackageIcon,
    SettingsIcon,
    ShoppingCartIcon,
    UsersIcon,
    WarehouseIcon,
} from "lucide-react";

const data = {
    user: {
        name: "Admin",
        email: "admin@example.com",
        avatar: "/avatars/admin.jpg",
    },

    navMain: [
        {
            title: "Dashboard",
            url: "/dashboard",
            icon: <LayoutDashboard />,
            isActive: true,
        },

        {
            title: "Products",
            url: "/products",
            icon: <PackageIcon />,
            items: [
                {
                    title: "All Products",
                    url: "/products",
                },
                {
                    title: "Categories",
                    url: "/categories",
                },
                {
                    title: "Brands",
                    url: "/brands",
                },
                {
                    title: "Units",
                    url: "/units",
                },
                {
                    title: "Product Reviews",
                    url: "/reviews",
                },
            ],
        },

        {
            title: "Inventory",
            url: "/inventory",
            icon: <WarehouseIcon />,
            items: [
                {
                    title: "Stock Overview",
                    url: "/inventory",
                },
                {
                    title: "Stock Transactions",
                    url: "/inventory/transactions",
                },
                {
                    title: "Low Stock",
                    url: "/inventory/low-stock",
                },
            ],
        },

        {
            title: "Orders",
            url: "/orders",
            icon: <ShoppingCartIcon />,
            items: [
                {
                    title: "All Orders",
                    url: "/orders",
                },
                {
                    title: "Pending Orders",
                    url: "/orders/pending",
                },
                {
                    title: "Completed Orders",
                    url: "/orders/completed",
                },
                {
                    title: "Cancelled Orders",
                    url: "/orders/cancelled",
                },
            ],
        },

        {
            title: "Customers",
            url: "/customers",
            icon: <UsersIcon />,
            items: [
                {
                    title: "All Customers",
                    url: "/customers",
                },
                {
                    title: "Customer Types",
                    url: "/customer-types",
                },
            ],
        },

        {
            title: "Marketing",
            url: "/marketing",
            icon: <MegaphoneIcon />,
            items: [
                {
                    title: "Featured Products",
                    url: "/marketing/featured",
                },
                {
                    title: "Discounts",
                    url: "/marketing/discounts",
                },
            ],
        },

        {
            title: "Reports",
            url: "/reports",
            icon: <ChartBarIcon />,
            items: [
                {
                    title: "Sales Reports",
                    url: "/reports/sales",
                },
                {
                    title: "Inventory Reports",
                    url: "/reports/inventory",
                },
                {
                    title: "Customer Reports",
                    url: "/reports/customers",
                },
            ],
        },

        {
            title: "System",
            url: "/system",
            icon: <SettingsIcon />,
            items: [
                {
                    title: "Users",
                    url: "/system/users",
                },
                {
                    title: "Roles & Permissions",
                    url: "/system/roles",
                },
                {
                    title: "Notifications",
                    url: "/system/notifications",
                },
                {
                    title: "Activity Logs",
                    url: "/system/activity-logs",
                },
                {
                    title: "Settings",
                    url: "/system/settings",
                },
            ],
        },
    ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 px-4 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        E
                    </div>

                    <div
                        className="
                        flex
                        flex-col
                        group-data-[collapsible=icon]:hidden
                    "
                    >
                        <span className="font-semibold">Ecommerce Admin</span>

                        <span className="text-xs text-muted-foreground">
                            Control Panel
                        </span>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={data.navMain} />
            </SidebarContent>

            <SidebarFooter>
                <NavUser user={data.user} />
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    );
}
