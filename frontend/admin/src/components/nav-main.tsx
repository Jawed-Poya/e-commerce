import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";

import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar";

import { CaretRightIcon } from "@phosphor-icons/react";
import { Link, useLocation } from "react-router-dom";
import { useI18n } from "@/i18n/i18n-provider";

const navKeys = { Dashboard: "nav.dashboard", Products: "nav.products", "All Products": "nav.allProducts", Categories: "nav.categories", Brands: "nav.brands", Units: "nav.units", Inventory: "nav.inventory", "Stock Overview": "nav.stockOverview", "Stock Transactions": "nav.stockTransactions", "Low Stock": "nav.lowStock", Orders: "nav.orders", "All Orders": "nav.allOrders", "Pending Orders": "nav.pendingOrders", "Completed Orders": "nav.completedOrders", "Cancelled Orders": "nav.cancelledOrders", Customers: "nav.customers", "All Customers": "nav.allCustomers", "Customer Types": "nav.customerTypes", System: "nav.system", "General Types": "nav.generalTypes", Users: "nav.users", "Roles & Permissions": "nav.roles" } as const;

export function NavMain({
    items,
}: {
    items: {
        title: string;
        url: string;
        icon?: React.ReactNode;
        isActive?: boolean;
        permission?: string;
        items?: {
            title: string;
            url: string;
            permission?: string;
        }[];
    }[];
}) {
    const { t, language } = useI18n();
    const { pathname } = useLocation();
    const translate = (title: string) => { const key = navKeys[title as keyof typeof navKeys]; return key ? t(key) : title; };
    const matchesRoute = (url: string) => pathname === url || pathname.startsWith(`${url}/`) || (url === "/dashboard" && pathname === "/");
    return (
        <SidebarGroup>
            <SidebarGroupLabel>{t("nav.platform")}</SidebarGroupLabel>

            <SidebarMenu>
                {items.map((item) => {
                    const hasChildren = item.items && item.items.length > 0;
                    const itemIsActive = matchesRoute(item.url) || item.items?.some(subItem => matchesRoute(subItem.url)) === true;

                    if (!hasChildren) {
                        return (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton tooltip={translate(item.title)} isActive={itemIsActive}>
                                    <Link
                                        to={item.url}
                                        className="flex gap-2 items-center w-full py-3"
                                    >
                                        {item.icon}
                                        <span>{translate(item.title)}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                    }

                    return (
                        <Collapsible
                            key={item.title}
                            defaultOpen={itemIsActive || item.isActive}
                            className="group/collapsible"
                        >
                            <SidebarMenuItem>
                                <CollapsibleTrigger className={"w-full"}>
                                    <SidebarMenuButton tooltip={translate(item.title)} isActive={itemIsActive}>
                                        {item.icon}

                                        <span>{translate(item.title)}</span>

                                        <CaretRightIcon
                                            className={`
                                                ms-auto
                                                rotate-0
                                                transition-transform
                                                duration-200
                                                ease-out
                                                group-data-open/collapsible:rotate-90
                                                ${language === "en" ? "" : "rotate-180 group-data-open/collapsible:rotate-90"}
                                            `}
                                        />
                                    </SidebarMenuButton>
                                </CollapsibleTrigger>

                                <CollapsibleContent>
                                    <SidebarMenuSub>
                                        {item.items?.map((subItem) => (
                                            <SidebarMenuSubItem
                                                key={subItem.title}
                                            >
                                                <SidebarMenuSubButton isActive={matchesRoute(subItem.url)}>
                                                    <Link
                                                        to={subItem.url}
                                                        className=" w-full py-3"
                                                    >
                                                        <span>
                                                            {translate(subItem.title)}
                                                        </span>
                                                    </Link>
                                                </SidebarMenuSubButton>
                                            </SidebarMenuSubItem>
                                        ))}
                                    </SidebarMenuSub>
                                </CollapsibleContent>
                            </SidebarMenuItem>
                        </Collapsible>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    );
}
