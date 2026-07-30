import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { FinancialReport } from "../finance-types";
import { useI18n } from "@/i18n/i18n-provider";

interface FinancialLedgerProps {
    report: FinancialReport;
    totalPages: number;
    money: (value: number) => string;
    onPageChange: (page: number) => void;
}

export function FinancialLedger({
    report,
    totalPages,
    money,
    onPageChange,
}: FinancialLedgerProps) {
    const { locale, t, tf, tr } = useI18n();

    const sourceLabel = (value: string) => {
        const keys: Record<string, Parameters<typeof t>[0]> = {
            orders: "finance.onlineOrder",
            "manual-sales": "finance.manualSale",
            purchases: "finance.purchase",
            expenses: "finance.expense",
            payroll: "finance.payroll",
        };
        return keys[value] ? t(keys[value]) : tr(value);
    };

    const statusLabel = (value: string) =>
        value
            .split("/")
            .map((part) => tr(part.trim()))
            .join(" / ");

    return (
        <Card className="overflow-hidden shadow-none">
            <CardHeader className="border-b">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>{t("finance.transactionLedger")}</CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {tf("finance.matchingRecords", {
                                count: report.totalResults.toLocaleString(locale),
                            })}
                        </p>
                    </div>
                    <Badge variant="secondary">
                        {tf("finance.pageOf", {
                            page: report.page,
                            pages: totalPages,
                        })}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t("finance.date")}</TableHead>
                                <TableHead>{t("finance.source")}</TableHead>
                                <TableHead>{t("finance.reference")}</TableHead>
                                <TableHead>{t("finance.descriptionColumn")}</TableHead>
                                <TableHead>{t("finance.status")}</TableHead>
                                <TableHead className="text-end">{t("finance.amount")}</TableHead>
                                <TableHead className="text-end">{t("finance.paid")}</TableHead>
                                <TableHead className="text-end">{t("finance.balance")}</TableHead>
                                <TableHead>{t("finance.branch")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {report.results.length ? (
                                report.results.map((item) => (
                                    <TableRow key={`${item.source}-${item.id}`}>
                                        <TableCell className="whitespace-nowrap">
                                            {new Date(item.date).toLocaleDateString(locale)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{sourceLabel(item.source)}</Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{item.reference}</TableCell>
                                        <TableCell className="max-w-64 truncate">{tr(item.description)}</TableCell>
                                        <TableCell>{statusLabel(item.status)}</TableCell>
                                        <TableCell
                                            className={`text-end font-semibold tabular-nums ${
                                                item.direction === "in"
                                                    ? "text-emerald-700 dark:text-emerald-400"
                                                    : "text-red-700 dark:text-red-400"
                                            }`}
                                        >
                                            {item.direction === "out" ? "−" : "+"}
                                            {money(item.amount)}
                                        </TableCell>
                                        <TableCell className="text-end tabular-nums">
                                            {money(item.paidAmount)}
                                        </TableCell>
                                        <TableCell className="text-end tabular-nums">
                                            {money(item.balanceAmount)}
                                        </TableCell>
                                        <TableCell>{item.branchName ?? t("finance.allCompany")}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-36 text-center text-muted-foreground">
                                        {t("finance.noTransactions")}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                    {tf("finance.showing", {
                        shown: report.results.length,
                        total: report.totalResults,
                    })}
                </p>
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={report.page <= 1}
                        onClick={() => onPageChange(report.page - 1)}
                    >
                        {t("finance.previous")}
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={report.page >= totalPages}
                        onClick={() => onPageChange(report.page + 1)}
                    >
                        {t("finance.next")}
                    </Button>
                </div>
            </div>
        </Card>
    );
}
