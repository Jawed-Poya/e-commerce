import * as React from "react";
import { NavMain, type NavigationGroup } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from "@/components/ui/sidebar";
import { BarChart3, BriefcaseBusiness, Building2, LayoutDashboard, PackageIcon, SettingsIcon, ShoppingCart, Star, Trash2, Users, Warehouse, Crown } from "lucide-react";
import { useI18n } from "@/i18n/i18n-provider";
import { useAdminAuth } from "@/features/auth/auth-context";
import { hasPermission, Permissions } from "@/features/auth/permissions";
import { useTenant } from "@/features/tenancy/tenant-context";

type ProtectedItem = { title: string; url: string; icon?: React.ReactNode; permission?: string; items?: ProtectedItem[] };
type ProtectedGroup = { label: string; items: ProtectedItem[] };

const navigation: ProtectedGroup[] = [
    { label: "Workspace", items: [
        { title: "Dashboard", url: "/dashboard", icon: <LayoutDashboard />, permission: Permissions.DashboardView },
        { title: "Reports", url: "/reports", icon: <BarChart3 />, permission: Permissions.TenantReportsView },
    ]},
    { label: "Commerce", items: [
        { title: "Products", url: "/products", icon: <PackageIcon />, permission: Permissions.ProductsView },
        { title: "Reviews", url: "/reviews", icon: <Star />, permission: Permissions.ProductsManage },
        { title: "Inventory", url: "/inventory", icon: <Warehouse />, permission: Permissions.InventoryView },
        { title: "Orders", url: "/orders", icon: <ShoppingCart />, permission: Permissions.OrdersView },
        { title: "Customers", url: "/customers", icon: <Users />, permission: Permissions.CustomersView },
    ]},
    { label: "Operations", items: [
        { title: "Operations", url: "/operations", icon: <BriefcaseBusiness />, items: [
            { title: "Overview", url: "/operations", permission: Permissions.OperationsView },
            { title: "Purchases", url: "/operations/purchases", permission: Permissions.PurchasesView },
            { title: "Manual sales", url: "/operations/sales", permission: Permissions.ManualSalesView },
            { title: "Staff & payroll", url: "/operations/staff", permission: Permissions.StaffView },
            { title: "Expenses", url: "/operations/expenses", permission: Permissions.ExpensesView },
        ]},
    ]},
    { label: "Administration", items: [
        { title: "Company profile", url: "/company", icon: <Building2 />, permission: Permissions.TenantProfileManage },
        { title: "Storefront", url: "/system/storefront", icon: <SettingsIcon />, permission: Permissions.SystemManage },
        { title: "General Types", url: "/system/general-types", icon: <SettingsIcon />, permission: Permissions.SystemManage },
        { title: "Users", url: "/system/users", icon: <Users />, permission: Permissions.UsersView },
        { title: "Roles & Permissions", url: "/system/roles", icon: <Crown />, permission: Permissions.RolesManage },
        { title: "Trash", url: "/trash", icon: <Trash2 />, permission: Permissions.TenantTrashManage },
    ]},
    { label: "Platform", items: [
        { title: "Tenant companies", url: "/platform/tenants", icon: <Building2 />, permission: Permissions.PlatformTenantsManage },
        { title: "Subscription plans", url: "/platform/plans", icon: <Crown />, permission: Permissions.PlatformTenantsManage },
        { title: "Platform settings", url: "/platform/settings", icon: <SettingsIcon />, permission: Permissions.PlatformTenantsManage },
    ]},
];

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
    const { language, t } = useI18n();
    const { user } = useAdminAuth();
    const { tenant } = useTenant();
    const groups: NavigationGroup[] = navigation.map(group => ({
        label: group.label,
        items: group.items.map(item => ({ ...item, items: item.items?.filter(child => !child.permission || hasPermission(user, child.permission)) }))
            .filter(item => (!item.permission || hasPermission(user, item.permission)) && (!item.items || item.items.length > 0))
            .map(item => ({ title: item.title, url: item.url, icon: item.icon, items: item.items?.map(child => ({ title: child.title, url: child.url })) })),
    })).filter(group => group.items.length > 0);

    return <Sidebar side={language === "en" ? "left" : "right"} dir={language === "en" ? "ltr" : "rtl"} collapsible="icon" {...props}>
        <SidebarHeader><div className="flex items-center gap-3 border-b p-2"><div className="grid size-10 shrink-0 place-items-center overflow-hidden bg-primary text-primary-foreground">{tenant?.logoUrl ? <img src={tenant.logoUrl} alt="" className="size-full object-cover" /> : (tenant?.name ?? "E").slice(0, 1).toUpperCase()}</div><div className="min-w-0 group-data-[collapsible=icon]:hidden"><span className="block truncate font-bold">{tenant?.name ?? t("tenant.adminFallback")}</span><span className="block truncate text-xs text-muted-foreground">{tenant?.slug ?? t("tenant.controlPanel")}</span></div></div></SidebarHeader>
        <SidebarContent>{groups.length ? <NavMain groups={groups} /> : <div className="p-4 text-xs text-muted-foreground">{t("nav.noModules")}</div>}</SidebarContent>
        <SidebarFooter><NavUser /></SidebarFooter><SidebarRail />
    </Sidebar>;
}
