import apiClient from "@/api/api-client";
import type { ActivityLogItem, AuditPage, CustomerVisitItem } from "./audit-types";

const base = "/admin/audit-logs";

export const auditService = {
    activities: (search = "", action = "", page = 1, pageSize = 50) =>
        apiClient.get<AuditPage<ActivityLogItem>>(`${base}/activities`, {
            search: search || undefined,
            action: action || undefined,
            page,
            pageSize,
        }),
    visits: (search = "", page = 1, pageSize = 50) =>
        apiClient.get<AuditPage<CustomerVisitItem>>(`${base}/visits`, {
            search: search || undefined,
            page,
            pageSize,
        }),
};
