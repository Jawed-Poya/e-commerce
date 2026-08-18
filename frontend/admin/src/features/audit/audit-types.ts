export interface AuditPage<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}

export interface ActivityLogItem {
    id: number;
    createdAt: string;
    userName: string | null;
    action: string;
    entityName: string;
    entityId: number | null;
    description: string;
    changes: string | null;
    httpMethod: string | null;
    path: string | null;
    statusCode: number | null;
    durationMs: number | null;
    ipAddress: string | null;
    deviceType: string | null;
    browser: string | null;
    operatingSystem: string | null;
}

export interface CustomerVisitItem {
    id: number;
    createdAt: string;
    customerId: number | null;
    customerName: string | null;
    sessionId: string;
    path: string;
    referrer: string | null;
    ipAddress: string | null;
    deviceType: string | null;
    browser: string | null;
    operatingSystem: string | null;
    language: string | null;
    isAuthenticated: boolean;
}

export interface VisitAnalytics {
    generatedAt: string;
    onlineVisitors: number;
    authenticatedOnlineVisitors: number;
    visitsLast24Hours: number;
    uniqueVisitorsLast24Hours: number;
    topProducts: { label: string; path: string; visits: number }[];
    topSearches: { term: string; searches: number }[];
    activeVisitors: {
        sessionId: string;
        customerId: number | null;
        customerName: string | null;
        currentPath: string;
        pageTitle: string | null;
        firstSeenAt: string;
        lastSeenAt: string;
        deviceType: string | null;
        browser: string | null;
        operatingSystem: string | null;
        language: string | null;
        isAuthenticated: boolean;
    }[];
}

export const AuditActions = [
    "Create",
    "Update",
    "Delete",
    "Restore",
    "Login",
    "Logout",
    "View",
    "Search",
    "Upload",
    "Download",
    "Import",
    "Export",
    "Print",
    "Approve",
    "Reject",
    "PlaceOrder",
    "CancelOrder",
    "ChangePassword",
    "Archive",
    "Activate",
    "Deactivate",
    "Sync",
    "Assign",
    "Other",
] as const;

export type AuditAction = (typeof AuditActions)[number];
