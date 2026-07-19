import { apiGet } from "../../shared/api/api-client";

export interface AccountOrder {
    id: number;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    status: string;
    paymentStatus: string;
    paymentMethod: string;
    total: number;
    currency: string;
    itemCount: number;
    createdAt: string;
}

export const getAccountOrders = () =>
    apiGet<AccountOrder[]>("/account/orders");
