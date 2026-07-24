import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar";
import { CaretRightIcon } from "@phosphor-icons/react";
import { Link, useLocation } from "react-router-dom";
import { useI18n } from "@/i18n/i18n-provider";

export interface NavigationItem {
    title: string;
    url: string;
    icon?: React.ReactNode;
    items?: { title: string; url: string }[];
}
export interface NavigationGroup { label: string; items: NavigationItem[] }

const keys: Record<string, string> = {
    "Workspace": "nav.workspace", "Commerce": "nav.commerce", "Operations": "nav.operations", "Administration": "nav.administration", "Platform": "nav.platform",
    "Dashboard": "nav.dashboard", "Reports": "nav.reports", "Products": "nav.products", "Reviews": "nav.reviews", "Inventory": "nav.inventory", "Orders": "nav.orders", "Customers": "nav.customers",
    "Overview": "nav.overview", "Purchases": "nav.purchases", "Manual sales": "nav.manualSales", "Staff & payroll": "nav.staffPayroll", "Expenses": "nav.expenses",
    "Company profile": "nav.company", "Storefront": "nav.storefront", "General Types": "nav.generalTypes", "Users": "nav.users", "Roles & Permissions": "nav.roles", "Trash": "nav.trash", "Tenant companies": "nav.tenants", "Subscription plans": "plans.title", "Platform settings": "platform.settingsTitle",
};

export function NavMain({ groups }: { groups: NavigationGroup[] }) {
    const { t, language } = useI18n();
    const { pathname } = useLocation();
    const translate = (value: string) => { const key = keys[value]; return key ? t(key as never) : value; };
    const matches = (url: string) => pathname === url || pathname.startsWith(`${url}/`) || (url === "/dashboard" && pathname === "/");

    return <>{groups.map(group => <SidebarGroup key={group.label}>
        <SidebarGroupLabel>{translate(group.label)}</SidebarGroupLabel>
        <SidebarMenu>{group.items.map(item => {
            const active = matches(item.url) || item.items?.some(child => matches(child.url)) === true;
            if (!item.items?.length) return <SidebarMenuItem key={item.title}><SidebarMenuButton tooltip={translate(item.title)} isActive={active} render={<Link to={item.url} />}><span className="shrink-0">{item.icon}</span><span>{translate(item.title)}</span></SidebarMenuButton></SidebarMenuItem>;
            return <Collapsible key={item.title} defaultOpen={active} className="group/collapsible"><SidebarMenuItem><CollapsibleTrigger className="w-full"><SidebarMenuButton tooltip={translate(item.title)} isActive={active}>{item.icon}<span>{translate(item.title)}</span><CaretRightIcon className={`ms-auto size-4 transition-transform group-data-open/collapsible:rotate-90 ${language === "en" ? "" : "rotate-180 group-data-open/collapsible:rotate-90"}`} /></SidebarMenuButton></CollapsibleTrigger><CollapsibleContent><SidebarMenuSub>{item.items.map(child => <SidebarMenuSubItem key={child.title}><SidebarMenuSubButton isActive={matches(child.url)} render={<Link to={child.url} />}><span>{translate(child.title)}</span></SidebarMenuSubButton></SidebarMenuSubItem>)}</SidebarMenuSub></CollapsibleContent></SidebarMenuItem></Collapsible>;
        })}</SidebarMenu>
    </SidebarGroup>)}</>;
}
