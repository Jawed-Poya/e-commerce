import apiClient from "@/api/api-client";
import type { OrderDetails, OrderListItem, OrderStatus, PagedResult, PaymentStatus } from "./order-types";

export interface OrderFilters {
    search?: string;
    status?: OrderStatus | "";
    paymentStatus?: PaymentStatus | "";
    page?: number;
    pageSize?: number;
}

export const orderService = {
    async getOrders(filters: OrderFilters) {
        return (await apiClient.get<PagedResult<OrderListItem>>("/orders", filters)).data;
    },
    async getOrder(id: number) {
        return (await apiClient.get<OrderDetails>(`/orders/${id}`)).data;
    },
    async updateStatus(id: number, status: OrderStatus, note?: string) {
        return (await apiClient.patch<OrderDetails>(`/orders/${id}/status`, { status, note: note || null })).data;
    },
    async updatePayment(id: number, status: PaymentStatus, externalReference?: string, failureReason?: string) {
        return (await apiClient.patch<OrderDetails>(`/orders/${id}/payment`, {
            status,
            externalReference: externalReference || null,
            failureReason: failureReason || null,
        })).data;
    },
};
