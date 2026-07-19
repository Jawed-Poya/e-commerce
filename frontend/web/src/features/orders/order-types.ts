import type { OrderStatus, PaymentStatus } from "../checkout/checkout-types";

export type FulfillmentStatus =
    | "Unfulfilled"
    | "Processing"
    | "PartiallyFulfilled"
    | "Fulfilled"
    | "Returned"
    | "Cancelled";

export interface OrderTimelineItem {
    id: number;
    fromStatus: OrderStatus;
    toStatus: OrderStatus;
    note: string | null;
    changedByUserId: string | null;
    createdAt: string;
}

export interface OrderTracking {
    orderNumber: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    fulfillmentStatus: FulfillmentStatus;
    total: number;
    currency: string;
    createdAt: string;
    updatedAt: string | null;
    timeline: OrderTimelineItem[];
}
