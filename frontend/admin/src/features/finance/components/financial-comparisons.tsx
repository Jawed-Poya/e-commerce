import { ArrowDownRight, ArrowUpRight, Building2, Scale, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminAuth } from "@/features/auth/auth-context";
import { hasPermission, Permissions } from "@/features/auth/permissions";
import { useI18n } from "@/i18n/i18n-provider";
import { formatPercent, toFiniteNumber } from "@/lib/numbers";
import type { BusinessPartyMetric, FinancialReport } from "../finance-types";

export function FinancialComparisons({
    report,
    money,
}: {
    report: FinancialReport;
    money: (value: number) => string;
}) {
    const { tr } = useI18n();
    const { user } = useAdminAuth();
    const sales = toFiniteNumber(report.totalRevenue);
    const purchases = toFiniteNumber(report.purchases);
    const difference = sales - purchases;
    const maximum = Math.max(1, Math.abs(sales), Math.abs(purchases));
    const ratio = purchases > 0 ? sales / purchases * 100 : null;
    const canViewCustomers = hasPermission(user, Permissions.CustomersView);
    const canViewSuppliers = hasPermission(user, Permissions.PurchasesView);
    const rowCount = Math.max(report.topCustomers.length, report.topSuppliers.length);

    return (
        <div className="grid gap-6 xl:grid-cols-2">
            <Card className="shadow-none">
                <CardHeader className="gap-2">
                    <CardTitle className="flex items-center gap-2">
                        <Scale className="size-5 text-primary" />
                        {tr("Sales compared with purchases")}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                        {tr("Direct comparison for the selected report period, branch, and currency.")}
                    </p>
                </CardHeader>
                <CardContent className="space-y-5">
                    <ComparisonBar
                        label={tr("Sales")}
                        value={sales}
                        maximum={maximum}
                        formatted={money(sales)}
                        className="bg-emerald-500"
                    />
                    <ComparisonBar
                        label={tr("Purchases")}
                        value={purchases}
                        maximum={maximum}
                        formatted={money(purchases)}
                        className="bg-sky-500"
                    />

                    <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
                        <div className="rounded-xl bg-muted/35 p-4 ring-1 ring-foreground/5">
                            <p className="text-xs text-muted-foreground">{tr("Sales − purchases")}</p>
                            <p className={`mt-2 flex items-center gap-2 text-lg font-bold tabular-nums ${difference >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                                {difference >= 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                                {money(difference)}
                            </p>
                        </div>
                        <div className="rounded-xl bg-muted/35 p-4 ring-1 ring-foreground/5">
                            <p className="text-xs text-muted-foreground">{tr("Sales-to-purchase ratio")}</p>
                            <p className="mt-2 text-lg font-bold tabular-nums">
                                {ratio == null ? tr("No purchases") : formatPercent(ratio)}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-none">
                <CardHeader className="gap-2">
                    <CardTitle className="flex items-center gap-2">
                        <UsersRound className="size-5 text-primary" />
                        {tr("Customers compared with supplier companies")}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                        {tr("Compare leading customers and suppliers side by side; balances remain visible for collection and payment decisions.")}
                    </p>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <BalanceSummary
                            icon={<UsersRound />}
                            label={tr("Customer receivables")}
                            value={money(report.outstandingReceivables)}
                            tone="customer"
                        />
                        <BalanceSummary
                            icon={<Building2 />}
                            label={tr("Supplier-company payables")}
                            value={money(report.outstandingSupplierPayables)}
                            tone="supplier"
                        />
                    </div>

                    <div className="overflow-hidden rounded-xl border">
                        <div className="grid grid-cols-2 border-b bg-muted/40 text-xs font-semibold">
                            <div className="border-e px-3 py-2.5">{tr("Customers · sales")}</div>
                            <div className="px-3 py-2.5">{tr("Supplier companies · purchases")}</div>
                        </div>
                        {rowCount ? Array.from({ length: rowCount }, (_, index) => (
                            <div key={index} className="grid grid-cols-2 border-b last:border-b-0">
                                <PartyCell
                                    item={report.topCustomers[index]}
                                    rank={index + 1}
                                    money={money}
                                    href={canViewCustomers && report.topCustomers[index]?.id ? `/customers/${report.topCustomers[index].id}` : null}
                                />
                                <PartyCell
                                    item={report.topSuppliers[index]}
                                    rank={index + 1}
                                    money={money}
                                    href={canViewSuppliers && report.topSuppliers[index]?.id ? `/operations/purchases?tab=suppliers&supplierId=${report.topSuppliers[index].id}` : null}
                                    supplier
                                />
                            </div>
                        )) : (
                            <p className="py-10 text-center text-sm text-muted-foreground">{tr("No customer or supplier transactions in this period.")}</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function ComparisonBar({ label, value, maximum, formatted, className }: { label: string; value: number; maximum: number; formatted: string; className: string }) {
    const width = Math.max(value === 0 ? 0 : 3, Math.min(100, Math.abs(value) / maximum * 100));
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium">{label}</span>
                <span className="font-bold tabular-nums">{formatted}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full transition-[width] ${className}`} style={{ width: `${width}%` }} />
            </div>
        </div>
    );
}

function BalanceSummary({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: "customer" | "supplier" }) {
    return (
        <div className="flex items-center gap-3 rounded-xl bg-muted/35 p-3 ring-1 ring-foreground/5">
            <span className={`grid size-9 shrink-0 place-items-center rounded-lg [&_svg]:size-4 ${tone === "customer" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-sky-500/10 text-sky-700 dark:text-sky-400"}`}>
                {icon}
            </span>
            <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">{label}</p>
                <p className="font-bold tabular-nums">{value}</p>
            </div>
        </div>
    );
}

function PartyCell({ item, rank, money, href, supplier = false }: { item?: BusinessPartyMetric; rank: number; money: (value: number) => string; href: string | null; supplier?: boolean }) {
    const { tr } = useI18n();
    if (!item) return <div className={`min-h-20 bg-muted/10 ${supplier ? "" : "border-e"}`} />;
    const name = href ? <Link className="truncate font-semibold hover:text-primary hover:underline" to={href}>{item.name}</Link> : <p className="truncate font-semibold">{item.name}</p>;
    return (
        <div className={`min-w-0 p-3 ${supplier ? "" : "border-e"}`}>
            <div className="flex items-center gap-2">
                <Badge variant="outline" className="size-6 shrink-0 justify-center p-0">{rank}</Badge>
                <div className="min-w-0 flex-1">
                    {name}
                    <p className="text-[11px] text-muted-foreground">
                        {item.transactionCount} {tr("transactions")} · {tr("balance")} {money(item.balance)}
                    </p>
                </div>
            </div>
            <p className="mt-2 text-end text-sm font-bold tabular-nums">{money(item.amount)}</p>
        </div>
    );
}
