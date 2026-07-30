export interface FinancialTrendPoint {
    date: string;
    revenue: number;
    cost: number;
    net: number;
}

export interface TopProduct {
    productId: number;
    productName: string;
    quantity: number;
    revenue: number;
}

export interface FinancialReportLine {
    source: string;
    id: number;
    reference: string;
    date: string;
    description: string;
    status: string;
    amount: number;
    paidAmount: number;
    balanceAmount: number;
    currencyCode: string;
    direction: "in" | "out";
    branchId: number | null;
    branchName: string | null;
}

export interface FinancialReport {
    startDate: string;
    endDate: string;
    currencyCode: string;
    availableCurrencies: string[];
    onlineRevenue: number;
    manualSalesRevenue: number;
    totalRevenue: number;
    costOfGoodsSold: number;
    grossProfit: number;
    grossMarginPercent: number;
    expenses: number;
    payrollObligation: number;
    netProfit: number;
    netMarginPercent: number;
    cashReceived: number;
    purchases: number;
    payrollPaid: number;
    cashPaid: number;
    netCashFlow: number;
    operatingBalance: number;
    outstandingReceivables: number;
    outstandingSupplierPayables: number;
    outstandingPayroll: number;
    onlineOrders: number;
    manualSales: number;
    purchaseCount: number;
    customerCount: number;
    productCount: number;
    lowStockProducts: number;
    averageOrderValue: number;
    trend: FinancialTrendPoint[];
    profitTrend: FinancialTrendPoint[];
    topProducts: TopProduct[];
    results: FinancialReportLine[];
    totalResults: number;
    page: number;
    pageSize: number;
}

export interface CompanyWorth {
    asOfDate: string;
    periodStartDate: string;
    currencyCode: string;
    cashPosition: number;
    inventoryValue: number;
    accountsReceivable: number;
    totalAssets: number;
    supplierPayables: number;
    payrollPayables: number;
    totalLiabilities: number;
    netWorth: number;
    periodRevenue: number;
    periodCostOfGoodsSold: number;
    periodExpenses: number;
    periodPayroll: number;
    periodNetProfit: number;
    returnOnAssetsPercent: number;
}

export interface FinancialReportFilters {
    startDate?: string;
    endDate?: string;
    branchId?: string | number;
    currencyCode?: string;
    source?: string;
    status?: string;
    search?: string;
    minimumAmount?: string | number;
    maximumAmount?: string | number;
    sort?: string;
    page?: number;
    pageSize?: number;
}

export interface FinancialFilterState {
    startDate: string;
    endDate: string;
    branchId: string;
    currencyCode: string;
    source: string;
    status: string;
    search: string;
    minimumAmount: string;
    maximumAmount: string;
    sort: string;
    page: number;
    pageSize: number;
}

export type FinancialPreset = "today" | "week" | "month" | "year";

export function toFinancialRequest(filters: FinancialFilterState): FinancialReportFilters {
    return {
        ...filters,
        branchId: filters.branchId || undefined,
        currencyCode: filters.currencyCode || undefined,
        source: filters.source || undefined,
        status: filters.status || undefined,
        search: filters.search.trim() || undefined,
        minimumAmount: filters.minimumAmount || undefined,
        maximumAmount: filters.maximumAmount || undefined,
    };
}
