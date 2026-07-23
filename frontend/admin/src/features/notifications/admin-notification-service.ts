import apiClient from "@/api/api-client";
import type { AdminNotificationsResponse } from "./admin-notification-types";

export const adminNotificationService = {
    async get(after?: string, take = 30) {
        return (
            await apiClient.get<AdminNotificationsResponse>(
                "/admin/notifications",
                { after, take },
            )
        ).data;
    },
};
