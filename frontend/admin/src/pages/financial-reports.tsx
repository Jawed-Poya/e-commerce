import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BarChart3, Building2, CalendarRange, FileSpreadsheet, FileText, Landmark, LoaderCircle, RefreshCw, Search, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { SimpleCombobox } from "@/components/simple-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { companyService } from "@/features/company/company-service";
import type { FinancialReportFilters } from "@/features/company/company-types";
import { useCompany } from "@/features/company/company-context";

const iso = (date: Date) => {
    const value = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return value.toISOString().slice(0, 10);
};
const today = new Date();
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

export default function FinancialReportsPage() {
    const { formatMoney } = useCompany();
    const [filters, setFilters] = useState<Required<Pick<FinancialReportFilters, "startDate" | "endDate" | "sort" | "page" | "pageSize">> & {
        branchId: string; currencyCode: string; source: string; status: string; search: string; minimumAmount: string; maximumAmount: string;
    }>({
        startDate: iso(monthStart),
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

    const request = useMemo<FinancialReportFilters>(() => ({
        ...filters,
        branchId: filters.branchId || undefined,
        currencyCode: filters.currencyCode || undefined,
        source: filters.source || undefined,
        status: filters.status || undefined,
        search: filters.search || undefined,
        minimumAmount: filters.minimumAmount || undefined,
        maximumAmount: filters.maximumAmount || undefined,
    }), [filters]);

    const company = useQuery({ queryKey: ["company", "profile"], queryFn: companyService.profile });
    const report = useQuery({ queryKey: ["financial-report", request], queryFn: () => companyService.financialReport(request) });
    const worth = useQuery({
        queryKey: ["company-worth", filters.endDate, filters.startDate, filters.branchId, report.data?.currencyCode],
        queryFn: () => companyService.companyWorth({
            asOfDate: filters.endDate,
            periodStartDate: filters.startDate,
            branchId: filters.branchId || undefined,
            currencyCode: report.data?.currencyCode || filters.currencyCode || undefined,
        }),
        enabled: Boolean(report.data),
    });
    const exportFile = useMutation({
        mutationFn: (format: "excel" | "pdf") => companyService.exportFinancialReport(format, request),
        onError: (error) => toast.error(message(error)),
    });

    const salesPdf = useMutation({
        mutationFn: () => companyService.exportOperationalPdf("sales", {
            startDate: filters.startDate,
            endDate: filters.endDate,
            branchId: filters.branchId || undefined,
            currencyCode: filters.currencyCode || undefined,
            search: filters.search || undefined,
        }),
        onSuccess: () => toast.success("Sales PDF generated."),
        onError: (error) => toast.error(message(error)),
    });

    const data = report.data;
    const currency = data?.currencyCode;
    const money = (value: number) => formatMoney(value, currency);
    const totalPages = data ? Math.max(1, Math.ceil(data.totalResults / data.pageSize)) : 1;
    const chartMaximum = Math.max(1, ...(data?.profitTrend.flatMap((item) => [Math.abs(item.revenue), Math.abs(item.cost), Math.abs(item.net)]) ?? [1]));

    const applyPreset = (preset: "today" | "week" | "month" | "year") => {
        const end = new Date();
        let start = new Date(end);
        if (preset === "week") start.setDate(end.getDate() - ((end.getDay() + 6) % 7));
        if (preset === "month") start = new Date(end.getFullYear(), end.getMonth(), 1);
        if (preset === "year") start = new Date(end.getFullYear(), 0, 1);
        setFilters((current) => ({ ...current, startDate: iso(start), endDate: iso(end), page: 1 }));
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Financial intelligence"
                description="Profit and loss, cash flow, receivables, company worth, and transaction-level reporting from one source of truth."
                actions={<div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => report.refetch()} disabled={report.isFetching}><RefreshCw className={report.isFetching ? "animate-spin" : ""} /> Refresh</Button>
                    <Button variant="outline" disabled={!data || exportFile.isPending} onClick={() => exportFile.mutate("excel")}><FileSpreadsheet /> Excel</Button>
                    <Button variant="outline" disabled={salesPdf.isPending} onClick={() => salesPdf.mutate()}><FileText /> Sales PDF</Button>
                    <Button disabled={!data || exportFile.isPending} onClick={() => exportFile.mutate("pdf")}><FileText /> Financial PDF</Button>
                </div>}
            />

            <Card className="shadow-none">
                <CardHeader className="border-b bg-muted/20"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><CardTitle className="flex items-center gap-2"><CalendarRange className="size-5 text-primary" /> Reporting range</CardTitle><p className="mt-1 text-xs text-muted-foreground">Use a preset or choose any custom date range up to two years.</p></div><div className="flex flex-wrap gap-2">{(["today", "week", "month", "year"] as const).map((item) => <Button key={item} size="sm" variant="outline" onClick={() => applyPreset(item)}>{item === "today" ? "Today" : `This ${item}`}</Button>)}</div></div></CardHeader>
                <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                    <Field label="Start"><Input type="date" value={filters.startDate} onChange={(event) => setFilters({ ...filters, startDate: event.target.value, page: 1 })} /></Field>
                    <Field label="End"><Input type="date" value={filters.endDate} onChange={(event) => setFilters({ ...filters, endDate: event.target.value, page: 1 })} /></Field>
                    <Field label="Branch"><SimpleCombobox value={filters.branchId} onValueChange={(value) => setFilters({ ...filters, branchId: value ?? "", page: 1 })} options={[{ value: "", label: "All branches" }, ...(company.data?.branches ?? []).map((branch) => ({ value: String(branch.id), label: branch.name }))]} /></Field>
                    <Field label="Currency"><SimpleCombobox value={filters.currencyCode || data?.currencyCode || ""} onValueChange={(value) => setFilters({ ...filters, currencyCode: value ?? "", page: 1 })} options={(data?.availableCurrencies ?? []).map((value) => ({ value, label: value }))} placeholder="Main currency" /></Field>
                    <Field label="Source"><SimpleCombobox value={filters.source} onValueChange={(value) => setFilters({ ...filters, source: value ?? "", page: 1 })} options={[{ value: "", label: "All transactions" }, { value: "orders", label: "Online orders" }, { value: "manual-sales", label: "Manual sales" }, { value: "purchases", label: "Purchases" }, { value: "expenses", label: "Expenses" }, { value: "payroll", label: "Payroll" }]} /></Field>
                    <Field label="Sort"><SimpleCombobox value={filters.sort} onValueChange={(value) => value && setFilters({ ...filters, sort: value, page: 1 })} options={[{ value: "date-desc", label: "Newest first" }, { value: "date-asc", label: "Oldest first" }, { value: "amount-desc", label: "Highest amount" }, { value: "amount-asc", label: "Lowest amount" }]} /></Field>
                    <div className="relative sm:col-span-2 xl:col-span-3"><Label>Search</Label><Search className="pointer-events-none absolute bottom-2.5 left-3 size-4 text-muted-foreground" /><Input className="mt-2 pl-9" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })} placeholder="Reference, customer, supplier, branch…" /></div>
                    <Field label="Minimum"><Input type="number" min={0} value={filters.minimumAmount} onChange={(event) => setFilters({ ...filters, minimumAmount: event.target.value, page: 1 })} /></Field>
                    <Field label="Maximum"><Input type="number" min={0} value={filters.maximumAmount} onChange={(event) => setFilters({ ...filters, maximumAmount: event.target.value, page: 1 })} /></Field>
                    <Field label="Status"><Input value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value, page: 1 })} placeholder="Paid, pending…" /></Field>
                </CardContent>
            </Card>

            {report.isLoading ? <Card><CardContent className="grid min-h-72 place-items-center"><LoaderCircle className="size-7 animate-spin text-primary" /></CardContent></Card> : report.isError || !data ? <Card><CardContent className="p-8 text-center text-destructive">{message(report.error)}</CardContent></Card> : <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Metric title="Revenue" value={money(data.totalRevenue)} detail={`${money(data.onlineRevenue)} online · ${money(data.manualSalesRevenue)} manual`} icon={<TrendingUp />} tone="positive" />
                    <Metric title="Cost of goods sold" value={money(data.costOfGoodsSold)} detail="Cost snapshots from sold items" icon={<WalletCards />} />
                    <Metric title="Gross profit" value={money(data.grossProfit)} detail={`${data.grossMarginPercent.toFixed(2)}% gross margin`} icon={data.grossProfit >= 0 ? <TrendingUp /> : <TrendingDown />} tone={data.grossProfit >= 0 ? "positive" : "negative"} />
                    <Metric title="Net profit / loss" value={money(data.netProfit)} detail={`${data.netMarginPercent.toFixed(2)}% after expenses and payroll`} icon={data.netProfit >= 0 ? <TrendingUp /> : <TrendingDown />} tone={data.netProfit >= 0 ? "positive" : "negative"} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Metric title="Company worth" value={worth.data ? money(worth.data.netWorth) : "—"} detail={worth.data ? `${money(worth.data.totalAssets)} assets · ${money(worth.data.totalLiabilities)} liabilities` : "Calculating assets and liabilities"} icon={<Building2 />} tone={(worth.data?.netWorth ?? 0) >= 0 ? "positive" : "negative"} />
                    <Metric title="Cash position" value={worth.data ? money(worth.data.cashPosition) : money(data.netCashFlow)} detail={`${money(data.cashReceived)} in · ${money(data.cashPaid)} out`} icon={<Landmark />} />
                    <Metric title="Receivables" value={money(data.outstandingReceivables)} detail="Unpaid customer balances" icon={<WalletCards />} />
                    <Metric title="Payables" value={money(data.outstandingSupplierPayables + data.outstandingPayroll)} detail={`${money(data.outstandingSupplierPayables)} suppliers · ${money(data.outstandingPayroll)} payroll`} icon={<TrendingDown />} />
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,.65fr)]">
                    <Card className="shadow-none"><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="size-5 text-primary" /> Daily profit trend</CardTitle></CardHeader><CardContent><div className="flex h-64 items-end gap-1 overflow-x-auto border-b pb-2">{data.profitTrend.map((point) => <div key={point.date} className="group flex min-w-5 flex-1 flex-col items-center justify-end gap-1" title={`${point.date}\nRevenue ${money(point.revenue)}\nCost ${money(point.cost)}\nNet ${money(point.net)}`}><div className={`w-full min-w-2 rounded-t ${point.net >= 0 ? "bg-emerald-500/75" : "bg-red-500/75"}`} style={{ height: `${Math.max(3, (Math.abs(point.net) / chartMaximum) * 210)}px` }} /><span className="hidden text-[9px] text-muted-foreground group-hover:block">{point.date.slice(5)}</span></div>)}</div><div className="mt-3 flex gap-4 text-xs text-muted-foreground"><span><i className="me-1 inline-block size-2 rounded-full bg-emerald-500" /> Profit</span><span><i className="me-1 inline-block size-2 rounded-full bg-red-500" /> Loss</span></div></CardContent></Card>
                    <Card className="shadow-none"><CardHeader><CardTitle>Top products</CardTitle></CardHeader><CardContent className="space-y-3">{data.topProducts.length ? data.topProducts.map((product, index) => <div key={product.productId} className="flex items-center gap-3 rounded-xl border p-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{product.productName}</p><p className="text-xs text-muted-foreground">{product.quantity.toLocaleString()} sold</p></div><span className="text-sm font-semibold tabular-nums">{money(product.revenue)}</span></div>) : <p className="py-12 text-center text-sm text-muted-foreground">No product sales in this range.</p>}</CardContent></Card>
                </div>

                <Card className="overflow-hidden shadow-none">
                    <CardHeader className="border-b"><div className="flex items-center justify-between"><div><CardTitle>Transaction ledger</CardTitle><p className="mt-1 text-xs text-muted-foreground">{data.totalResults.toLocaleString()} matching records</p></div><Badge variant="secondary">Page {data.page} of {totalPages}</Badge></div></CardHeader>
                    <CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Source</TableHead><TableHead>Reference</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead><TableHead className="text-end">Amount</TableHead><TableHead className="text-end">Paid</TableHead><TableHead className="text-end">Balance</TableHead><TableHead>Branch</TableHead></TableRow></TableHeader><TableBody>{data.results.length ? data.results.map((item) => <TableRow key={`${item.source}-${item.id}`}><TableCell className="whitespace-nowrap">{new Date(item.date).toLocaleDateString()}</TableCell><TableCell><Badge variant="outline">{sourceLabel(item.source)}</Badge></TableCell><TableCell className="font-mono text-xs">{item.reference}</TableCell><TableCell className="max-w-64 truncate">{item.description}</TableCell><TableCell>{item.status}</TableCell><TableCell className={`text-end font-semibold tabular-nums ${item.direction === "in" ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>{item.direction === "out" ? "−" : "+"}{money(item.amount)}</TableCell><TableCell className="text-end tabular-nums">{money(item.paidAmount)}</TableCell><TableCell className="text-end tabular-nums">{money(item.balanceAmount)}</TableCell><TableCell>{item.branchName ?? "All company"}</TableCell></TableRow>) : <TableRow><TableCell colSpan={9} className="h-36 text-center text-muted-foreground">No transactions match these filters.</TableCell></TableRow>}</TableBody></Table></div></CardContent>
                    <div className="flex items-center justify-between border-t p-4"><p className="text-xs text-muted-foreground">Showing {data.results.length} of {data.totalResults}</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Previous</Button><Button size="sm" variant="outline" disabled={filters.page >= totalPages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next</Button></div></div>
                </Card>
            </>}
        </div>
    );
}

function Metric({ title, value, detail, icon, tone }: { title: string; value: string; detail: string; icon: React.ReactNode; tone?: "positive" | "negative" }) {
    return <Card className="shadow-none"><CardContent className="p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-medium text-muted-foreground">{title}</p><p className={`mt-2 text-2xl font-bold tracking-tight tabular-nums ${tone === "positive" ? "text-emerald-700 dark:text-emerald-400" : tone === "negative" ? "text-red-700 dark:text-red-400" : ""}`}>{value}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p></div><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary [&_svg]:size-5">{icon}</span></div></CardContent></Card>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function sourceLabel(value: string) { return ({ orders: "Online order", "manual-sales": "Manual sale", purchases: "Purchase", expenses: "Expense", payroll: "Payroll" } as Record<string, string>)[value] ?? value; }
function message(error: unknown) { return (error as { response?: { data?: { message?: string } }; message?: string } | null)?.response?.data?.message ?? (error as Error | null)?.message ?? "The report could not be loaded."; }
