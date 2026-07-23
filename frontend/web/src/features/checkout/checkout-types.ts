export type PaymentMethod = "CashOnDelivery" | "BankTransfer";
export type OrderStatus =
    | "Pending"
    | "Confirmed"
    | "Processing"
    | "Delivered"
    | "Returned"
    | "Cancelled";
export type PaymentStatus =
    | "Pending"
    | "Authorized"
    | "Paid"
    | "PartiallyRefunded"
    | "Refunded"
    | "Failed"
    | "Cancelled";

export interface BankTransferDetails {
    bankName: string;
    accountName: string;
    accountNumber: string;
    iban: string | null;
    instructions: string;
}

export interface PaymentOption {
    method: PaymentMethod;
    name: string;
    description: string;
    requiresReference: boolean;
    bankDetails: BankTransferDetails | null;
}

export interface CheckoutConfiguration {
    currency: string;
    shippingEnabled: boolean;
    flatShippingFee: number;
    freeShippingThreshold: number;
    paymentMethods: PaymentOption[];
}

export interface CreateOrderRequest {
    customer: {
        firstName: string;
        lastName: string | null;
        phone: string;
        email: string | null;
    };
    shippingAddress: {
        label: string;
        recipientName: string;
        phone: string;
        addressLine1: string;
        addressLine2: string | null;
        city: string;
        state: string | null;
        country: string;
        postalCode: string | null;
    };
    paymentMethod: PaymentMethod;
    bankTransferReference: string | null;
    notes: string | null;
    items: { productId: number; quantity: number }[];
}

export interface OrderConfirmation {
    id: number;
    orderNumber: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    paymentMethod: PaymentMethod;
    subtotal: number;
    shippingTotal: number;
    total: number;
    currency: string;
    createdAt: string;
    reservationExpiresAt: string | null;
    bankDetails: BankTransferDetails | null;
}
