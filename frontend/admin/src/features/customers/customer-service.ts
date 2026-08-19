import apiClient from "@/api/api-client";

import type {
    CustomerDetails,
    CustomerEngagement,
    CustomerListItem,
    PagedResult,
    UpsertCustomerRequest,
} from "./customer-types";

export interface CustomerListParams {
    search?: string;
    page?: number;
    pageSize?: number;
}

const CustomerEndpoints = {
    list: "/customers",
    details: (id: number) => `/customers/${id}`,
    engagement: (id: number) => `/customers/${id}/engagement`,
} as const;

export const customerService = {
    async getCustomers(params: CustomerListParams) {
        return (
            await apiClient.get<PagedResult<CustomerListItem>>(CustomerEndpoints.list, params)
        ).data;
    },

    async getCustomer(id: number) {
        return (await apiClient.get<CustomerDetails>(CustomerEndpoints.details(id))).data;
    },

    async getEngagement(id: number) {
        return (
            await apiClient.get<CustomerEngagement>(CustomerEndpoints.engagement(id))
        ).data;
    },

    async createCustomer(request: UpsertCustomerRequest) {
        return (await apiClient.post<CustomerDetails>(CustomerEndpoints.list, request)).data;
    },

    async updateCustomer(id: number, request: UpsertCustomerRequest) {
        return (
            await apiClient.put<CustomerDetails>(CustomerEndpoints.details(id), request)
        ).data;
    },
};
