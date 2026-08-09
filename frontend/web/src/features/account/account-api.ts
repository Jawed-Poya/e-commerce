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

export interface PagedAccountOrders {
    items: AccountOrder[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
}

export const getAccountOrders = (page = 1, pageSize = 10) =>
    apiGet<PagedAccountOrders>("/account/orders", { page, pageSize });
