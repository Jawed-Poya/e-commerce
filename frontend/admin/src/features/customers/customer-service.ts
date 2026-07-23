import apiClient from "@/api/api-client";
import type { CustomerDetails, CustomerListItem, PagedResult, UpsertCustomerRequest } from "./customer-types";

export const customerService = {
    async getCustomers(params: { search?: string; page?: number; pageSize?: number }) {
        return (await apiClient.get<PagedResult<CustomerListItem>>("/customers", params)).data;
    },
    async getCustomer(id: number) {
        return (await apiClient.get<CustomerDetails>(`/customers/${id}`)).data;
    },
    async createCustomer(request: UpsertCustomerRequest) {
        return (await apiClient.post<CustomerDetails>("/customers", request)).data;
    },
    async updateCustomer(id: number, request: UpsertCustomerRequest) {
        return (await apiClient.put<CustomerDetails>(`/customers/${id}`, request)).data;
    },
};
