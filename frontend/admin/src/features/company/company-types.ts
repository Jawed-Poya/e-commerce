export interface CompanySettings {
    mainCurrencyCode: string;
    currencySymbol: string;
    currencyPosition: "before" | "after";
    currencyDecimalPlaces: number;
    adminPrimaryColor: string;
    adminSecondaryColor: string;
    storefrontPrimaryColor: string;
    storefrontSecondaryColor: string;
    englishFontFamily: string;
    dariFontFamily: string;
    pashtoFontFamily: string;
    baseFontSize: number;
    trashRetentionDays: number;
    notificationRetentionDays: number;
    allowUserClaimManagement: boolean;
}

export interface CompanyBranch {
    id: number;
    name: string;
    code: string;
    phone: string | null;
    address: string | null;
    isMain: boolean;
    isActive: boolean;
}

export interface CompanyProfile {
    id: number;
    name: string;
    legalName: string | null;
    registrationNumber: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    logoUrl: string | null;
    faviconUrl: string | null;
    branches: CompanyBranch[];
    settings: CompanySettings;
}

export interface PublicCompanyProfile {
    id: number;
    name: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    settings: CompanySettings;
}

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

export interface LedgerEntry {
    date: string;
    type: string;
    reference: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    currencyCode: string;
    sourceId: number | null;
}

export interface CustomerLedger {
    customerId: number;
    customerName: string;
    phone: string | null;
    startDate: string;
    endDate: string;
    currencyCode: string;
    openingBalance: number;
    totalSales: number;
    totalPayments: number;
    closingBalance: number;
    revenue: number;
    costOfGoodsSold: number;
    grossProfit: number;
    entries: LedgerEntry[];
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

export interface TrashItem {
    id: number;
    entityType: string;
    entityId: string;
    displayName: string;
    deletedAt: string;
    deletedByName: string | null;
    branchId: number | null;
    branchName: string | null;
    scheduledPurgeAt: string;
    snapshotJson: string | null;
}
