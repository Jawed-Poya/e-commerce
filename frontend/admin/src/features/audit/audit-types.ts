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
