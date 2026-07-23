import { useNavigate } from "react-router-dom";
import {
    Banknote,
    CircleDollarSign,
    ReceiptText,
    ShoppingBasket,
    TrendingDown,
    UsersRound,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAdminAuth } from "@/features/auth/auth-context";
import { hasPermission, Permissions } from "@/features/auth/permissions";
import {
    operationKeys,
    useOperationQuery,
} from "@/features/operations/operations-hooks";
import { operationsService } from "@/features/operations/operations-service";

export default function OperationsDashboardPage() {
    const navigate = useNavigate();
    const { user } = useAdminAuth();
    const { data } = useOperationQuery(
        operationKeys.summary,
        operationsService.summary,
    );
    const metrics = [
        ["Purchases this month", data?.purchasesThisMonth, ShoppingBasket],
        ["Manual sales this month", data?.salesThisMonth, CircleDollarSign],
        ["Expenses this month", data?.expensesThisMonth, ReceiptText],
        ["Salaries this month", data?.salariesThisMonth, Banknote],
    ] as const;
    const actions = [
        {
            title: "Receive purchase",
            description: "Add supplier stock and costs.",
            icon: ShoppingBasket,
            route: "/operations/purchases",
            permission: Permissions.PurchasesView,
        },
        {
            title: "Record sale",
            description: "Create a counter sale and reduce stock.",
            icon: CircleDollarSign,
            route: "/operations/sales",
            permission: Permissions.ManualSalesView,
        },
        {
            title: "Manage staff",
            description: "Employee records and salary payments.",
            icon: UsersRound,
            route: "/operations/staff",
            permission: Permissions.StaffView,
        },
        {
            title: "Record expense",
            description: "Categorize operating expenses.",
            icon: ReceiptText,
            route: "/operations/expenses",
            permission: Permissions.ExpensesView,
        },
    ].filter((action) => hasPermission(user, action.permission));

    return (
        <div className="space-y-6">
            <PageHeader
                title="Business operations"
                description="Purchasing, manual sales, staff payroll, expenses, and stock control in one admin workspace."
            />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {metrics.map(([label, value, Icon]) => (
                    <Card key={label}>
                        <CardContent className="flex items-center justify-between p-5">
                            <div>
                                <p className="text-sm text-muted-foreground">{label}</p>
                                <p className="mt-2 text-2xl font-bold">{money(value ?? 0)}</p>
                            </div>
                            <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                                <Icon className="size-5" />
                            </span>
                        </CardContent>
                    </Card>
                ))}
            </div>
            {actions.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Quick actions</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {actions.map((action) => (
                            <Action
                                key={action.route}
                                title={action.title}
                                description={action.description}
                                icon={action.icon}
                                onClick={() => navigate(action.route)}
                            />
                        ))}
                    </CardContent>
                </Card>
            )}
            <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="flex items-center gap-3">
                        <span className="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
                            <TrendingDown className="size-5" />
                        </span>
                        <div>
                            <p className="font-semibold">Low-stock attention</p>
                            <p className="text-sm text-muted-foreground">
                                Active products with no inventory or at/below minimum quantity.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <strong className="text-2xl">{data?.lowStockProducts ?? 0}</strong>
                        {hasPermission(user, Permissions.InventoryView) && (
                            <Button variant="outline" onClick={() => navigate("/inventory")}>
                                Open inventory
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function Action({
    title,
    description,
    icon: Icon,
    onClick,
}: {
    title: string;
    description: string;
    icon: typeof ShoppingBasket;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex items-start gap-3 rounded-xl border p-4 text-start transition hover:border-primary/40 hover:bg-muted/40"
        >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
            </span>
            <span>
                <strong className="block text-sm">{title}</strong>
                <span className="mt-1 block text-xs text-muted-foreground">
                    {description}
                </span>
            </span>
        </button>
    );
}
function money(value: number) {
    return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
    }).format(value);
}
