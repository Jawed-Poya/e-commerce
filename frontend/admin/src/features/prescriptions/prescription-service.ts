import apiClient from "@/api/api-client";
import type {
    AdminPrescriptionRequest,
    PagedPrescriptionRequests,
    PrescriptionRequestStatus,
} from "./prescription-types";

export const prescriptionService = {
    async list(params: {
        search?: string;
        status?: PrescriptionRequestStatus;
        page?: number;
        pageSize?: number;
    }) {
        const response = await apiClient.get<PagedPrescriptionRequests>(
            "/admin/prescription-requests",
            params,
        );
        return response.data;
    },

    async updateStatus(
        id: number,
        input: { status: PrescriptionRequestStatus; adminNotes?: string | null },
    ) {
        const response = await apiClient.patch<AdminPrescriptionRequest>(
            `/admin/prescription-requests/${id}/status`,
            input,
        );
        return response.data;
    },

    async downloadAttachment(id: number) {
        await apiClient.download(`/admin/prescription-requests/${id}/attachment`);
    },
};
