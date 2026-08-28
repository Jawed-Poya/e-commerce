import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
    BarChart3,
    CalendarRange,
    LoaderCircle,
    PackageCheck,
    RotateCcw,
    ShoppingCart,
    TrendingUp,
    Truck,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCompany } from "@/features/company/company-context";
import { formatPercent } from "@/lib/numbers";
import { useI18n } from "@/i18n/i18n-provider";
import { financeService } from "../finance-service";

type Preset = "month" | "quarter" | "year";

export function ProductPerformanceCard({ productId }: { productId: number }) {
    const { company, formatMoney } = useCompany();
    const { tr } = useI18n();
    const [searchParams] = useSearchParams();
    const reportCurrency = searchParams.get("reportCurrency") || company?.settings.mainCurrencyCode;
    const reportBranch = positiveInteger(searchParams.get("reportBranch"));
    const [range, setRange] = useState(() => reportRange(searchParams));
    const params = useMemo(() => ({
        startDate: range.startDate,
        endDate: range.endDate,
        branchId: reportBranch,
        currencyCode: reportCurrency,
    }), [range.endDate, range.startDate, reportBranch, reportCurrency]);
    const report = useQuery({
        queryKey: ["product-performance", productId, params],
        queryFn: () => financeService.productPerformance(productId, params),
        enabled: Number.isFinite(productId) && productId > 0,
    });
    const data = report.data;
    const money = (value: number) => formatMoney(value, data?.currencyCode);
    const activeTrend = (data?.trend ?? []).filter(point => point.revenue || point.cost);
    const chartMaximum = Math.max(
        1,
        ...activeTrend.flatMap(point => [Math.abs(point.revenue), Math.abs(point.profit)]),
    );

    useEffect(() => {
        if (window.location.hash !== "#performance-report") return;
        const frame = window.requestAnimationFrame(() => {
            document.getElementById("performance-report")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        });
        return () => window.cancelAnimationFrame(frame);
    }, []);

    return (
        <Card id="performance-report" className="scroll-mt-6">
            <CardHeader className="gap-4 border-b">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="size-5 text-primary" />
                            {tr("Product performance report")}
                        </CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {tr("Individual sales, purchases, returns, stock value, and gross profit from one calculation source.")}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {(["month", "quarter", "year"] as Preset[]).map(preset => (
                            <Button key={preset} type="button" size="sm" variant="outline" onClick={() => setRange(presetDates(preset))}>
                                {tr(`This ${preset}`)}
                            </Button>
                        ))}
                    </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 sm:justify-self-end">
                    <label className="space-y-1 text-xs text-muted-foreground">
                        {tr("From")}
                        <Input type="date" value={range.startDate} onChange={event => setRange(current => ({ ...current, startDate: event.target.value }))} />
                    </label>
                    <label className="space-y-1 text-xs text-muted-foreground">
                        {tr("To")}
                        <Input type="date" value={range.endDate} onChange={event => setRange(current => ({ ...current, endDate: event.target.value }))} />
                    </label>
                </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-5">
                {report.isLoading ? (
                    <div className="grid h-48 place-items-center text-muted-foreground"><LoaderCircle className="size-6 animate-spin" /></div>
                ) : report.isError || !data ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                        {getErrorMessage(report.error)}
                    </div>
                ) : (
                    <>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <ReportMetric icon={<ShoppingCart />} label={tr("Quantity sold")} value={data.quantitySold.toLocaleString()} hint={`${data.salesTransactionCount.toLocaleString()} ${tr("sales")}`} />
                            <ReportMetric icon={<TrendingUp />} label={tr("Revenue")} value={money(data.revenue)} hint={`${tr("COGS")} ${money(data.costOfGoodsSold)}`} />
                            <ReportMetric icon={<BarChart3 />} label={tr("Gross profit")} value={money(data.grossProfit)} hint={`${tr("Margin")} ${formatPercent(data.marginPercent)}`} tone={data.grossProfit < 0 ? "danger" : "success"} />
                            <ReportMetric icon={<PackageCheck />} label={tr("Available stock")} value={data.currentStockQuantity.toLocaleString()} hint={`${tr("Value")} ${money(data.currentStockValue)}`} />
                            <ReportMetric icon={<Truck />} label={tr("Quantity purchased")} value={data.quantityPurchased.toLocaleString()} hint={`${data.purchaseTransactionCount.toLocaleString()} ${tr("purchases")}`} />
                            <ReportMetric icon={<CalendarRange />} label={tr("Purchase cost")} value={money(data.purchaseCost)} hint={tr("Selected period")} />
                            <ReportMetric icon={<RotateCcw />} label={tr("Returned quantity")} value={data.returnedQuantity.toLocaleString()} hint={`${tr("Value")} ${money(data.returnedAmount)}`} tone={data.returnedQuantity > 0 ? "warning" : "normal"} />
                            <ReportMetric icon={<CalendarRange />} label={tr("Reporting period")} value={`${shortDate(data.startDate)} – ${shortDate(data.endDate)}`} hint={data.currencyCode} />
                        </div>

                        <section className="rounded-xl border p-4">
                            <h3 className="font-semibold">{tr("Sales and profit trend")}</h3>
                            {activeTrend.length ? (
                                <div className="mt-4 flex h-52 items-end gap-1 overflow-x-auto border-b pb-2">
                                    {activeTrend.map(point => (
                                        <div key={point.date} className="group flex min-w-4 flex-1 flex-col items-center justify-end gap-1" title={`${shortDate(point.date)} · ${tr("Revenue")} ${money(point.revenue)} · ${tr("Profit")} ${money(point.profit)}`}>
                                            <div className={point.profit >= 0 ? "w-full rounded-t bg-emerald-500/75" : "w-full rounded-t bg-destructive/75"} style={{ height: `${Math.max(3, Math.abs(point.profit) / chartMaximum * 165)}px` }} />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="py-16 text-center text-sm text-muted-foreground">{tr("No product sales in this period.")}</p>
                            )}
                        </section>

                        <div className="overflow-x-auto rounded-xl border">
                            <Table className="min-w-[900px]">
                                <TableHeader><TableRow><TableHead>{tr("Date")}</TableHead><TableHead>{tr("Type")}</TableHead><TableHead>{tr("Reference")}</TableHead><TableHead className="text-end">{tr("Quantity")}</TableHead><TableHead className="text-end">{tr("Amount")}</TableHead><TableHead className="text-end">{tr("Cost")}</TableHead><TableHead className="text-end">{tr("Profit")}</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {data.transactions.map((transaction, index) => (
                                        <TableRow key={`${transaction.type}-${transaction.reference}-${index}`}>
                                            <TableCell className="whitespace-nowrap">{shortDate(transaction.date)}</TableCell>
                                            <TableCell><Badge variant="outline">{tr(transaction.type)}</Badge></TableCell>
                                            <TableCell className="font-medium">{transaction.reference}</TableCell>
                                            <TableCell className="text-end">{transaction.quantity.toLocaleString()}</TableCell>
                                            <TableCell className="text-end">{money(transaction.amount)}</TableCell>
                                            <TableCell className="text-end">{money(transaction.cost)}</TableCell>
                                            <TableCell className={transaction.profit < 0 ? "text-end font-semibold text-destructive" : "text-end font-semibold"}>{transaction.type === "Purchase" || transaction.type.includes("return") ? "—" : money(transaction.profit)}</TableCell>
                                        </TableRow>
                                    ))}
                                    {!data.transactions.length ? <TableRow><TableCell colSpan={7} className="h-28 text-center text-muted-foreground">{tr("No product transactions in this period.")}</TableCell></TableRow> : null}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

function ReportMetric({ icon, label, value, hint, tone = "normal" }: { icon: ReactNode; label: string; value: string; hint: string; tone?: "normal" | "success" | "warning" | "danger" }) {
    const toneClass = tone === "danger" ? "text-destructive" : tone === "success" ? "text-emerald-600" : tone === "warning" ? "text-amber-600" : "text-foreground";
    return <div className="rounded-xl border bg-muted/15 p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="text-primary">{icon}</span>{label}</div><p className={`mt-3 text-xl font-bold ${toneClass}`}>{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p></div>;
}

function presetDates(preset: Preset) {
    const end = new Date();
    const start = new Date(end);
    if (preset === "month") start.setDate(1);
    if (preset === "quarter") start.setMonth(Math.floor(end.getMonth() / 3) * 3, 1);
    if (preset === "year") start.setMonth(0, 1);
    return { startDate: localDate(start), endDate: localDate(end) };
}

function reportRange(searchParams: URLSearchParams) {
    const fallback = presetDates("year");
    const startDate = validDate(searchParams.get("reportStart")) ?? fallback.startDate;
    const endDate = validDate(searchParams.get("reportEnd")) ?? fallback.endDate;
    return { startDate, endDate };
}

function validDate(value: string | null) {
    return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function positiveInteger(value: string | null) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function localDate(value: Date) {
    const offset = value.getTimezoneOffset();
    return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function shortDate(value: string) {
    const date = value.slice(0, 10);
    const parsed = new Date(`${date}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

function getErrorMessage(error: unknown) {
    const responseMessage = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
    if (typeof responseMessage === "string" && responseMessage.trim()) return responseMessage.trim();
    if (error instanceof Error && error.message.trim()) return error.message.trim();
    return "Could not load the product performance report.";
}
