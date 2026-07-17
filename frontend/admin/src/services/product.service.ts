import apiClient from "@/api/api-client";
import { apiOrigin } from "@/api/axios";

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
    images: ProductListImage[];
}

export interface ProductListImage {
    id: number;
    url: string;
    isPrimary: boolean;
    sortOrder: number;
}

export interface ProductDetails extends Omit<ProductListItem, "stock" | "price" | "primaryImageUrl" | "images"> {
    brandName: string | null;
    unitName: string | null;
    viewCount: number;
    createdAt: string;
    updatedAt: string | null;
    inventory: { quantity: number; reservedQuantity: number; availableQuantity: number; minimumQuantity: number; expireDate: string | null } | null;
    prices: { id: number; customerTypeName: string; regularPrice: number; salePrice: number | null; startDate: string | null; endDate: string | null }[];
    images: (ProductListImage & { originalFileName: string | null; contentType: string; size: number })[];
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

export interface ProductListFilters {
    search?: string;
    page?: number;
    pageSize?: number;
    categoryId?: number;
    brandId?: number;
    unitId?: number;
    isFeatured?: boolean;
    isActive?: boolean;
    minPrice?: number;
    maxPrice?: number;
    sortBy?: "name" | "price" | "createdAt";
    sortDescending?: boolean;
}

export type BulkUpdateProduct = Pick<ProductListItem,
    "id" | "name" | "barcode" | "categoryId" | "brandId" | "unitId" |
    "shortDescription" | "description" | "slug" | "minimumValue" |
    "maximumValue" | "isFeatured" | "isActive" | "primaryImageUrl" | "images"> & { image?: File; galleryImages?: File[]; removedImageIds?: number[] };

function append(formData: FormData, key: string, value: string | number | boolean | null | undefined) {
    if (value !== null && value !== undefined) formData.append(key, String(value));
}

export const productService = {
    getAll(params?: ProductListFilters) {
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
            product.galleryImages?.forEach(image => formData.append(`${prefix}.GalleryImages`, image, image.name));
            product.removedImageIds?.forEach(id => formData.append(`${prefix}.RemovedImageIds`, String(id)));
        });
        return apiClient.put<{ updatedCount: number }>("/products/bulk", formData);
    },
    getById(id: number) {
        return apiClient.get<ProductDetails>(`/products/${id}`);
    },
    deleteMany(ids: number[]) {
        return Promise.all(ids.map(id => apiClient.delete<void>(`/products/${id}`)));
    },
};
