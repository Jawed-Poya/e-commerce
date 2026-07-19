import apiClient from "@/api/api-client";
import type { AdminProductReview } from "./review-types";

export const reviewService = {
    async list(approved?: boolean) {
        const response = await apiClient.get<AdminProductReview[]>(
            "/admin/reviews",
            approved === undefined ? undefined : { approved },
        );
        return response.data;
    },

    async setApproval(id: number, isApproved: boolean) {
        const response = await apiClient.patch<AdminProductReview>(
            `/admin/reviews/${id}/approval`,
            { isApproved },
        );
        return response.data;
    },

    async remove(id: number) {
        await apiClient.delete(`/admin/reviews/${id}`);
    },
};
