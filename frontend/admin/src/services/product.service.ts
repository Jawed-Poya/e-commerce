import apiClient from "@/api/api-client";
import type { Product } from "@/schemas/product-schema";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "https://localhost:7060/api";
const apiOrigin = new URL(apiBaseUrl, window.location.origin).origin;

export function resolveProductImageUrl(path: string | null | undefined) {
    if (!path) return null;
    if (/^https?:\/\//i.test(path) || path.startsWith("blob:")) return path;
    return new URL(path.startsWith("/") ? path : `/${path}`, apiOrigin).toString();
}

export interface ProductListItem {
    id: number;
    name: string;
    barcode: string | null;
    shortDescription: string | null;
    description: string | null;
    slug: string | null;
    categoryId: number;
    categoryName: string;
    brandId: number | null;
    unitId: number | null;
    minimumValue: number | null;
    maximumValue: number | null;
    isFeatured: boolean;
    isActive: boolean;
    stock: number;
    price: number | null;
    primaryImageUrl: string | null;
}

export interface PagedProducts {
    items: ProductListItem[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
}

export type BulkUpdateProduct = Pick<ProductListItem,
    "id" | "name" | "barcode" | "categoryId" | "brandId" | "unitId" |
    "shortDescription" | "description" | "slug" | "minimumValue" |
    "maximumValue" | "isFeatured" | "isActive" | "primaryImageUrl"> & { image?: File };

function append(formData: FormData, key: string, value: string | number | boolean | null | undefined) {
    if (value !== null && value !== undefined) formData.append(key, String(value));
}

export const productService = {
    getAll(params?: { search?: string; page?: number; pageSize?: number }) {
        return apiClient.get<PagedProducts>("/products", params);
    },
    bulkUpdate(products: BulkUpdateProduct[]) {
        const formData = new FormData();
        products.forEach((product, index) => {
            const prefix = `Products[${index}]`;
            append(formData, `${prefix}.Id`, product.id);
            append(formData, `${prefix}.Name`, product.name.trim());
            append(formData, `${prefix}.Barcode`, product.barcode?.trim());
            append(formData, `${prefix}.ShortDescription`, product.shortDescription?.trim());
            append(formData, `${prefix}.Description`, product.description?.trim());
            append(formData, `${prefix}.Slug`, product.slug?.trim());
            append(formData, `${prefix}.CategoryId`, product.categoryId);
            append(formData, `${prefix}.BrandId`, product.brandId);
            append(formData, `${prefix}.UnitId`, product.unitId);
            append(formData, `${prefix}.MinimumValue`, product.minimumValue);
            append(formData, `${prefix}.MaximumValue`, product.maximumValue);
            append(formData, `${prefix}.IsFeatured`, product.isFeatured);
            append(formData, `${prefix}.IsActive`, product.isActive);
            if (product.image) formData.append(`${prefix}.Image`, product.image, product.image.name);
        });
        return apiClient.put<{ updatedCount: number }>("/products/bulk", formData);
    },
    getById(id: number) {
        return apiClient.get<Product>(`/products/${id}`);
    },
    create(data: Product) {
        return apiClient.post<number>("/products", data);
    },
    update(id: number, data: Product) {
        return apiClient.put<void>(`/products/${id}`, data);
    },
    delete(id: number) {
        return apiClient.delete<void>(`/products/${id}`);
    },
};
