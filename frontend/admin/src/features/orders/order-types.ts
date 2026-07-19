export type OrderStatus = "Pending" | "Confirmed" | "Processing" | "Delivered" | "Returned" | "Cancelled";
export type PaymentStatus = "Pending" | "Authorized" | "Paid" | "PartiallyRefunded" | "Refunded" | "Failed" | "Cancelled";
export type FulfillmentStatus = "Unfulfilled" | "Processing" | "PartiallyFulfilled" | "Fulfilled" | "Returned" | "Cancelled";
export type PaymentMethod = "CashOnDelivery" | "BankTransfer";

export interface PagedResult<T> {
    items: T[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
}

export interface OrderListItem {
    id: number;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    paymentMethod: PaymentMethod;
    total: number;
    currency: string;
    itemCount: number;
    createdAt: string;
}

export interface OrderDetails {
    id: number;
    orderNumber: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    fulfillmentStatus: FulfillmentStatus;
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    shippingTotal: number;
    total: number;
    currency: string;
    notes: string | null;
    createdAt: string;
    updatedAt: string | null;
    reservationExpiresAt: string | null;
    customer: { id: number; name: string; phone: string; email: string | null; customerTypeName: string | null };
    shippingAddress: { label: string; recipientName: string; phone: string; addressLine1: string; addressLine2: string | null; city: string; state: string | null; country: string; postalCode: string | null };
    items: { id: number; productId: number; productName: string; productBarcode: string | null; quantity: number; unitPrice: number; discount: number; tax: number; total: number; currency: string }[];
    payments: { id: number; method: PaymentMethod; provider: string; externalReference: string | null; amount: number; currency: string; status: PaymentStatus; paidAt: string | null; failureReason: string | null; createdAt: string }[];
    statusHistory: { id: number; fromStatus: OrderStatus; toStatus: OrderStatus; note: string | null; changedByUserId: string | null; createdAt: string }[];
}
