import type { FinancialReportFilters } from "./finance-types";

export const financeQueryKeys = {
    all: ["finance"] as const,
    report: (request: FinancialReportFilters) =>
        [...financeQueryKeys.all, "report", request] as const,
    companyWorth: (params: {
        asOfDate: string;
        periodStartDate: string;
        branchId: string;
        currencyCode?: string;
    }) => [...financeQueryKeys.all, "company-worth", params] as const,
};
