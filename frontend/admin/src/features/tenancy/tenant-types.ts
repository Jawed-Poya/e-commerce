export type TenantPlan = "Free" | "Premium" | "Full" | "Enterprise";
export type SubscriptionStatus = "Trial" | "Active" | "PastDue" | "Suspended" | "Cancelled" | "Expired";

export interface Branch {
    id: number;
    name: string;
    code: string;
    phone: string | null;
    address: string | null;
    isMain: boolean;
    isActive: boolean;
}

export interface TenantSubscription {
    id: number;
    plan: TenantPlan;
    status: SubscriptionStatus;
    startsAt: string;
    endsAt: string | null;
    maxUsers: number;
    maxBranches: number;
    maxProducts: number;
    monthlyPrice: number;
    billingCurrencyCode: string;
}

export interface TenantSettings {
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
    allowTenantUserClaimManagement: boolean;
}

export interface PublicTenantProfile {
    id: number;
    name: string;
    slug: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    settings: TenantSettings;
}

export interface TenantProfile extends PublicTenantProfile {
    legalName: string | null;
    registrationNumber: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    branches: Branch[];
    subscription: TenantSubscription | null;
    enabledPermissions: string[];
}

export interface TenantReportTrendPoint { date: string; revenue: number; cost: number; net: number }
export interface TenantTopProduct { productId: number; productName: string; quantity: number; revenue: number }
export interface TenantReportLine { source: string; id: number; reference: string; date: string; description: string; status: string; amount: number; paidAmount: number; balanceAmount: number; currencyCode: string; direction: "in" | "out"; branchId: number | null; branchName: string | null }
export interface TenantReportSummary {
    startDate: string; endDate: string; currencyCode: string; availableCurrencies: string[];
    onlineRevenue: number; manualSalesRevenue: number; totalRevenue: number; cashReceived: number;
    purchases: number; expenses: number; payrollObligation: number; payrollPaid: number; cashPaid: number;
    netCashFlow: number; operatingBalance: number; outstandingReceivables: number; outstandingSupplierPayables: number; outstandingPayroll: number;
    onlineOrders: number; manualSales: number; purchaseCount: number; customerCount: number; productCount: number; lowStockProducts: number;
    averageOrderValue: number; trend: TenantReportTrendPoint[]; topProducts: TenantTopProduct[]; results: TenantReportLine[];
    totalResults: number; page: number; pageSize: number;
}

export interface TrashItem { id: number; entityType: string; entityId: string; displayName: string; deletedAt: string; deletedByName: string | null; branchId: number | null; branchName: string | null; scheduledPurgeAt: string; snapshotJson: string | null }
