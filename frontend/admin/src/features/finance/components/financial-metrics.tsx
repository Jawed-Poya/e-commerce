import type { ReactNode } from "react";
import { Building2, Landmark, TrendingDown, TrendingUp, WalletCards } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { CompanyWorth, FinancialReport } from "../finance-types";
import { useI18n } from "@/i18n/i18n-provider";

interface FinancialMetricsProps {
    report: FinancialReport;
    worth?: CompanyWorth;
    money: (value: number) => string;
}

export function FinancialMetrics({ report, worth, money }: FinancialMetricsProps) {
    const { t, tf } = useI18n();

    return (
        <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric
                    title={t("finance.revenue")}
                    value={money(report.totalRevenue)}
                    detail={tf("finance.revenueDetail", {
                        online: money(report.onlineRevenue),
                        manual: money(report.manualSalesRevenue),
                    })}
                    icon={<TrendingUp />}
                    tone="positive"
                />
                <Metric
                    title={t("finance.cogs")}
                    value={money(report.costOfGoodsSold)}
                    detail={t("finance.cogsDetail")}
                    icon={<WalletCards />}
                />
                <Metric
                    title={t("finance.grossProfit")}
                    value={money(report.grossProfit)}
                    detail={tf("finance.grossMargin", {
                        percent: report.grossMarginPercent.toFixed(2),
                    })}
                    icon={report.grossProfit >= 0 ? <TrendingUp /> : <TrendingDown />}
                    tone={report.grossProfit >= 0 ? "positive" : "negative"}
                />
                <Metric
                    title={t("finance.netProfit")}
                    value={money(report.netProfit)}
                    detail={tf("finance.netMargin", {
                        percent: report.netMarginPercent.toFixed(2),
                    })}
                    icon={report.netProfit >= 0 ? <TrendingUp /> : <TrendingDown />}
                    tone={report.netProfit >= 0 ? "positive" : "negative"}
                />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric
                    title={t("finance.companyWorth")}
                    value={worth ? money(worth.netWorth) : "—"}
                    detail={
                        worth
                            ? tf("finance.assetsLiabilities", {
                                  assets: money(worth.totalAssets),
                                  liabilities: money(worth.totalLiabilities),
                              })
                            : t("finance.calculatingWorth")
                    }
                    icon={<Building2 />}
                    tone={(worth?.netWorth ?? 0) >= 0 ? "positive" : "negative"}
                />
                <Metric
                    title={t("finance.cashPosition")}
                    value={worth ? money(worth.cashPosition) : money(report.netCashFlow)}
                    detail={tf("finance.cashInOut", {
                        received: money(report.cashReceived),
                        paid: money(report.cashPaid),
                    })}
                    icon={<Landmark />}
                />
                <Metric
                    title={t("finance.receivables")}
                    value={money(report.outstandingReceivables)}
                    detail={t("finance.receivablesDetail")}
                    icon={<WalletCards />}
                />
                <Metric
                    title={t("finance.payables")}
                    value={money(report.outstandingSupplierPayables + report.outstandingPayroll)}
                    detail={tf("finance.payablesDetail", {
                        suppliers: money(report.outstandingSupplierPayables),
                        payroll: money(report.outstandingPayroll),
                    })}
                    icon={<TrendingDown />}
                />
            </div>
        </div>
    );
}

function Metric({
    title,
    value,
    detail,
    icon,
    tone,
}: {
    title: string;
    value: string;
    detail: string;
    icon: ReactNode;
    tone?: "positive" | "negative";
}) {
    return (
        <Card className="shadow-none">
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">{title}</p>
                        <p
                            className={`mt-2 text-2xl font-bold tracking-tight tabular-nums ${
                                tone === "positive"
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : tone === "negative"
                                      ? "text-red-700 dark:text-red-400"
                                      : ""
                            }`}
                        >
                            {value}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
                    </div>
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary [&_svg]:size-5">
                        {icon}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}
