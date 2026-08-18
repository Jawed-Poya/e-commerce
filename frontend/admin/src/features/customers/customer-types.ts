import type { OrderStatus, PagedResult } from "@/features/orders/order-types";

export type { PagedResult };

export interface CustomerListItem {
    id: number;
    name: string;
    phone: string;
    whatsAppUrl: string | null;
    email: string | null;
    customerTypeName: string | null;
    orderCount: number;
    totalSpent: number;
    outstandingDebt: number;
    accountCredit: number;
    creditLimit: number;
    hasOverdueDebt: boolean;
    isOnline: boolean;
    activeSessions: number;
    lastOrderAt: string | null;
    createdAt: string;
}

export interface CustomerDetails {
    id: number;
    firstName: string;
    lastName: string | null;
    phone: string;
    whatsAppUrl: string | null;
    email: string | null;
    address: string | null;
    customerTypeId: number | null;
    customerTypeName: string | null;
    outstandingDebt: number;
    accountCredit: number;
    creditLimit: number;
    debtDueDays: number;
    hasOverdueDebt: boolean;
    createdAt: string;
    updatedAt: string | null;
    addresses: { id: number; label: string; recipientName: string; phone: string; addressLine1: string; addressLine2: string | null; city: string; state: string | null; country: string; postalCode: string | null; isDefaultShipping: boolean; isDefaultBilling: boolean }[];
    orders: { id: number; orderNumber: string; status: OrderStatus; total: number; currency: string; createdAt: string }[];
}

export interface CustomerEngagement {
    customerId: number;
    isOnline: boolean;
    activeSessions: number;
    currentPath: string | null;
    pageTitle: string | null;
    lastSeenAt: string | null;
    visitsLast30Days: number;
    uniqueSessionsLast30Days: number;
    productViewsLast30Days: number;
    searchesLast30Days: number;
    lastSearchTerm: string | null;
}

export interface UpsertCustomerRequest {
    firstName: string;
    lastName: string | null;
    phone: string;
    email: string | null;
    address: string | null;
    customerTypeId: number | null;
    creditLimit?: number | null;
    debtDueDays?: number | null;
}
