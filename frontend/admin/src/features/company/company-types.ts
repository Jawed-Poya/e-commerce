export type ExpiryAlertSound =
    | "critical-pulse"
    | "urgent-alarm"
    | "warning-chime";

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
    defaultQuickOrderQuantities: number[];
    trashRetentionDays: number;
    notificationRetentionDays: number;
    expiryAlertsEnabled: boolean;
    expiryAlertPeriods: number[];
    expiryAlertSoundEnabled: boolean;
    expiryAlertSound: ExpiryAlertSound;
    maximumPurchaseLines: number;
    maximumManualSaleLines: number;
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

export interface PagedResult<T> {
    items: T[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
}
