import apiClient from "@/api/api-client";
import type { AdminProductReview, PagedResult } from "./review-types";

export const reviewService = {
    async list(approved: boolean | undefined, page = 1, pageSize = 20) {
        const response = await apiClient.get<PagedResult<AdminProductReview>>(
            "/admin/reviews",
            { approved, page, pageSize },
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
