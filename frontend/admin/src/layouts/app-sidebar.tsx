import * as React from "react";
import { NavMain } from "@/components/nav-main";
import { adminUser, NavUser } from "@/components/nav-user";

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
} from "lucide-react";
import { useI18n } from "@/i18n/i18n-provider";

const data = {
    user: adminUser,

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
        },

        {
            title: "Inventory",
            url: "/inventory",
            icon: <Warehouse />,
        },

        {
            title: "System",
            url: "/system",
            icon: <SettingsIcon />,
            items: [
                {
                    title: "General Types",
                    url: "/system/general-types",
                },
            ],
        },
    ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const { language } = useI18n();
    return (
        <Sidebar side={language === "en" ? "left" : "right"} dir={language === "en" ? "ltr" : "rtl"} collapsible="icon" {...props}>
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
