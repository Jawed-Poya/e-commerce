export type TenantPlan = "Free" | "Premium" | "Full" | "Enterprise";
export type SubscriptionStatus = "Trial" | "Active" | "PastDue" | "Suspended" | "Cancelled" | "Expired";
export type TenantSiteRoutingMode = "QueryString" | "Subdomain" | "CustomDomain" | "PlatformPath";
export type StorefrontAccessMode = "Public" | "Private";

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
    subscriptionPlanId: number | null;
    planName: string;
    plan: TenantPlan;
    status: SubscriptionStatus;
    startsAt: string;
    endsAt: string | null;
    maxUsers: number;
    maxBranches: number;
    maxProducts: number;
    maxOrdersPerMonth: number;
    maxStorageMb: number;
    monthlyPrice: number;
    billingCurrencyCode: string;
    notes: string | null;
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
    notificationRetentionDays: number;
    allowTenantUserClaimManagement: boolean;
}

export interface TenantSiteLink {
    routingMode: TenantSiteRoutingMode;
    accessMode: StorefrontAccessMode;
    isPublished: boolean;
    storefrontKey: string;
    storefrontUrl: string | null;
    adminUrl: string;
    workspaceCode: string;
    customDomain: string | null;
    storefrontBaseUrlOverride: string | null;
}

export interface StorefrontPreviewLink { url: string; expiresAt: string }


export interface PublicTenantProfile {
    id: number;
    name: string;
    slug: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    storefrontUrl: string | null;
    settings: TenantSettings;
}

export interface TenantProfile extends PublicTenantProfile {
    legalName: string | null;
    registrationNumber: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    site: TenantSiteLink;
    branches: Branch[];
    subscription: TenantSubscription | null;
    enabledPermissions: string[];
}


export interface CreateTenantRequest {
    name: string;
    slug: string;
    adminFullName: string;
    adminEmail: string;
    adminPassword: string;
    subscriptionPlanId: number | null;
    plan: TenantPlan | null;
    mainCurrencyCode: string;
    siteRoutingMode: TenantSiteRoutingMode;
    storefrontAccessMode: StorefrontAccessMode;
    isStorefrontPublished: boolean;
    customDomain: string | null;
    storefrontBaseUrlOverride: string | null;
    maxUsers: number | null;
    maxBranches: number | null;
    maxProducts: number | null;
    maxOrdersPerMonth: number | null;
    maxStorageMb: number | null;
    monthlyPrice: number | null;
}

export interface PlatformUpdateTenantRequest {
    name: string;
    slug: string;
    legalName: string | null;
    registrationNumber: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    logoUrl: string | null;
    faviconUrl: string | null;
    siteRoutingMode: TenantSiteRoutingMode;
    storefrontAccessMode: StorefrontAccessMode;
    isStorefrontPublished: boolean;
    customDomain: string | null;
    storefrontBaseUrlOverride: string | null;
    settings: TenantSettings;
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


export interface PlatformSettings {
    storefrontBaseUrl: string;
    adminBaseUrl: string;
    rootDomain: string | null;
    defaultRoutingMode: TenantSiteRoutingMode;
    allowCustomDomains: boolean;
}

export interface SubscriptionPlan {
    id: number;
    code: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    isActive: boolean;
    sortOrder: number;
    legacyPlan: TenantPlan;
    monthlyPrice: number;
    yearlyPrice: number;
    currencyCode: string;
    maxUsers: number;
    maxBranches: number;
    maxProducts: number;
    maxOrdersPerMonth: number;
    maxStorageMb: number;
    enabledPermissions: string[];
}

export type UpsertSubscriptionPlanRequest = Omit<SubscriptionPlan, "id" | "isSystem">;

export interface UpdateTenantSubscriptionRequest {
    subscriptionPlanId: number | null;
    plan: TenantPlan | null;
    status: SubscriptionStatus;
    endsAt: string | null;
    maxUsers: number | null;
    maxBranches: number | null;
    maxProducts: number | null;
    maxOrdersPerMonth: number | null;
    maxStorageMb: number | null;
    monthlyPrice: number | null;
    billingCurrencyCode: string | null;
    notes: string | null;
}
