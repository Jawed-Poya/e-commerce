import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { companyService } from "@/features/company/company-service";
import { useI18n } from "@/i18n/i18n-provider";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getApiErrorMessage } from "@/lib/api-error";
import { financeQueryKeys } from "../finance-query-keys";
import { financeService } from "../finance-service";
import {
    toFinancialRequest,
    type FinancialFilterState,
    type FinancialPreset,
} from "../finance-types";

function localIso(date: Date) {
    const value = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return value.toISOString().slice(0, 10);
}

function initialFilters(): FinancialFilterState {
    const today = new Date();
    return {
        startDate: localIso(new Date(today.getFullYear(), today.getMonth(), 1)),
        endDate: localIso(today),
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
    };
}

export function useFinancialReport() {
    const { t } = useI18n();
    const [filters, setFilters] = useState<FinancialFilterState>(initialFilters);
    const debouncedSearch = useDebouncedValue(filters.search);
    const request = useMemo(
        () => toFinancialRequest({ ...filters, search: debouncedSearch }),
        [debouncedSearch, filters],
    );

    const companyQuery = useQuery({
        queryKey: ["company", "profile"],
        queryFn: companyService.profile,
        staleTime: 5 * 60_000,
    });
    const reportQuery = useQuery({
        queryKey: financeQueryKeys.report(request),
        queryFn: () => financeService.report(request),
        placeholderData: (previous) => previous,
    });
    const worthQuery = useQuery({
        queryKey: financeQueryKeys.companyWorth({
            asOfDate: filters.endDate,
            periodStartDate: filters.startDate,
            branchId: filters.branchId,
            currencyCode: reportQuery.data?.currencyCode,
        }),
        queryFn: () =>
            financeService.worth({
                asOfDate: filters.endDate,
                periodStartDate: filters.startDate,
                branchId: filters.branchId || undefined,
                currencyCode:
                    reportQuery.data?.currencyCode || filters.currencyCode || undefined,
            }),
        enabled: Boolean(reportQuery.data),
    });

    const exportReport = useMutation({
        mutationFn: (format: "excel" | "pdf") =>
            financeService.exportReport(format, request),
        onError: (error) =>
            toast.error(getApiErrorMessage(error, t("finance.loadFailed"))),
    });
    const exportSales = useMutation({
        mutationFn: () =>
            financeService.exportSalesPdf({
                startDate: filters.startDate,
                endDate: filters.endDate,
                branchId: filters.branchId || undefined,
                currencyCode: filters.currencyCode || undefined,
                search: filters.search.trim() || undefined,
            }),
        onError: (error) =>
            toast.error(getApiErrorMessage(error, t("finance.loadFailed"))),
    });

    const updateFilter = <K extends keyof FinancialFilterState>(
        key: K,
        value: FinancialFilterState[K],
    ) => {
        setFilters((current) => ({ ...current, [key]: value, page: 1 }));
    };

    const applyPreset = (preset: FinancialPreset) => {
        const end = new Date();
        let start = new Date(end);
        if (preset === "week") start.setDate(end.getDate() - ((end.getDay() + 6) % 7));
        if (preset === "month") start = new Date(end.getFullYear(), end.getMonth(), 1);
        if (preset === "year") start = new Date(end.getFullYear(), 0, 1);
        setFilters((current) => ({
            ...current,
            startDate: localIso(start),
            endDate: localIso(end),
            page: 1,
        }));
    };

    return {
        filters,
        setFilters,
        updateFilter,
        applyPreset,
        request,
        companyQuery,
        reportQuery,
        worthQuery,
        exportReport,
        exportSales,
    };
}
