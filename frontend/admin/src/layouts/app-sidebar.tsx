import * as React from "react";
import {
    BarChart3,
    BriefcaseBusiness,
    Building2,
    Crown,
    LayoutDashboard,
    PackageIcon,
    SettingsIcon,
    ShoppingCart,
    Star,
    Trash2,
    Users,
    Warehouse,
} from "lucide-react";

import { NavMain, type NavigationGroup } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarRail,
} from "@/components/ui/sidebar";
import { useI18n, type TranslationKey } from "@/i18n/i18n-provider";
import { useAdminAuth } from "@/features/auth/auth-context";
import { hasPermission, Permissions } from "@/features/auth/permissions";
import { useCompany } from "@/features/company/company-context";
import { resolveCompanyAssetUrl } from "@/features/company/company-service";

type ProtectedItem = {
    titleKey: TranslationKey;
    url: string;
    icon?: React.ReactNode;
    permission?: string;
    items?: ProtectedItem[];
};

type ProtectedGroup = {
    labelKey: TranslationKey;
    items: ProtectedItem[];
};

const navigation: ProtectedGroup[] = [
    {
        labelKey: "nav.overview",
        items: [
            {
                titleKey: "nav.dashboard",
                url: "/dashboard",
                icon: <LayoutDashboard />,
                permission: Permissions.DashboardView,
            },
            {
                titleKey: "nav.financialReports",
                url: "/reports",
                icon: <BarChart3 />,
                permission: Permissions.FinancialReportsView,
            },
        ],
    },
    {
        labelKey: "nav.commerce",
        items: [
            {
                titleKey: "nav.products",
                url: "/products",
                icon: <PackageIcon />,
                permission: Permissions.ProductsView,
            },
            {
                titleKey: "nav.reviews",
                url: "/reviews",
                icon: <Star />,
                permission: Permissions.ProductsManage,
            },
            {
                titleKey: "nav.inventory",
                url: "/inventory",
                icon: <Warehouse />,
                permission: Permissions.InventoryView,
            },
            {
                titleKey: "nav.orders",
                url: "/orders",
                icon: <ShoppingCart />,
                permission: Permissions.OrdersView,
            },
            {
                titleKey: "nav.customers",
                url: "/customers",
                icon: <Users />,
                permission: Permissions.CustomersView,
            },
        ],
    },
    {
        labelKey: "nav.operations",
        items: [
            {
                titleKey: "nav.operations",
                url: "/operations",
                icon: <BriefcaseBusiness />,
                items: [
                    {
                        titleKey: "nav.overview",
                        url: "/operations",
                        permission: Permissions.OperationsView,
                    },
                    {
                        titleKey: "nav.purchases",
                        url: "/operations/purchases",
                        permission: Permissions.PurchasesView,
                    },
                    {
                        titleKey: "nav.manualSales",
                        url: "/operations/sales",
                        permission: Permissions.ManualSalesView,
                    },
                    {
                        titleKey: "nav.staffPayroll",
                        url: "/operations/staff",
                        permission: Permissions.StaffView,
                    },
                    {
                        titleKey: "nav.expenses",
                        url: "/operations/expenses",
                        permission: Permissions.ExpensesView,
                    },
                ],
            },
        ],
    },
    {
        labelKey: "nav.administration",
        items: [
            {
                titleKey: "nav.companySettings",
                url: "/company",
                icon: <Building2 />,
                permission: Permissions.CompanyProfileManage,
            },
            {
                titleKey: "nav.storefront",
                url: "/system/storefront",
                icon: <SettingsIcon />,
                permission: Permissions.SystemManage,
            },
            {
                titleKey: "nav.generalTypes",
                url: "/system/general-types",
                icon: <SettingsIcon />,
                permission: Permissions.SystemManage,
            },
            {
                titleKey: "nav.users",
                url: "/system/users",
                icon: <Users />,
                permission: Permissions.UsersView,
            },
            {
                titleKey: "nav.roles",
                url: "/system/roles",
                icon: <Crown />,
                permission: Permissions.RolesManage,
            },
            {
                titleKey: "nav.trash",
                url: "/trash",
                icon: <Trash2 />,
                permission: Permissions.CompanyTrashManage,
            },
        ],
    },
];

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
    const { language, t } = useI18n();
    const { user } = useAdminAuth();
    const { company } = useCompany();
    const groups: NavigationGroup[] = navigation
        .map((group) => ({
            labelKey: group.labelKey,
            items: group.items
                .map((item) => ({
                    ...item,
                    items: item.items?.filter(
                        (child) =>
                            !child.permission ||
                            hasPermission(user, child.permission),
                    ),
                }))
                .filter(
                    (item) =>
                        (!item.permission ||
                            hasPermission(user, item.permission)) &&
                        (!item.items || item.items.length > 0),
                )
                .map((item) => ({
                    titleKey: item.titleKey,
                    url: item.url,
                    icon: item.icon,
                    items: item.items?.map((child) => ({
                        titleKey: child.titleKey,
                        url: child.url,
                    })),
                })),
        }))
        .filter((group) => group.items.length > 0);

    return (
        <Sidebar
            side={language === "en" ? "left" : "right"}
            dir={language === "en" ? "ltr" : "rtl"}
            collapsible="icon"
            {...props}
        >
            <SidebarHeader>
                <div className="flex items-center gap-3 border-b p-2">
                    <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary text-primary-foreground">
                        {company?.logoUrl ? (
                            <img
                                src={
                                    resolveCompanyAssetUrl(company.logoUrl) ??
                                    company.logoUrl
                                }
                                alt=""
                                className="size-full bg-background object-contain p-1"
                            />
                        ) : (
                            (company?.name ?? "C").slice(0, 1).toUpperCase()
                        )}
                    </div>
                    <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                        <span className="block truncate font-bold">
                            {company?.name ?? "Company"}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                            {t("nav.controlCenter")}
                        </span>
                    </div>
                </div>
            </SidebarHeader>
            <SidebarContent>
                {groups.length ? (
                    <NavMain groups={groups} />
                ) : (
                    <div className="p-4 text-xs text-muted-foreground">
                        {t("nav.noModules")}
                    </div>
                )}
            </SidebarContent>
            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
