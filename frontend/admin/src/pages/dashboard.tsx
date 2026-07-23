import { useQuery } from "@tanstack/react-query";
import {
    AlertTriangle,
    ArrowRight,
    Boxes,
    CircleDollarSign,
    Clock3,
    Eye,
    PackageCheck,
    PackageX,
    RefreshCw,
    Radio,
    BellRing,
    ShoppingCart,
    TrendingUp,
    Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import { buttonVariants, Button } from "@/components/ui/button";
import { resolveProductImageUrl } from "@/services/product.service";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { dashboardService } from "@/features/dashboard/dashboard-service";
import type {
    SalesTrendPoint,
    TopProductItem,
} from "@/features/dashboard/dashboard-types";
import { formatMoney, StatusBadge } from "@/pages/orders";

export default function Dashboard() {
    const query = useQuery({
        queryKey: ["admin-dashboard"],
        queryFn: dashboardService.get,
        refetchInterval: 60_000,
    });

    if (query.isLoading) return <DashboardSkeleton />;
    if (!query.data) {
        return (
            <div className="space-y-5">
                <PageHeader
                    title="Dashboard"
                    description="Business, traffic, sales, and inventory performance in one place."
                />
                <Card>
                    <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
                        <AlertTriangle className="size-9 text-destructive" />
                        <div>
                            <p className="font-semibold">Dashboard could not be loaded</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Check the API connection and your dashboard permission.
                            </p>
                        </div>
                        <Button onClick={() => query.refetch()}>Try again</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const data = query.data;
    const inventoryTotal =
        data.inventory.healthyProducts +
        data.inventory.lowStockProducts +
        data.inventory.outOfStockProducts;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Dashboard"
                description="Business, website traffic, orders, and inventory health in one place."
                actions={
                    <Button
                        variant="outline"
                        onClick={() => query.refetch()}
                        disabled={query.isFetching}
                    >
                        <RefreshCw
                            className={query.isFetching ? "animate-spin" : ""}
                        />
                        Refresh
                    </Button>
                }
            />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                <MetricCard
                    label="Revenue (30 days)"
                    value={formatMoney(
                        data.kpis.revenueLast30Days,
                        data.kpis.currency,
                    )}
                    help={`${formatMoney(data.kpis.paidRevenue, data.kpis.currency)} all-time paid`}
                    icon={<CircleDollarSign />}
                />
                <MetricCard
                    label="Orders"
                    value={data.kpis.totalOrders.toLocaleString()}
                    help={`${data.kpis.pendingOrders} pending · ${data.kpis.pendingPayments} payments to review`}
                    icon={<ShoppingCart />}
                />
                <MetricCard
                    label="Website product views"
                    value={data.kpis.totalProductViews.toLocaleString()}
                    help={`${data.kpis.activeProducts} of ${data.kpis.totalProducts} products active`}
                    icon={<Eye />}
                />
                <MetricCard
                    label="Customers"
                    value={data.kpis.totalCustomers.toLocaleString()}
                    help="Registered and guest checkout customers"
                    icon={<Users />}
                />
                <MetricCard
                    label="Live storefront listeners"
                    value={data.kpis.realtimeConnections.toLocaleString()}
                    help="Active SignalR notification connections"
                    icon={<Radio />}
                />
                <MetricCard
                    label="Alerts generated (24h)"
                    value={data.kpis.notificationsLast24Hours.toLocaleString()}
                    help="Price-change and stock-increase events"
                    icon={<BellRing />}
                />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
                <Card className="overflow-hidden">
                    <CardHeader className="flex-row items-center justify-between border-b">
                        <div>
                            <CardTitle>Sales activity</CardTitle>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Paid revenue and order volume over the last 30 days.
                            </p>
                        </div>
                        <TrendingUp className="size-5 text-primary" />
                    </CardHeader>
                    <CardContent className="pt-6">
                        <SalesChart
                            points={data.salesTrend}
                            currency={data.kpis.currency}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="border-b">
                        <CardTitle>Inventory health</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5 pt-5">
                        <InventoryRow
                            label="Healthy"
                            count={data.inventory.healthyProducts}
                            total={inventoryTotal}
                            className="bg-emerald-500"
                            icon={<PackageCheck className="text-emerald-600" />}
                        />
                        <InventoryRow
                            label="Low stock"
                            count={data.inventory.lowStockProducts}
                            total={inventoryTotal}
                            className="bg-amber-500"
                            icon={<Boxes className="text-amber-600" />}
                        />
                        <InventoryRow
                            label="Out of stock"
                            count={data.inventory.outOfStockProducts}
                            total={inventoryTotal}
                            className="bg-red-500"
                            icon={<PackageX className="text-red-600" />}
                        />
                        <div className="grid grid-cols-3 gap-2 border-t pt-4 text-center">
                            <SmallNumber
                                label="Available"
                                value={data.inventory.availableQuantity}
                            />
                            <SmallNumber
                                label="Reserved"
                                value={data.inventory.reservedQuantity}
                            />
                            <SmallNumber
                                label="Total"
                                value={data.inventory.totalQuantity}
                            />
                        </div>
                        <Link
                            to="/inventory"
                            className={buttonVariants({ variant: "outline", className: "w-full" })}
                        >
                            Open inventory <ArrowRight />
                        </Link>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <ProductRanking
                    title="Most viewed products"
                    description="What visitors are looking at most on the storefront."
                    items={data.topViewedProducts}
                    currency={data.kpis.currency}
                    mode="views"
                />
                <ProductRanking
                    title="Top selling products"
                    description="Best performing delivered products by quantity."
                    items={data.topSellingProducts}
                    currency={data.kpis.currency}
                    mode="sales"
                />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
                <Card className="overflow-hidden">
                    <CardHeader className="flex-row items-center justify-between border-b">
                        <div>
                            <CardTitle>Recent orders</CardTitle>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Latest customer activity requiring attention.
                            </p>
                        </div>
                        <Link
                            to="/orders"
                            className={buttonVariants({ variant: "ghost", size: "sm" })}
                        >
                            All orders <ArrowRight />
                        </Link>
                    </CardHeader>
                    <CardContent className="px-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Order</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.recentOrders.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell>
                                            <Link
                                                to={`/orders/${order.id}`}
                                                className="font-semibold hover:text-primary"
                                            >
                                                {order.orderNumber}
                                            </Link>
                                            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                                <Clock3 className="size-3" />
                                                {new Date(
                                                    order.createdAt,
                                                ).toLocaleString()}
                                            </p>
                                        </TableCell>
                                        <TableCell>{order.customerName}</TableCell>
                                        <TableCell>
                                            <StatusBadge value={order.status} />
                                        </TableCell>
                                        <TableCell className="font-semibold">
                                            {formatMoney(order.total, order.currency)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {!data.recentOrders.length && (
                                    <TableRow>
                                        <TableCell
                                            colSpan={4}
                                            className="h-28 text-center text-muted-foreground"
                                        >
                                            No orders yet.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex-row items-center justify-between border-b">
                        <div>
                            <CardTitle>Stock attention</CardTitle>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Products at or below their reorder point.
                            </p>
                        </div>
                        <AlertTriangle className="size-5 text-amber-500" />
                    </CardHeader>
                    <CardContent className="divide-y px-0">
                        {data.lowStockProducts.map((item) => (
                            <Link
                                key={item.productId}
                                to={`/products/${item.productId}`}
                                className="flex items-center gap-3 px-5 py-3 transition hover:bg-muted/50"
                            >
                                <ProductImage
                                    src={item.imageUrl}
                                    name={item.name}
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium">
                                        {item.name}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Reorder at {item.minimumQuantity.toLocaleString()}
                                    </p>
                                </div>
                                <Badge
                                    variant={
                                        item.availableQuantity <= 0
                                            ? "destructive"
                                            : "secondary"
                                    }
                                >
                                    {item.availableQuantity.toLocaleString()} left
                                </Badge>
                            </Link>
                        ))}
                        {!data.lowStockProducts.length && (
                            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                                Stock levels look healthy.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function MetricCard({
    label,
    value,
    help,
    icon,
}: {
    label: string;
    value: string;
    help: string;
    icon: React.ReactNode;
}) {
    return (
        <Card className="overflow-hidden">
            <CardContent className="relative p-5">
                <div className="absolute right-0 top-0 size-24 translate-x-8 -translate-y-8 rounded-full bg-primary/5" />
                <div className="relative flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground">
                            {label}
                        </p>
                        <p className="mt-2 text-2xl font-bold tracking-tight">
                            {value}
                        </p>
                        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                            {help}
                        </p>
                    </div>
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary [&_svg]:size-5">
                        {icon}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}

function SalesChart({
    points,
    currency,
}: {
    points: SalesTrendPoint[];
    currency: string;
}) {
    const max = Math.max(...points.map((point) => point.revenue), 1);
    const totalOrders = points.reduce((sum, point) => sum + point.orders, 0);
    const totalRevenue = points.reduce((sum, point) => sum + point.revenue, 0);

    return (
        <div>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-xs text-muted-foreground">Paid revenue</p>
                    <p className="mt-1 text-2xl font-bold">
                        {formatMoney(totalRevenue, currency)}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-muted-foreground">Orders placed</p>
                    <p className="mt-1 text-lg font-semibold">
                        {totalOrders.toLocaleString()}
                    </p>
                </div>
            </div>
            <div className="flex h-44 items-end gap-1 rounded-xl border bg-muted/20 px-3 pt-4">
                {points.map((point, index) => {
                    const height = Math.max((point.revenue / max) * 100, point.orders ? 8 : 2);
                    return (
                        <div
                            key={point.date}
                            className="group relative flex h-full flex-1 items-end"
                            title={`${new Date(point.date).toLocaleDateString()}: ${formatMoney(point.revenue, currency)}, ${point.orders} orders`}
                        >
                            <div
                                className="w-full rounded-t bg-primary/70 transition group-hover:bg-primary"
                                style={{ height: `${height}%` }}
                            />
                            {(index === 0 || index === points.length - 1) && (
                                <span className="absolute -bottom-5 text-[9px] text-muted-foreground">
                                    {new Date(point.date).toLocaleDateString(undefined, {
                                        month: "short",
                                        day: "numeric",
                                    })}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="h-5" />
        </div>
    );
}

function InventoryRow({
    label,
    count,
    total,
    className,
    icon,
}: {
    label: string;
    count: number;
    total: number;
    className: string;
    icon: React.ReactNode;
}) {
    const percentage = total ? Math.round((count / total) * 100) : 0;
    return (
        <div>
            <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 [&_svg]:size-4">
                    {icon}
                    <span className="text-sm font-medium">{label}</span>
                </div>
                <span className="text-xs font-semibold">
                    {count} · {percentage}%
                </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                    className={`h-full rounded-full ${className}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}

function SmallNumber({ label, value }: { label: string; value: number }) {
    return (
        <div>
            <p className="font-semibold">{value.toLocaleString()}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{label}</p>
        </div>
    );
}

function ProductRanking({
    title,
    description,
    items,
    currency,
    mode,
}: {
    title: string;
    description: string;
    items: TopProductItem[];
    currency: string;
    mode: "views" | "sales";
}) {
    return (
        <Card>
            <CardHeader className="border-b">
                <CardTitle>{title}</CardTitle>
                <p className="text-xs text-muted-foreground">{description}</p>
            </CardHeader>
            <CardContent className="divide-y px-0">
                {items.map((item, index) => (
                    <Link
                        key={item.productId}
                        to={`/products/${item.productId}`}
                        className="flex items-center gap-3 px-5 py-3 transition hover:bg-muted/50"
                    >
                        <span className="w-5 text-center text-xs font-bold text-muted-foreground">
                            {index + 1}
                        </span>
                        <ProductImage src={item.imageUrl} name={item.name} />
                        <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{item.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {mode === "views"
                                    ? `${item.viewCount.toLocaleString()} storefront views`
                                    : `${item.quantitySold.toLocaleString()} units sold`}
                            </p>
                        </div>
                        {mode === "sales" && (
                            <span className="text-xs font-semibold">
                                {formatMoney(item.revenue, currency)}
                            </span>
                        )}
                    </Link>
                ))}
                {!items.length && (
                    <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                        No product activity yet.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function ProductImage({ src, name }: { src: string | null; name: string }) {
    const url = resolveProductImageUrl(src);
    return url ? (
        <img
            src={url}
            alt=""
            className="size-10 rounded-lg border object-cover"
        />
    ) : (
        <span className="grid size-10 place-items-center rounded-lg border bg-muted text-xs font-bold text-muted-foreground">
            {name.charAt(0).toUpperCase()}
        </span>
    );
}

function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-4 w-96 max-w-full" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-32" />
                ))}
            </div>
            <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
                <Skeleton className="h-80" />
                <Skeleton className="h-80" />
            </div>
        </div>
    );
}
