import apiClient from "@/api/api-client";
import type {
    CompanyWorth,
    FinancialReport,
    FinancialReportFilters,
    ProductPerformanceReport,
} from "./finance-types";
import { toFiniteNumber } from "@/lib/numbers";

const reportNumberFields = [
    "onlineRevenue", "manualSalesRevenue", "totalRevenue", "costOfGoodsSold", "grossProfit",
    "grossMarginPercent", "expenses", "payrollObligation", "netProfit", "netMarginPercent",
    "cashReceived", "purchases", "payrollPaid", "cashPaid", "netCashFlow", "operatingBalance",
    "outstandingReceivables", "outstandingSupplierPayables", "outstandingPayroll", "onlineOrders",
    "manualSales", "purchaseCount", "returnedOrderCount", "returnedOrderAmount", "customerCount",
    "productCount", "lowStockProducts", "averageOrderValue", "totalResults", "page", "pageSize",
] as const satisfies readonly (keyof FinancialReport)[];

function normalizeReport(report: FinancialReport): FinancialReport {
    const normalized = { ...report };
    for (const key of reportNumberFields) {
        // Runtime API values can be nullable or numeric strings even though the
        // generated TypeScript contract correctly describes the target shape.
        (normalized as unknown as Record<string, unknown>)[key] = toFiniteNumber(report[key]);
    }
    normalized.page = Math.max(1, normalized.page);
    normalized.pageSize = Math.max(1, normalized.pageSize || 25);
    normalized.availableCurrencies = Array.isArray(report.availableCurrencies) ? report.availableCurrencies : [];
    normalized.trend = (report.trend ?? []).map(point => ({ ...point, revenue: toFiniteNumber(point.revenue), cost: toFiniteNumber(point.cost), net: toFiniteNumber(point.net) }));
    normalized.profitTrend = (report.profitTrend ?? []).map(point => ({ ...point, revenue: toFiniteNumber(point.revenue), cost: toFiniteNumber(point.cost), net: toFiniteNumber(point.net) }));
    normalized.topProducts = (report.topProducts ?? []).map(product => ({ ...product, quantity: toFiniteNumber(product.quantity), revenue: toFiniteNumber(product.revenue), cost: toFiniteNumber(product.cost), profit: toFiniteNumber(product.profit), marginPercent: toFiniteNumber(product.marginPercent) }));
    normalized.topCustomers = (report.topCustomers ?? []).map(item => ({ ...item, transactionCount: toFiniteNumber(item.transactionCount), amount: toFiniteNumber(item.amount), balance: toFiniteNumber(item.balance) }));
    normalized.topSuppliers = (report.topSuppliers ?? []).map(item => ({ ...item, transactionCount: toFiniteNumber(item.transactionCount), amount: toFiniteNumber(item.amount), balance: toFiniteNumber(item.balance) }));
    normalized.results = (report.results ?? []).map(item => ({ ...item, amount: toFiniteNumber(item.amount), paidAmount: toFiniteNumber(item.paidAmount), balanceAmount: toFiniteNumber(item.balanceAmount) }));
    return normalized;
}

function normalizeProductPerformance(report: ProductPerformanceReport): ProductPerformanceReport {
    const numericFields = [
        "productId", "quantitySold", "revenue", "costOfGoodsSold", "grossProfit",
        "marginPercent", "salesTransactionCount", "quantityPurchased", "purchaseCost",
        "purchaseTransactionCount", "returnedQuantity", "returnedAmount",
        "currentStockQuantity", "currentStockValue",
    ] as const satisfies readonly (keyof ProductPerformanceReport)[];
    const normalized = { ...report };
    for (const key of numericFields) {
        (normalized as unknown as Record<string, unknown>)[key] = toFiniteNumber(report[key]);
    }
    normalized.trend = (report.trend ?? []).map(item => ({
        ...item,
        quantity: toFiniteNumber(item.quantity),
        revenue: toFiniteNumber(item.revenue),
        cost: toFiniteNumber(item.cost),
        profit: toFiniteNumber(item.profit),
    }));
    normalized.transactions = (report.transactions ?? []).map(item => ({
        ...item,
        quantity: toFiniteNumber(item.quantity),
        amount: toFiniteNumber(item.amount),
        cost: toFiniteNumber(item.cost),
        profit: toFiniteNumber(item.profit),
    }));
    return normalized;
}

export const financeService = {
    report: async (filters: FinancialReportFilters) =>
        normalizeReport((await apiClient.get<FinancialReport>("/admin/reports", filters)).data),
    worth: async (params: {
        asOfDate?: string;
        periodStartDate?: string;
        branchId?: string | number;
        currencyCode?: string;
    }) => (await apiClient.get<CompanyWorth>("/admin/reports/company-worth", params)).data,
    productPerformance: async (
        productId: number,
        params: { startDate?: string; endDate?: string; branchId?: string | number; currencyCode?: string },
    ) => normalizeProductPerformance(
        (await apiClient.get<ProductPerformanceReport>(`/products/${productId}/performance`, params)).data,
    ),
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
