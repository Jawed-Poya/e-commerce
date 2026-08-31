import apiClient from "@/api/api-client";
import type {
    ClearBusinessDataResult,
    DatabaseBackup,
    DatabaseMaintenanceStatus,
    DemoSeedResult,
} from "./maintenance-types";

export const maintenanceService = {
    status: async () =>
        (await apiClient.get<DatabaseMaintenanceStatus>("/admin/maintenance/status")).data,
    backups: async () =>
        (await apiClient.get<DatabaseBackup[]>("/admin/maintenance/backups")).data,
    createBackup: async () =>
        (await apiClient.post<DatabaseBackup>("/admin/maintenance/backups")).data,
    downloadBackup: (fileName: string) =>
        apiClient.download(
            `/admin/maintenance/backups/${encodeURIComponent(fileName)}/download`,
        ),
    restore: async (backupFileName: string, confirmation: string) =>
        (await apiClient.post<{ restored: boolean; backupFileName: string }>(
            "/admin/maintenance/restore",
            { backupFileName, confirmation },
        )).data,
    clear: async (request: { scope: "branch" | "all"; branchId?: number; confirmation: string }) =>
        (await apiClient.post<ClearBusinessDataResult>("/admin/maintenance/clear", request)).data,
    seedDemo: async (confirmation: string) =>
        (await apiClient.post<DemoSeedResult>("/admin/maintenance/seed-demo", { confirmation })).data,
};
