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
        appendOptionalValue(formData, `${prefix}.Strength`, product.strength);

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

        formData.append(`${prefix}.OrderQuantityStep`, String(product.orderQuantityStep));

        appendOptionalValue(
            formData,
            `${prefix}.MinimumStockQuantity`,
            product.minimumStockQuantity,
        );

        formData.append(`${prefix}.UsesDisplayStock`, String(product.usesDisplayStock));
        if (product.usesDisplayStock) {
            appendOptionalValue(
                formData,
                `${prefix}.DisplayStockQuantity`,
                product.displayStockQuantity ?? 0,
            );
        }

        appendOptionalValue(formData, `${prefix}.BrandId`, product.brandId);

        appendOptionalValue(formData, `${prefix}.UnitId`, product.unitId);

        appendOptionalValue(formData, `${prefix}.Slug`, product.slug);

        product.prices.filter((price) => price.enabled).forEach((price, priceIndex) => {
            const pricePrefix = `${prefix}.Prices[${priceIndex}]`;
            formData.append(`${pricePrefix}.CustomerTypeId`, String(price.customerTypeId));
            formData.append(`${pricePrefix}.RegularPrice`, String(price.regularPrice));
            appendOptionalValue(formData, `${pricePrefix}.SalePrice`, price.salePrice);
            appendOptionalValue(formData, `${pricePrefix}.StartDate`, price.startDate);
            appendOptionalValue(formData, `${pricePrefix}.EndDate`, price.endDate);
        });

        product.unitConversions.forEach((unit, unitIndex) => {
            const unitPrefix = `${prefix}.UnitConversions[${unitIndex}]`;
            appendOptionalValue(formData, `${unitPrefix}.Id`, unit.id);
            formData.append(`${unitPrefix}.UnitId`, String(unit.unitId));
            formData.append(
                `${unitPrefix}.ConversionFactor`,
                String(unit.conversionFactor),
            );
            appendOptionalValue(formData, `${unitPrefix}.Barcode`, unit.barcode);
            appendOptionalValue(
                formData,
                `${unitPrefix}.PriceOverride`,
                unit.priceOverride,
            );
            appendOptionalValue(
                formData,
                `${unitPrefix}.OldPriceOverride`,
                unit.oldPriceOverride,
            );
            formData.append(`${unitPrefix}.OrderQuantityStep`, String(unit.orderQuantityStep));
            formData.append(`${unitPrefix}.IsDefault`, String(unit.isDefault));
            formData.append(`${unitPrefix}.IsActive`, String(unit.isActive));
            formData.append(`${unitPrefix}.SortOrder`, String(unit.sortOrder));
        });
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
