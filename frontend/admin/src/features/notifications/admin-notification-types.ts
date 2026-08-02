export interface AdminNotification {
    id: number;
    title: string;
    message: string;
    kind: "Order" | "Payment" | "Review" | "Expiry" | string;
    entityId: number | null;
    link: string;
    createdAt: string;
}

export interface AdminNotificationsResponse {
    serverTime: string;
    items: AdminNotification[];
}
