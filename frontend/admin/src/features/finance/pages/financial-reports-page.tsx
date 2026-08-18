import {
    FileSpreadsheet,
    FileText,
    LoaderCircle,
    RefreshCw,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCompany } from "@/features/company/company-context";
import { useI18n } from "@/i18n/i18n-provider";
import { toFiniteNumber } from "@/lib/numbers";
import { FinancialFilters } from "../components/financial-filters";
import { FinancialInsights } from "../components/financial-insights";
import { FinancialLedger } from "../components/financial-ledger";
import { FinancialMetrics } from "../components/financial-metrics";
import { useFinancialReport } from "../hooks/use-financial-report";

export default function FinancialReportsPage() {
    const { t } = useI18n();
    const { formatMoney } = useCompany();
    const controller = useFinancialReport();
    const data = controller.reportQuery.data;
    const currency = data?.currencyCode;
    const money = (value: number) => formatMoney(value, currency);
    const totalPages = data
        ? Math.max(1, Math.ceil(toFiniteNumber(data.totalResults) / Math.max(1, toFiniteNumber(data.pageSize, 25))))
        : 1;

    return (
        <div className="space-y-6">
            <PageHeader
                title={t("finance.title")}
                description={t("finance.description")}
                actions={
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            onClick={() => controller.reportQuery.refetch()}
                            disabled={controller.reportQuery.isFetching}
                        >
                            <RefreshCw
                                className={
                                    controller.reportQuery.isFetching ? "animate-spin" : ""
                                }
                            />
                            {t("finance.refresh")}
                        </Button>
                        <Button
                            variant="outline"
                            disabled={!data || controller.exportReport.isPending}
                            onClick={() => controller.exportReport.mutate("excel")}
                        >
                            <FileSpreadsheet />
                            {t("finance.excel")}
                        </Button>
                        <Button
                            variant="outline"
                            disabled={controller.exportSales.isPending}
                            onClick={() => controller.exportSales.mutate()}
                        >
                            <FileText />
                            {t("finance.salesPdf")}
                        </Button>
                        <Button
                            disabled={!data || controller.exportReport.isPending}
                            onClick={() => controller.exportReport.mutate("pdf")}
                        >
                            <FileText />
                            {t("finance.financialPdf")}
                        </Button>
                    </div>
                }
            />

            <FinancialFilters
                filters={controller.filters}
                branches={controller.companyQuery.data?.branches ?? []}
                currencies={data?.availableCurrencies ?? []}
                onChange={controller.updateFilter}
                onPreset={controller.applyPreset}
            />

            {controller.reportQuery.isLoading ? (
                <Card>
                    <CardContent className="grid min-h-72 place-items-center">
                        <LoaderCircle className="size-7 animate-spin text-primary" />
                    </CardContent>
                </Card>
            ) : controller.reportQuery.isError || !data ? (
                <Card>
                    <CardContent className="p-8 text-center text-destructive">
                        {t("finance.loadFailed")}
                    </CardContent>
                </Card>
            ) : (
                <>
                    <FinancialMetrics
                        report={data}
                        worth={controller.worthQuery.data}
                        money={money}
                    />
                    <FinancialInsights report={data} money={money} />
                    <FinancialLedger
                        report={data}
                        totalPages={totalPages}
                        money={money}
                        onPageChange={(page) =>
                            controller.setFilters((current) => ({ ...current, page }))
                        }
                    />
                </>
            )}
        </div>
    );
}
