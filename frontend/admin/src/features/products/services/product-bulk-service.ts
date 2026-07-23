import type { ApiResponse } from "@/api/api-client";
import type {
    CreateBulkProductsRequest,
    CreatedProduct,
    ProductLookups,
} from "../types/product-bulk-types";
import apiClient from "@/api/api-client";

function appendOptionalValue(
    formData: FormData,
    key: string,
    value: string | number | null | undefined,
) {
    if (value === null || value === undefined) {
        return;
    }

    const normalizedValue =
        typeof value === "string" ? value.trim() : String(value);

    if (normalizedValue === "") {
        return;
    }

    formData.append(key, normalizedValue);
}

function createProductsFormData(request: CreateBulkProductsRequest): FormData {
    const formData = new FormData();

    request.products.forEach((product, index) => {
        const prefix = `Products[${index}]`;

        if (!(product.image instanceof File)) {
            throw new Error(
                `The image for product "${product.name}" is not a valid file.`,
            );
        }

        if (product.image.size === 0) {
            throw new Error(
                `The image for product "${product.name}" is empty.`,
            );
        }

        formData.append(`${prefix}.Image`, product.image, product.image.name);
        product.galleryImages.forEach((image) =>
            formData.append(`${prefix}.GalleryImages`, image, image.name),
        );

        formData.append(`${prefix}.Name`, product.name.trim());

        formData.append(`${prefix}.CategoryId`, String(product.categoryId));

        formData.append(`${prefix}.IsFeatured`, String(product.isFeatured));

        formData.append(`${prefix}.IsActive`, String(product.isActive));

        appendOptionalValue(formData, `${prefix}.Barcode`, product.barcode);

        appendOptionalValue(
            formData,
            `${prefix}.ShortDescription`,
            product.shortDescription,
        );

        appendOptionalValue(
            formData,
            `${prefix}.Description`,
            product.description,
        );

        appendOptionalValue(
            formData,
            `${prefix}.MinimumValue`,
            product.minimumValue,
        );

        appendOptionalValue(
            formData,
            `${prefix}.MaximumValue`,
            product.maximumValue,
        );

        appendOptionalValue(formData, `${prefix}.BrandId`, product.brandId);

        appendOptionalValue(formData, `${prefix}.UnitId`, product.unitId);

        appendOptionalValue(formData, `${prefix}.Slug`, product.slug);
    });

    return formData;
}

export const ProductService = {
    async GetLookups(): Promise<ProductLookups> {
        const response =
            await apiClient.get<ProductLookups>("/products/lookups");

        return response.data;
    },

    async CreateBulk(
        request: CreateBulkProductsRequest,
    ): Promise<ApiResponse<CreatedProduct[]>> {
        const formData = createProductsFormData(request);

        const response = await apiClient.post<ApiResponse<CreatedProduct[]>>(
            "/products/bulk",
            formData,
        );

        return response.data;
    },
};
