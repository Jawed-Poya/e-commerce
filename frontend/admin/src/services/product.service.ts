import apiClient from "@/api/api-client";
import type { Product } from "@/features/products/schemas/product-schema";

export const productService = {
    getAll() {
        return apiClient.get<Product[]>("/products");
    },

    getById(id: number) {
        return apiClient.get<Product>(`/products/${id}`);
    },

    create(data: Product) {
        return apiClient.post<Product>("/products", data);
    },

    update(id: number, data: Product) {
        return apiClient.put<Product>(`/products/${id}`, data);
    },

    delete(id: number) {
        return apiClient.delete(`/products/${id}`);
    },
};
