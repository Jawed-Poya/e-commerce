export interface ProductLookupOption {
    id: number;
    name: string;
    parentId?: number | null;
}

export interface ProductLookups {
    categories: ProductLookupOption[];
    brands: ProductLookupOption[];
    units: ProductLookupOption[];
    customerTypes: ProductLookupOption[];
    defaultCustomerTypeId: number;
}

export interface ProductBulkPriceFormValue {
    customerTypeId: number;
    customerTypeName: string;
    regularPrice: number;
    salePrice: number | null;
    startDate: string | null;
    endDate: string | null;
    isDefault: boolean;
    enabled: boolean;
}

export interface ProductBulkItemFormValues {
    clientId: string;

    image: File;
    previewUrl: string;
    galleryImages: File[];

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

    prices: ProductBulkPriceFormValue[];
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
