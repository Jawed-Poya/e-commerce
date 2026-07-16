export interface ProductLookupOption {
    id: number;
    name: string;
}

export interface ProductLookups {
    categories: ProductLookupOption[];
    brands: ProductLookupOption[];
    units: ProductLookupOption[];
}

export interface ProductBulkItemFormValues {
    clientId: string;

    image: File;
    previewUrl: string;

    name: string;
    barcode: string;
    shortDescription: string;
    description: string;

    minimumValue: number | null;
    maximumValue: number | null;

    categoryId: number;
    brandId: number | null;
    unitId: number | null;

    isFeatured: boolean;
    isActive: boolean;

    slug: string;
}

export interface ProductBulkFormValues {
    products: ProductBulkItemFormValues[];
}

export type CreateBulkProductItem = Omit<
    ProductBulkItemFormValues,
    "clientId" | "previewUrl"
>;

export interface CreateBulkProductsRequest {
    products: CreateBulkProductItem[];
}

export interface CreatedProduct {
    id: number;
    name: string;
    imageUrl?: string;
}
