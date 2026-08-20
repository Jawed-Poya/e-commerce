import { apiGet, apiPost } from "../../shared/api/api-client";

export interface StoreNotification {
    id: number;
    title: string;
    message: string;
    kind: "Price" | "Stock" | "Cart";
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

export interface StorePushPublicKeyResponse {
    publicKey: string;
}

export interface StorePushSubscriptionPayload {
    endpoint: string;
    p256dh: string;
    auth: string;
    productIds: number[];
}

export function getStorePushPublicKey() {
    return apiGet<StorePushPublicKeyResponse>(
        "/store/notifications/push/public-key",
    );
}

export function saveStorePushSubscription(
    payload: StorePushSubscriptionPayload,
) {
    return apiPost<{ subscribed: boolean }>(
        "/store/notifications/push/subscription",
        payload,
    );
}

export function removeStorePushSubscription(endpoint: string) {
    return apiPost<{ subscribed: boolean }>(
        "/store/notifications/push/unsubscribe",
        { endpoint },
    );
}
