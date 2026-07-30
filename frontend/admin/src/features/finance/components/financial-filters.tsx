import type { ReactNode } from "react";
import { CalendarRange, Search } from "lucide-react";

import { SimpleCombobox } from "@/components/simple-combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/i18n-provider";
import type { FinancialFilterState, FinancialPreset } from "../finance-types";

interface FinancialFiltersProps {
    filters: FinancialFilterState;
    branches: { id: number; name: string }[];
    currencies: string[];
    onChange: <K extends keyof FinancialFilterState>(
        key: K,
        value: FinancialFilterState[K],
    ) => void;
    onPreset: (preset: FinancialPreset) => void;
}

export function FinancialFilters({
    filters,
    branches,
    currencies,
    onChange,
    onPreset,
}: FinancialFiltersProps) {
    const { t } = useI18n();
    const presets: { value: FinancialPreset; label: string }[] = [
        { value: "today", label: t("finance.today") },
        { value: "week", label: t("finance.thisWeek") },
        { value: "month", label: t("finance.thisMonth") },
        { value: "year", label: t("finance.thisYear") },
    ];

    return (
        <Card className="shadow-none">
            <CardHeader className="border-b bg-muted/20">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <CalendarRange className="size-5 text-primary" />
                            {t("finance.reportingRange")}
                        </CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {t("finance.rangeHelp")}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {presets.map((preset) => (
                            <Button
                                key={preset.value}
                                size="sm"
                                variant="outline"
                                onClick={() => onPreset(preset.value)}
                            >
                                {preset.label}
                            </Button>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                <Field label={t("finance.start")}>
                    <Input
                        type="date"
                        value={filters.startDate}
                        onChange={(event) => onChange("startDate", event.target.value)}
                    />
                </Field>
                <Field label={t("finance.end")}>
                    <Input
                        type="date"
                        value={filters.endDate}
                        onChange={(event) => onChange("endDate", event.target.value)}
                    />
                </Field>
                <Field label={t("finance.branch")}>
                    <SimpleCombobox
                        value={filters.branchId}
                        onValueChange={(value) => onChange("branchId", value ?? "")}
                        options={[
                            { value: "", label: t("finance.allBranches") },
                            ...branches.map((branch) => ({
                                value: String(branch.id),
                                label: branch.name,
                            })),
                        ]}
                    />
                </Field>
                <Field label={t("finance.currency")}>
                    <SimpleCombobox
                        value={filters.currencyCode}
                        onValueChange={(value) => onChange("currencyCode", value ?? "")}
                        options={currencies.map((value) => ({ value, label: value }))}
                        placeholder={t("finance.mainCurrency")}
                    />
                </Field>
                <Field label={t("finance.source")}>
                    <SimpleCombobox
                        value={filters.source}
                        onValueChange={(value) => onChange("source", value ?? "")}
                        options={[
                            { value: "", label: t("finance.allTransactions") },
                            { value: "orders", label: t("finance.onlineOrders") },
                            { value: "manual-sales", label: t("finance.manualSales") },
                            { value: "purchases", label: t("finance.purchases") },
                            { value: "expenses", label: t("finance.expenses") },
                            { value: "payroll", label: t("finance.payroll") },
                        ]}
                    />
                </Field>
                <Field label={t("finance.sort")}>
                    <SimpleCombobox
                        value={filters.sort}
                        onValueChange={(value) => value && onChange("sort", value)}
                        options={[
                            { value: "date-desc", label: t("finance.newestFirst") },
                            { value: "date-asc", label: t("finance.oldestFirst") },
                            { value: "amount-desc", label: t("finance.highestAmount") },
                            { value: "amount-asc", label: t("finance.lowestAmount") },
                        ]}
                    />
                </Field>
                <div className="relative sm:col-span-2 xl:col-span-3">
                    <Label>{t("finance.search")}</Label>
                    <Search className="pointer-events-none absolute bottom-2.5 start-3 size-4 text-muted-foreground" />
                    <Input
                        className="mt-2 ps-9"
                        value={filters.search}
                        onChange={(event) => onChange("search", event.target.value)}
                        placeholder={t("finance.searchPlaceholder")}
                    />
                </div>
                <Field label={t("finance.minimum")}>
                    <Input
                        type="number"
                        min={0}
                        value={filters.minimumAmount}
                        onChange={(event) => onChange("minimumAmount", event.target.value)}
                    />
                </Field>
                <Field label={t("finance.maximum")}>
                    <Input
                        type="number"
                        min={0}
                        value={filters.maximumAmount}
                        onChange={(event) => onChange("maximumAmount", event.target.value)}
                    />
                </Field>
                <Field label={t("finance.status")}>
                    <Input
                        value={filters.status}
                        onChange={(event) => onChange("status", event.target.value)}
                        placeholder={t("finance.statusPlaceholder")}
                    />
                </Field>
            </CardContent>
        </Card>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            {children}
        </div>
    );
}
