import apiClient from "@/api/api-client";
import type { Branch, PlatformUpdateTenantRequest, PublicTenantProfile, TenantPlan, TenantProfile, TenantReportSummary, TenantSettings, TrashItem, SubscriptionStatus } from "./tenant-types";

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
    createTenant: async (request: { name: string; slug: string; adminFullName: string; adminEmail: string; adminPassword: string; plan: TenantPlan; mainCurrencyCode: string }) =>
        (await apiClient.post<TenantProfile>("/platform/tenants", request)).data,
    updateTenant: async (id: number, request: PlatformUpdateTenantRequest) =>
        (await apiClient.put<TenantProfile>(`/platform/tenants/${id}`, request)).data,
    updateSubscription: async (id: number, request: { plan: TenantPlan; status: SubscriptionStatus; endsAt: string | null }) =>
        (await apiClient.put<TenantProfile>(`/platform/tenants/${id}/subscription`, request)).data,
};
