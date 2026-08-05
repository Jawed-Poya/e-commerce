export interface DatabaseMaintenanceStatus {
    databaseName: string;
    backupConfigured: boolean;
    restoreEnabled: boolean;
    backupDirectory: string | null;
    uploadDirectory: string;
    hostPlatform: string;
}

export interface DatabaseBackup {
    fileName: string;
    physicalPath: string;
    startedAt: string;
    finishedAt: string | null;
    sizeBytes: number;
    backupType: string;
}

export interface ClearBusinessDataResult {
    scope: "branch" | "all";
    branchId: number | null;
    deletedRecords: number;
    deletedByArea: Record<string, number>;
}

export interface DemoSeedResult {
    branchId: number;
    products: number;
    customers: number;
    purchases: number;
    sales: number;
    orders: number;
    lightweightImages: number;
}
