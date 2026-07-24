import apiClient from "@/api/api-client";
import type {
    Branch,
    CreateTenantRequest,
    PlatformSettings,
    PlatformUpdateTenantRequest,
    PublicTenantProfile,
    SubscriptionPlan,
    TenantProfile,
    TenantReportSummary,
    TenantSettings,
    TrashItem,
    UpdateTenantSubscriptionRequest,
    UpsertSubscriptionPlanRequest,
} from "./tenant-types";

export const tenantService = {
    publicProfile: async () => (await apiClient.get<PublicTenantProfile>("/tenant/public-profile")).data,
    profile: async () => (await apiClient.get<TenantProfile>("/tenant/profile")).data,
    updateProfile: async (request: Pick<TenantProfile, "name" | "legalName" | "registrationNumber" | "email" | "phone" | "address" | "logoUrl" | "faviconUrl">) =>
        (await apiClient.put<TenantProfile>("/tenant/profile", request)).data,
    updateSettings: async (request: TenantSettings) => (await apiClient.put<TenantProfile>("/tenant/settings", request)).data,
    createBranch: async (request: Omit<Branch, "id">) => (await apiClient.post<Branch>("/tenant/branches", request)).data,
    updateBranch: async (id: number, request: Omit<Branch, "id">) => (await apiClient.put<Branch>(`/tenant/branches/${id}`, request)).data,
    reports: async (params: Record<string, unknown>) => (await apiClient.get<TenantReportSummary>("/admin/reports", params)).data,
    trash: async (params?: Record<string, unknown>) => (await apiClient.get<TrashItem[]>("/admin/trash", params)).data,
    restoreTrash: async (id: number) => apiClient.post(`/admin/trash/${id}/restore`),
    purgeTrash: async (id: number) => apiClient.delete(`/admin/trash/${id}`),

    platformTenants: async () => (await apiClient.get<TenantProfile[]>("/platform/tenants")).data,
    createTenant: async (request: CreateTenantRequest) =>
        (await apiClient.post<TenantProfile>("/platform/tenants", request)).data,
    updateTenant: async (id: number, request: PlatformUpdateTenantRequest) =>
        (await apiClient.put<TenantProfile>(`/platform/tenants/${id}`, request)).data,
    updateSubscription: async (id: number, request: UpdateTenantSubscriptionRequest) =>
        (await apiClient.put<TenantProfile>(`/platform/tenants/${id}/subscription`, request)).data,

    platformSettings: async () => (await apiClient.get<PlatformSettings>("/platform/settings")).data,
    updatePlatformSettings: async (request: PlatformSettings) =>
        (await apiClient.put<PlatformSettings>("/platform/settings", request)).data,

    plans: async (includeInactive = true) =>
        (await apiClient.get<SubscriptionPlan[]>("/platform/plans", { includeInactive })).data,
    createPlan: async (request: UpsertSubscriptionPlanRequest) =>
        (await apiClient.post<SubscriptionPlan>("/platform/plans", request)).data,
    updatePlan: async (id: number, request: UpsertSubscriptionPlanRequest) =>
        (await apiClient.put<SubscriptionPlan>(`/platform/plans/${id}`, request)).data,
    archivePlan: async (id: number) => apiClient.delete(`/platform/plans/${id}`),
};
