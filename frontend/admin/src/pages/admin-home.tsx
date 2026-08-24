import {
    ArrowRight,
    BadgeCheck,
    Boxes,
    ChartNoAxesCombined,
    ClipboardList,
    LayoutDashboard,
    PackageSearch,
    ReceiptText,
    ShoppingCart,
    UsersRound,
    type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAdminAuth } from "@/features/auth/auth-context";
import { hasPermission, Permissions } from "@/features/auth/permissions";
import { useCompany } from "@/features/company/company-context";

type WorkspaceDestination = {
    title: string;
    description: string;
    href: string;
    icon: LucideIcon;
    permission: string;
    primary?: boolean;
};

const destinations: WorkspaceDestination[] = [
    { title: "Dashboard", description: "Load business KPIs, sales trends, and inventory health when you need them.", href: "/dashboard", icon: LayoutDashboard, permission: Permissions.DashboardView, primary: true },
    { title: "Orders", description: "Review customer orders and fulfillment activity.", href: "/orders", icon: ShoppingCart, permission: Permissions.OrdersView },
    { title: "Products", description: "Manage the product catalog, pricing, and availability.", href: "/products", icon: PackageSearch, permission: Permissions.ProductsView },
    { title: "Inventory", description: "Inspect stock levels, movements, and replenishment needs.", href: "/inventory", icon: Boxes, permission: Permissions.InventoryView },
    { title: "Operations", description: "Open purchases, sales, staff, expenses, and daily workflows.", href: "/operations", icon: ClipboardList, permission: Permissions.OperationsView },
    { title: "Accounting", description: "Work with vouchers, general ledgers, and party statements.", href: "/accounting", icon: ReceiptText, permission: Permissions.ExpensesView },
    { title: "Financial reports", description: "Load financial analysis and management reports.", href: "/reports", icon: ChartNoAxesCombined, permission: Permissions.FinancialReportsView },
    { title: "Customers", description: "Review customer accounts, balances, and activity.", href: "/customers", icon: UsersRound, permission: Permissions.CustomersView },
];

export default function AdminHomePage() {
    const { user } = useAdminAuth();
    const { company } = useCompany();
    const available = destinations.filter((item) => hasPermission(user, item.permission));

    return (
        <div className="space-y-6">
            <PageHeader
                title={`Welcome${user?.fullName ? `, ${user.fullName}` : ""}`}
                description={`Choose the area you want to work in. ${company?.name ?? "Your company"} only loads each workspace when you open it.`}
            />

            <Card className="overflow-hidden border-primary/20 bg-primary/[0.035] shadow-none">
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><BadgeCheck className="size-5" /></span>
                        <div>
                            <div className="flex flex-wrap items-center gap-2"><h2 className="font-heading text-lg font-bold">Workspace ready</h2><Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Fast start</Badge></div>
                            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">Dashboard analytics and large operational datasets are not fetched on sign-in. Open only the section required for the current task.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <section>
                <div className="mb-3"><h2 className="font-heading text-base font-bold">Your workspaces</h2><p className="mt-1 text-xs text-muted-foreground">Only destinations allowed for your account are shown.</p></div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {available.map((item) => {
                        const Icon = item.icon;
                        return (
                            <Link key={item.href} to={item.href} className="group focus-visible:outline-none">
                                <Card className="h-full shadow-none transition-colors group-hover:border-primary/40 group-hover:bg-primary/[0.025] group-focus-visible:ring-2 group-focus-visible:ring-primary">
                                    <CardContent className="flex h-full flex-col p-5">
                                        <span className={item.primary ? "grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground" : "grid size-10 place-items-center rounded-xl bg-muted text-foreground"}><Icon className="size-5" /></span>
                                        <h3 className="mt-4 font-heading font-bold">{item.title}</h3>
                                        <p className="mt-2 flex-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
                                        <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">Open workspace <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" /></span>
                                    </CardContent>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
