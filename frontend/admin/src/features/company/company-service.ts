import apiClient from "@/api/api-client";
import axiosInstance, { resolveApiAssetUrl } from "@/api/axios";
import type {
    CompanyBranch,
    CompanyProfile,
    CompanySettings,
    CustomerLedger,
    PublicCompanyProfile,
    TrashItem,
} from "./company-types";

export type UpdateCompanyProfile = Pick<
    CompanyProfile,
    "name" | "legalName" | "registrationNumber" | "email" | "phone" | "address" | "logoUrl" | "faviconUrl"
>;
export type UpsertCompanyBranch = Omit<CompanyBranch, "id">;

export function resolveCompanyAssetUrl(path: string | null | undefined) {
    return resolveApiAssetUrl(path);
}

export const companyService = {
    publicProfile: async () =>
        (await apiClient.get<PublicCompanyProfile>("/company/public-profile")).data,
    profile: async () =>
        (await apiClient.get<CompanyProfile>("/company/profile")).data,
    updateProfile: async (request: UpdateCompanyProfile) =>
        (await apiClient.put<CompanyProfile>("/company/profile", request)).data,
    uploadBrandAsset: async (assetType: "logo" | "favicon", image: File) => {
        const form = new FormData();
        form.append("image", image, image.name);
        const response = await axiosInstance.post<{
            data: { assetType: string; imageUrl: string };
        }>(`/company/assets/${assetType}`, form);
        return response.data.data.imageUrl;
    },
    updateSettings: async (request: CompanySettings) =>
        (await apiClient.put<CompanyProfile>("/company/settings", request)).data,
    updateOperationLimits: async (request: Pick<CompanySettings, "maximumPurchaseLines" | "maximumManualSaleLines">) =>
        (await apiClient.put<CompanyProfile>("/company/operation-limits", request)).data,
    createBranch: async (request: UpsertCompanyBranch) =>
        (await apiClient.post<CompanyBranch>("/company/branches", request)).data,
    updateBranch: async (id: number, request: UpsertCompanyBranch) =>
        (await apiClient.put<CompanyBranch>(`/company/branches/${id}`, request)).data,

    customerLedger: async (
        customerId: number,
        params: { startDate?: string; endDate?: string; currencyCode?: string },
    ) =>
        (await apiClient.get<CustomerLedger>(`/admin/reports/customers/${customerId}/ledger`, params)).data,

    exportCustomerLedger: (
        customerId: number,
        format: "excel" | "pdf",
        params: { startDate?: string; endDate?: string; currencyCode?: string },
    ) => apiClient.download(`/admin/reports/customers/${customerId}/ledger/export/${format}`, params),
    exportOperationalPdf: (
        document: "products" | "sales" | "purchases" | "payroll" | "expenses",
        params?: { startDate?: string; endDate?: string; branchId?: string | number; currencyCode?: string; search?: string },
    ) => apiClient.download(`/admin/documents/${document}/pdf`, params),
    trash: async (params?: Record<string, unknown>) =>
        (await apiClient.get<TrashItem[]>("/admin/trash", params)).data,
    restoreTrash: async (id: number) => apiClient.post(`/admin/trash/${id}/restore`),
    purgeTrash: async (id: number) => apiClient.delete(`/admin/trash/${id}`),

    downloadReceipt: (source: "orders" | "manual-sales", id: number, format: "pdf" | "image", thermal = false) =>
        apiClient.download(`/admin/receipts/${source}/${id}/${format}`, { thermal }),
    receiptPreviewUrl: (source: "orders" | "manual-sales", id: number) =>
        apiClient.createObjectUrl(`/admin/receipts/${source}/${id}/pdf`),
};
