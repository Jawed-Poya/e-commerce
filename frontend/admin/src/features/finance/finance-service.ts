import apiClient from "@/api/api-client";
import type {
    CompanyWorth,
    FinancialReport,
    FinancialReportFilters,
} from "./finance-types";

export const financeService = {
    report: async (filters: FinancialReportFilters) =>
        (await apiClient.get<FinancialReport>("/admin/reports", filters)).data,
    worth: async (params: {
        asOfDate?: string;
        periodStartDate?: string;
        branchId?: string | number;
        currencyCode?: string;
    }) => (await apiClient.get<CompanyWorth>("/admin/reports/company-worth", params)).data,
    exportReport: (format: "excel" | "pdf", filters: FinancialReportFilters) =>
        apiClient.download(`/admin/reports/export/${format}`, filters),
    exportSalesPdf: (params: {
        startDate?: string;
        endDate?: string;
        branchId?: string | number;
        currencyCode?: string;
        search?: string;
    }) => apiClient.download("/admin/documents/sales/pdf", params),
};
