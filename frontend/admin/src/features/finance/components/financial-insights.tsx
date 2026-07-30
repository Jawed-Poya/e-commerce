import { BarChart3 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FinancialReport } from "../finance-types";
import { useI18n } from "@/i18n/i18n-provider";

interface FinancialInsightsProps {
    report: FinancialReport;
    money: (value: number) => string;
}

export function FinancialInsights({ report, money }: FinancialInsightsProps) {
    const { locale, t, tf } = useI18n();
    const chartMaximum = Math.max(
        1,
        ...report.profitTrend.flatMap((item) => [
            Math.abs(item.revenue),
            Math.abs(item.cost),
            Math.abs(item.net),
        ]),
    );

    return (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,.65fr)]">
            <Card className="shadow-none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="size-5 text-primary" />
                        {t("finance.dailyProfitTrend")}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex h-64 items-end gap-1 overflow-x-auto border-b pb-2">
                        {report.profitTrend.map((point) => (
                            <div
                                key={point.date}
                                className="group flex min-w-5 flex-1 flex-col items-center justify-end gap-1"
                                title={tf("finance.chartTooltip", {
                                    date: point.date,
                                    revenue: money(point.revenue),
                                    cost: money(point.cost),
                                    net: money(point.net),
                                })}
                            >
                                <div
                                    className={`w-full min-w-2 rounded-t ${
                                        point.net >= 0
                                            ? "bg-emerald-500/75"
                                            : "bg-red-500/75"
                                    }`}
                                    style={{
                                        height: `${Math.max(
                                            3,
                                            (Math.abs(point.net) / chartMaximum) * 210,
                                        )}px`,
                                    }}
                                />
                                <span className="hidden text-[9px] text-muted-foreground group-hover:block">
                                    {point.date.slice(5)}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                        <span>
                            <i className="me-1 inline-block size-2 rounded-full bg-emerald-500" />
                            {t("finance.profit")}
                        </span>
                        <span>
                            <i className="me-1 inline-block size-2 rounded-full bg-red-500" />
                            {t("finance.loss")}
                        </span>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-none">
                <CardHeader>
                    <CardTitle>{t("finance.topProducts")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {report.topProducts.length ? (
                        report.topProducts.map((product, index) => (
                            <div
                                key={product.productId}
                                className="flex items-center gap-3 rounded-xl bg-muted/35 p-3 ring-1 ring-foreground/5"
                            >
                                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                                    {index + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold">{product.productName}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {tf("finance.quantitySold", {
                                            quantity: product.quantity.toLocaleString(locale),
                                        })}
                                    </p>
                                </div>
                                <span className="text-sm font-semibold tabular-nums">
                                    {money(product.revenue)}
                                </span>
                            </div>
                        ))
                    ) : (
                        <p className="py-12 text-center text-sm text-muted-foreground">
                            {t("finance.noProductSales")}
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
