import { useQuery } from "@tanstack/react-query";
import { CalendarRange, FileSpreadsheet, FileText, LoaderCircle, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WhatsAppLink } from "@/features/customers/whatsapp-link";
import { useI18n } from "@/i18n/i18n-provider";
import { useCompany } from "./company-context";
import { companyService } from "./company-service";

interface CustomerLedgerCardProps {
    customerId: number;
    customerName: string;
    whatsAppUrl: string | null;
}

type Preset = "month" | "quarter" | "year" | "all";

export function CustomerLedgerCard({
    customerId,
    customerName,
    whatsAppUrl,
}: CustomerLedgerCardProps) {
    const { company, formatMoney } = useCompany();
    const { tr } = useI18n();
    const [range, setRange] = useState(() => presetDates("month"));
    const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
    const currencyCode = company?.settings.mainCurrencyCode;
    const params = useMemo(
        () => ({ startDate: range.startDate || undefined, endDate: range.endDate || undefined, currencyCode }),
        [currencyCode, range.endDate, range.startDate],
    );

    const ledger = useQuery({
        queryKey: ["customer-ledger", customerId, params],
        queryFn: () => companyService.customerLedger(customerId, params),
        enabled: customerId > 0,
    });

    const setPreset = (preset: Preset) => setRange(presetDates(preset));
    const exportLedger = async (format: "excel" | "pdf") => {
        setExporting(format);
        try {
            await companyService.exportCustomerLedger(customerId, format, params);
            toast.success(tr(format === "pdf" ? "PDF generated successfully." : "Excel file generated successfully."));
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setExporting(null);
        }
    };

    return (
        <Card>
            <CardHeader className="gap-4 border-b">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                        <CardTitle>Customer ledger</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Sales, payments, outstanding balance, and profit for the selected period.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <WhatsAppLink
                            url={whatsAppUrl}
                            customerName={customerName}
                        />
                        <Button variant="outline" size="sm" disabled={Boolean(exporting)} onClick={() => void exportLedger("excel")}>
                            {exporting === "excel" ? <LoaderCircle className="animate-spin" /> : <FileSpreadsheet />}
                            Excel
                        </Button>
                        <Button variant="outline" size="sm" disabled={Boolean(exporting)} onClick={() => void exportLedger("pdf")}>
                            {exporting === "pdf" ? <LoaderCircle className="animate-spin" /> : <FileText />}
                            PDF
                        </Button>
                    </div>
                </div>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex flex-wrap gap-2">
                        {(["month", "quarter", "year", "all"] as Preset[]).map((preset) => (
                            <Button key={preset} variant="outline" size="sm" onClick={() => setPreset(preset)}>
                                {preset === "all" ? "All time" : `This ${preset}`}
                            </Button>
                        ))}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <label className="space-y-1 text-xs text-muted-foreground">
                            From
                            <Input type="date" value={range.startDate} onChange={(event) => setRange((current) => ({ ...current, startDate: event.target.value }))} />
                        </label>
                        <label className="space-y-1 text-xs text-muted-foreground">
                            To
                            <Input type="date" value={range.endDate} onChange={(event) => setRange((current) => ({ ...current, endDate: event.target.value }))} />
                        </label>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
                {ledger.isLoading ? (
                    <div className="grid h-44 place-items-center text-muted-foreground"><LoaderCircle className="size-5 animate-spin" /></div>
                ) : ledger.isError || !ledger.data ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                        {getErrorMessage(ledger.error)}
                    </div>
                ) : (
                    <>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <LedgerMetric icon={<TrendingUp />} label="Sales" value={formatMoney(ledger.data.totalSales, ledger.data.currencyCode)} hint="Customer debits" />
                            <LedgerMetric icon={<WalletCards />} label="Payments" value={formatMoney(ledger.data.totalPayments, ledger.data.currencyCode)} hint="Customer credits" />
                            <LedgerMetric icon={<TrendingDown />} label="Outstanding" value={formatMoney(ledger.data.closingBalance, ledger.data.currencyCode)} hint={`Opening: ${formatMoney(ledger.data.openingBalance, ledger.data.currencyCode)}`} danger={ledger.data.closingBalance > 0} />
                            <LedgerMetric icon={<CalendarRange />} label="Gross profit" value={formatMoney(ledger.data.grossProfit, ledger.data.currencyCode)} hint={`COGS: ${formatMoney(ledger.data.costOfGoodsSold, ledger.data.currencyCode)}`} />
                        </div>

                        <div className="overflow-hidden border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Reference</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-end">Debit</TableHead>
                                        <TableHead className="text-end">Credit</TableHead>
                                        <TableHead className="text-end">Balance</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {ledger.data.entries.map((entry, index) => (
                                        <TableRow key={`${entry.type}-${entry.sourceId ?? index}-${entry.date}`}>
                                            <TableCell className="whitespace-nowrap">{new Date(entry.date).toLocaleDateString()}</TableCell>
                                            <TableCell><div className="font-medium">{entry.reference}</div><div className="text-xs text-muted-foreground">{entry.type}</div></TableCell>
                                            <TableCell className="max-w-80 text-muted-foreground">{entry.description}</TableCell>
                                            <TableCell className="text-end">{entry.debit ? formatMoney(entry.debit, entry.currencyCode) : "—"}</TableCell>
                                            <TableCell className="text-end">{entry.credit ? formatMoney(entry.credit, entry.currencyCode) : "—"}</TableCell>
                                            <TableCell className="text-end font-semibold">{formatMoney(entry.balance, entry.currencyCode)}</TableCell>
                                        </TableRow>
                                    ))}
                                    {!ledger.data.entries.length && (
                                        <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">No ledger activity in this period.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

function LedgerMetric({ icon, label, value, hint, danger = false }: { icon: React.ReactNode; label: string; value: string; hint: string; danger?: boolean }) {
    return (
        <div className="rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="text-primary">{icon}</span>{label}</div>
            <p className={danger ? "mt-3 text-xl font-bold text-destructive" : "mt-3 text-xl font-bold"}>{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
    );
}

function presetDates(preset: Preset) {
    const end = new Date();
    const start = new Date(end);
    if (preset === "month") start.setDate(1);
    if (preset === "quarter") start.setMonth(Math.floor(end.getMonth() / 3) * 3, 1);
    if (preset === "year") start.setMonth(0, 1);
    return {
        startDate: preset === "all" ? "" : localDate(start),
        endDate: localDate(end),
    };
}

function localDate(value: Date) {
    const offset = value.getTimezoneOffset();
    return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function getErrorMessage(error: unknown) {
    const responseMessage = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
    if (typeof responseMessage === "string" && responseMessage.trim()) return responseMessage.trim();
    if (error instanceof Error && error.message.trim()) return error.message.trim();
    return "Could not load the customer ledger.";
}
