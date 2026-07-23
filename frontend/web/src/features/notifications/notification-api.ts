import { apiGet } from "../../shared/api/api-client";

export interface StoreNotification {
    id: number;
    title: string;
    message: string;
    kind: "Price" | "Stock";
    productId: number;
    productName: string;
    link: string;
    createdAt: string;
}

export interface StoreNotificationsResponse {
    serverTime: string;
    items: StoreNotification[];
}

export function getStoreNotifications(after: string, productIds: number[]) {
    return apiGet<StoreNotificationsResponse>("/store/notifications", {
        after,
        productIds,
    });
}
