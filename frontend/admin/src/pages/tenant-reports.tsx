import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Download,
    HandCoins,
    LoaderCircle,
    RefreshCw,
    Search,
    TrendingDown,
    TrendingUp,
    WalletCards,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SimpleCombobox } from "@/components/simple-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tenantService } from "@/features/tenancy/tenant-service";
import type { TenantReportLine } from "@/features/tenancy/tenant-types";
import { useTenant } from "@/features/tenancy/tenant-context";
import { useI18n } from "@/i18n/i18n-provider";

const iso = (date: Date) => date.toISOString().slice(0, 10);
const today = new Date();
const monthAgo = new Date(today);
monthAgo.setDate(today.getDate() - 29);

export default function TenantReportsPage() {
    const { t, language } = useI18n();
    const { formatMoney } = useTenant();
    const [filters, setFilters] = useState({
        startDate: iso(monthAgo),
        endDate: iso(today),
        branchId: "",
        currencyCode: "",
        source: "",
        status: "",
        search: "",
        minimumAmount: "",
        maximumAmount: "",
        sort: "date-desc",
        page: 1,
        pageSize: 25,
    });
    const profile = useQuery({ queryKey: ["tenant", "profile"], queryFn: tenantService.profile });
    const query = useQuery({
        queryKey: ["tenant-reports", filters],
        queryFn: () => tenantService.reports({
            ...filters,
            branchId: filters.branchId || undefined,
            currencyCode: filters.currencyCode || undefined,
            minimumAmount: filters.minimumAmount || undefined,
            maximumAmount: filters.maximumAmount || undefined,
        }),
    });
    const data = query.data;
    const maximum = useMemo(
        () => Math.max(1, ...(data?.trend.map(item => Math.max(item.revenue, item.cost)) ?? [1])),
        [data],
    );

    useEffect(() => {
        if (!data || filters.currencyCode) return;
        setFilters(current => ({ ...current, currencyCode: data.currencyCode }));
    }, [data, filters.currencyCode]);

    const money = (value: number) => formatMoney(value, data?.currencyCode);
    const exportCsv = () => {
        if (!data) return;
        const rows = [
            ["Source", "Reference", "Date", "Description", "Status", "Amount", "Paid", "Balance", "Currency", "Direction", "Branch"],
            ...data.results.map(item => [
                item.source,
                item.reference,
                item.date,
                item.description,
                item.status,
                String(item.amount),
                String(item.paidAmount),
                String(item.balanceAmount),
                item.currencyCode,
                item.direction,
                item.branchName ?? "",
            ]),
        ];
        const csv = rows
            .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(","))
            .join("\n");
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        link.download = `tenant-report-${data.currencyCode}-${filters.startDate}-${filters.endDate}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title={t("reports.title")}
                description={t("reports.description")}
                actions={
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
                            <RefreshCw className={query.isFetching ? "animate-spin" : ""} />
                            {t("reports.refresh")}
                        </Button>
                        <Button onClick={exportCsv} disabled={!data}>
                            <Download />
                            {t("reports.export")}
                        </Button>
                    </div>
                }
            />

            <Card className="overflow-hidden">
                <CardHeader className="border-b bg-muted/20 px-4 py-4 sm:px-5">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle className="text-base">{t("reports.filtersTitle")}</CardTitle>
                            <p className="mt-1 text-xs text-muted-foreground">{t("reports.filtersHelp")}</p>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full sm:w-auto"
                            onClick={() => setFilters({
                                startDate: iso(monthAgo),
                                endDate: iso(today),
                                branchId: "",
                                currencyCode: data?.currencyCode ?? "",
                                source: "",
                                status: "",
                                search: "",
                                minimumAmount: "",
                                maximumAmount: "",
                                sort: "date-desc",
                                page: 1,
                                pageSize: 25,
                            })}
                        >
                            {t("reports.resetFilters")}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="grid min-w-0 gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3 2xl:grid-cols-4">
                    <Filter label={t("reports.from")}>
                        <Input type="date" value={filters.startDate} onChange={event => setFilters(value => ({ ...value, startDate: event.target.value, page: 1 }))} />
                    </Filter>
                    <Filter label={t("reports.to")}>
                        <Input type="date" value={filters.endDate} onChange={event => setFilters(value => ({ ...value, endDate: event.target.value, page: 1 }))} />
                    </Filter>
                    <Filter label={t("reports.branch")}>
                        <SimpleCombobox
                            value={filters.branchId}
                            onValueChange={value => setFilters(current => ({ ...current, branchId: value ?? "", page: 1 }))}
                            options={[
                                { value: "", label: t("reports.allBranches") },
                                ...(profile.data?.branches.map(item => ({ value: String(item.id), label: item.name, description: item.code })) ?? []),
                            ]}
                        />
                    </Filter>
                    <Filter label={t("reports.currency")}>
                        <SimpleCombobox
                            value={filters.currencyCode}
                            onValueChange={value => setFilters(current => ({ ...current, currencyCode: value ?? "", page: 1 }))}
                            options={(data?.availableCurrencies ?? [profile.data?.settings.mainCurrencyCode ?? "USD"]).map(value => ({ value, label: value }))}
                        />
                    </Filter>
                    <Filter label={t("reports.source")}>
                        <SimpleCombobox
                            value={filters.source}
                            onValueChange={value => setFilters(current => ({ ...current, source: value ?? "", page: 1 }))}
                            options={[
                                { value: "", label: t("reports.allSources") },
                                { value: "orders", label: t("reports.onlineOrders") },
                                { value: "manual-sales", label: t("reports.manualSales") },
                                { value: "purchases", label: t("reports.purchases") },
                                { value: "expenses", label: t("reports.expenses") },
                                { value: "payroll", label: t("reports.payroll") },
                            ]}
                        />
                    </Filter>
                    <Filter label={t("reports.minimum")}>
                        <Input type="number" min={0} value={filters.minimumAmount} onChange={event => setFilters(value => ({ ...value, minimumAmount: event.target.value, page: 1 }))} />
                    </Filter>
                    <Filter label={t("reports.maximum")}>
                        <Input type="number" min={0} value={filters.maximumAmount} onChange={event => setFilters(value => ({ ...value, maximumAmount: event.target.value, page: 1 }))} />
                    </Filter>
                    <Filter label={t("reports.sort")}>
                        <SimpleCombobox
                            value={filters.sort}
                            onValueChange={value => value && setFilters(current => ({ ...current, sort: value }))}
                            options={[
                                { value: "date-desc", label: t("reports.newest") },
                                { value: "date-asc", label: t("reports.oldest") },
                                { value: "amount-desc", label: t("reports.highest") },
                                { value: "amount-asc", label: t("reports.lowest") },
                            ]}
                        />
                    </Filter>
                    <Filter label={t("reports.search")} className="sm:col-span-2 lg:col-span-3 2xl:col-span-2">
                        <div className="relative">
                            <Search className="absolute start-3 top-2.5 size-4 text-muted-foreground" />
                            <Input
                                className="ps-9"
                                value={filters.search}
                                onChange={event => setFilters(value => ({ ...value, search: event.target.value, page: 1 }))}
                                placeholder={t("reports.referencePlaceholder")}
                            />
                        </div>
                    </Filter>
                </CardContent>
            </Card>

            {query.isLoading ? (
                <div className="grid min-h-64 place-items-center"><LoaderCircle className="animate-spin" /></div>
            ) : data ? (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <Metric icon={<TrendingUp />} label={t("reports.grossRevenue")} value={money(data.totalRevenue)} help={`${data.onlineOrders + data.manualSales} ${t("reports.records")}`} tone="positive" />
                        <Metric icon={<HandCoins />} label={t("reports.cashReceived")} value={money(data.cashReceived)} help={`${t("reports.receivables")}: ${money(data.outstandingReceivables)}`} tone="positive" />
                        <Metric icon={<TrendingDown />} label={t("reports.cashPaid")} value={money(data.cashPaid)} help={`${t("reports.supplierPayables")}: ${money(data.outstandingSupplierPayables)}`} tone="negative" />
                        <Metric icon={<WalletCards />} label={t("reports.netCashFlow")} value={money(data.netCashFlow)} help={`${t("reports.operatingBalance")}: ${money(data.operatingBalance)}`} tone={data.netCashFlow >= 0 ? "positive" : "negative"} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <CompactMetric label={t("reports.receivables")} value={money(data.outstandingReceivables)} />
                        <CompactMetric label={t("reports.supplierPayables")} value={money(data.outstandingSupplierPayables)} />
                        <CompactMetric label={t("reports.payrollDue")} value={money(data.outstandingPayroll)} />
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
                        <Card>
                            <CardHeader><CardTitle>{t("reports.cashTrend")}</CardTitle></CardHeader>
                            <CardContent>
                                <div className="flex h-64 items-end gap-1 overflow-x-auto pb-7">
                                    {data.trend.map(point => (
                                        <div key={point.date} className="group relative flex min-w-8 flex-1 items-end justify-center gap-1" title={`${point.date}: ${money(point.revenue)} / ${money(point.cost)}`}>
                                            <div className="w-2.5 bg-primary transition-opacity group-hover:opacity-70" style={{ height: `${Math.max(2, point.revenue / maximum * 210)}px` }} />
                                            <div className="w-2.5 bg-destructive/70 transition-opacity group-hover:opacity-70" style={{ height: `${Math.max(2, point.cost / maximum * 210)}px` }} />
                                            <span className="absolute -bottom-6 -rotate-45 text-[9px] text-muted-foreground rtl:rotate-45">{point.date.slice(5)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 flex gap-4 text-xs">
                                    <span className="flex items-center gap-2"><i className="size-2 bg-primary" />{t("reports.received")}</span>
                                    <span className="flex items-center gap-2"><i className="size-2 bg-destructive/70" />{t("reports.paid")}</span>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader><CardTitle>{t("reports.topProducts")}</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                {data.topProducts.length ? data.topProducts.map((item, index) => (
                                    <div key={item.productId} className="flex items-center gap-3">
                                        <span className="grid size-8 shrink-0 place-items-center bg-muted text-xs font-bold">{index + 1}</span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-medium">{item.productName}</p>
                                            <p className="text-xs text-muted-foreground">{item.quantity} {t("reports.units")}</p>
                                        </div>
                                        <span className="text-sm font-bold">{money(item.revenue)}</span>
                                    </div>
                                )) : <p className="text-sm text-muted-foreground">{t("reports.noProductSales")}</p>}
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between gap-3">
                                <CardTitle>{t("reports.filteredResult")}</CardTitle>
                                <Badge variant="outline">{data.totalResults} {t("reports.records")}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="hidden overflow-x-auto md:block">
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead>{t("reports.sourceColumn")}</TableHead><TableHead>{t("reports.reference")}</TableHead><TableHead>{t("reports.date")}</TableHead>
                                        <TableHead>{t("reports.descriptionColumn")}</TableHead><TableHead>{t("reports.branchColumn")}</TableHead><TableHead>{t("reports.statusColumn")}</TableHead>
                                        <TableHead className="text-end">{t("reports.amount")}</TableHead><TableHead className="text-end">{t("reports.paidAmount")}</TableHead><TableHead className="text-end">{t("reports.balance")}</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {data.results.map(item => <ReportRow key={`${item.source}-${item.id}`} item={item} money={money} locale={language} t={t} />)}
                                        {!data.results.length && <TableRow><TableCell colSpan={9} className="h-32 text-center text-muted-foreground">{t("reports.noMatches")}</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="grid gap-3 p-4 md:hidden">
                                {data.results.map(item => <ReportCard key={`${item.source}-${item.id}`} item={item} money={money} locale={language} t={t} />)}
                                {!data.results.length && <p className="py-12 text-center text-sm text-muted-foreground">{t("reports.noMatches")}</p>}
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
                                <p className="text-xs text-muted-foreground">{t("reports.page")} {data.page} · {t("reports.showing")} {data.results.length}</p>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" disabled={filters.page <= 1} onClick={() => setFilters(value => ({ ...value, page: value.page - 1 }))}>{t("reports.previous")}</Button>
                                    <Button variant="outline" size="sm" disabled={filters.page * filters.pageSize >= data.totalResults} onClick={() => setFilters(value => ({ ...value, page: value.page + 1 }))}>{t("reports.next")}</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </>
            ) : (
                <Card><CardContent className="p-8 text-center text-destructive">{t("reports.loadError")}</CardContent></Card>
            )}
        </div>
    );
}

function ReportRow({ item, money, locale, t }: { item: TenantReportLine; money: (value: number) => string; locale: string; t: ReturnType<typeof useI18n>["t"] }) {
    return (
        <TableRow>
            <TableCell><Badge variant="secondary">{item.source}</Badge></TableCell>
            <TableCell className="font-medium">{item.reference}</TableCell>
            <TableCell>{new Date(item.date).toLocaleDateString(locale)}</TableCell>
            <TableCell className="max-w-sm"><p className="truncate">{item.description}</p></TableCell>
            <TableCell>{item.branchName ?? t("reports.company")}</TableCell>
            <TableCell>{item.status}</TableCell>
            <TableCell className={`text-end font-bold ${item.direction === "in" ? "text-emerald-600" : "text-destructive"}`}>{item.direction === "in" ? "+" : "−"}{money(item.amount)}</TableCell>
            <TableCell className="text-end">{money(item.paidAmount)}</TableCell>
            <TableCell className="text-end font-semibold">{money(item.balanceAmount)}</TableCell>
        </TableRow>
    );
}

function ReportCard({ item, money, locale, t }: { item: TenantReportLine; money: (value: number) => string; locale: string; t: ReturnType<typeof useI18n>["t"] }) {
    return (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><Badge variant="secondary">{item.source}</Badge><p className="mt-2 truncate font-semibold">{item.reference}</p></div>
                <p className={`shrink-0 font-bold ${item.direction === "in" ? "text-emerald-600" : "text-destructive"}`}>{item.direction === "in" ? "+" : "−"}{money(item.amount)}</p>
            </div>
            <p className="mt-3 text-sm">{item.description}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-xs">
                <Value label={t("reports.paidAmount")} value={money(item.paidAmount)} />
                <Value label={t("reports.balance")} value={money(item.balanceAmount)} />
                <Value label={t("reports.branchColumn")} value={item.branchName ?? t("reports.company")} />
                <Value label={t("reports.date")} value={new Date(item.date).toLocaleDateString(locale)} />
            </div>
        </div>
    );
}

function Filter({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
    return <div className={`min-w-0 space-y-2 ${className}`}><Label className="text-xs font-medium">{label}</Label><div className="min-w-0">{children}</div></div>;
}
function Metric({ icon, label, value, help, tone }: { icon: React.ReactNode; label: string; value: string; help: string; tone?: "positive" | "negative" }) {
    return <Card className="overflow-hidden"><CardContent className="relative p-5"><div className={`absolute inset-y-0 start-0 w-1 ${tone === "positive" ? "bg-emerald-500" : tone === "negative" ? "bg-destructive" : "bg-primary"}`} /><div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{label}</span><span className="text-primary">{icon}</span></div><p className="mt-4 text-2xl font-black tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{help}</p></CardContent></Card>;
}
function CompactMetric({ label, value }: { label: string; value: string }) {
    return <Card><CardContent className="flex items-center justify-between gap-4 p-4"><span className="text-sm text-muted-foreground">{label}</span><span className="font-bold tabular-nums">{value}</span></CardContent></Card>;
}
function Value({ label, value }: { label: string; value: string }) {
    return <div><p className="text-muted-foreground">{label}</p><p className="mt-1 truncate font-medium text-foreground">{value}</p></div>;
}
