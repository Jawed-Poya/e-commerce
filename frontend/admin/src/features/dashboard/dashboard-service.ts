import apiClient from "@/api/api-client";
import type { AdminDashboardResponse } from "./dashboard-types";

export const dashboardService = {
    async get() {
        const response = await apiClient.get<AdminDashboardResponse>(
            "/admin/dashboard",
        );
        return response.data;
    },
};
