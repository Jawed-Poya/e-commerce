import apiClient, { type ApiResponse } from "@/api/api-client";
import type { Product } from "@/schemas/product-schema";

export const productService = {
    getAll() {
        return apiClient.get<ApiResponse<Product[]>>("/products");
    },

    getById(id: number) {
        return apiClient.get<ApiResponse<Product>>(`/products/${id}`);
    },

    create(data: Product) {
        return apiClient.post<ApiResponse<Product>>("/products", data);
    },

    update(id: number, data: Product) {
        return apiClient.put<ApiResponse<Product>>(`/products/${id}`, data);
    },

    delete(id: number) {
        return apiClient.delete(`/products/${id}`);
    },
};
