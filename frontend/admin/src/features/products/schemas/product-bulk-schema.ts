import { z } from "zod";
import {
    isSupportedImageFile,
    MAXIMUM_IMAGE_FILE_SIZE,
} from "@/lib/image-files";

export const ProductBulkItemSchema = z
    .object({
        clientId: z.string().min(1),

        image: z
            .instanceof(File)
            .refine(
                isSupportedImageFile,
                "Only JPG, PNG, WEBP and AVIF images are supported.",
            )
            .refine(
                (file) => file.size <= MAXIMUM_IMAGE_FILE_SIZE,
                "Image must be smaller than 5 MB.",
            ),

        previewUrl: z.string().min(1),

        galleryImages: z
            .array(
                z.instanceof(File)
                    .refine(isSupportedImageFile, "Only JPG, PNG, WEBP and AVIF images are supported.")
                    .refine((file) => file.size <= MAXIMUM_IMAGE_FILE_SIZE, "Image must be smaller than 5 MB."),
            )
            .max(9, "A product can have a maximum of 10 images."),

        name: z
            .string()
            .trim()
            .min(2, "Product name must contain at least 2 characters.")
            .max(200, "Product name cannot exceed 200 characters."),

        barcode: z
            .string()
            .trim()
            .max(100, "Barcode cannot exceed 100 characters."),

        strength: z
            .string()
            .trim()
            .max(100, "Strength cannot exceed 100 characters."),

        shortDescription: z
            .string()
            .trim()
            .max(500, "Short description cannot exceed 500 characters."),

        description: z
            .string()
            .trim()
            .max(5000, "Description cannot exceed 5000 characters."),

        minimumValue: z
            .number()
            .int()
            .nonnegative("Minimum value cannot be negative.")
            .nullable(),

        maximumValue: z
            .number()
            .int()
            .nonnegative("Maximum value cannot be negative.")
            .nullable(),

        orderQuantityStep: z
            .number()
            .positive("Cart quantity step must be greater than zero."),

        quickOrderQuantities: z.array(z.number().positive()).max(8),

        minimumStockQuantity: z
            .number()
            .nonnegative("Minimum stock quantity cannot be negative."),

        usesDisplayStock: z.boolean(),

        displayStockQuantity: z
            .number()
            .nonnegative("Display quantity cannot be negative.")
            .nullable(),

        categoryId: z.number().int().positive("Please select a category."),

        brandId: z.number().int().positive().nullable(),

        unitId: z.number().int().positive().nullable(),

        isFeatured: z.boolean(),

        isActive: z.boolean(),

        slug: z.string().trim().max(250, "Slug cannot exceed 250 characters."),

        unitConversions: z.array(
            z.object({
                id: z.number().int().positive().nullable(),
                unitId: z.number().int().nonnegative(),
                conversionFactor: z.number(),
                barcode: z.string().max(100).nullable(),
                priceOverride: z.number().nullable(),
                oldPriceOverride: z.number().nullable(),
                orderQuantityStep: z.number().positive(),
                quickOrderQuantities: z.array(z.number().positive()).max(8),
                isDefault: z.boolean(),
                isActive: z.boolean(),
                sortOrder: z.number().int().nonnegative(),
            }),
        ),
        prices: z.array(z.object({
            customerTypeId: z.number().int().positive(),
            customerTypeName: z.string(),
            regularPrice: z.number().nonnegative(),
            salePrice: z.number().nonnegative().nullable(),
            startDate: z.string().nullable(),
            endDate: z.string().nullable(),
            isDefault: z.boolean(),
            enabled: z.boolean(),
        })),
    })
    .superRefine((product, context) => {
        if (
            product.minimumValue !== null &&
            product.maximumValue !== null &&
            product.minimumValue > product.maximumValue
        ) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["maximumValue"],
                message:
                    "Maximum value must be greater than or equal to minimum value.",
            });
        }

        if (product.usesDisplayStock && product.displayStockQuantity === null) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["displayStockQuantity"],
                message: "Enter the quantity customers should see.",
            });
        }

        const invalidBasePreset = product.quickOrderQuantities.some((value) =>
            value <= 0 || Math.abs(value / product.orderQuantityStep - Math.round(value / product.orderQuantityStep)) > 1e-9,
        );
        if (invalidBasePreset) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["quickOrderQuantities"],
                message: "Quick quantities must be multiples of the cart quantity step.",
            });
        }

        const invalidUnitPreset = product.unitConversions.some((unit) =>
            unit.quickOrderQuantities.some((value) =>
                value <= 0 || Math.abs(value / unit.orderQuantityStep - Math.round(value / unit.orderQuantityStep)) > 1e-9,
            ),
        );
        if (invalidUnitPreset) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["unitConversions"],
                message: "Selling-unit quick quantities must be multiples of that unit's cart step.",
            });
        }

        const defaultPrice = product.prices.find((price) => price.isDefault);
        if (!defaultPrice?.enabled) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["prices"],
                message: "A default customer price is required.",
            });
        }

        product.prices.forEach((price, index) => {
            if (!price.enabled) return;

            if (
                price.salePrice != null &&
                price.salePrice > price.regularPrice
            ) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["prices", index, "salePrice"],
                    message: "Sale price cannot exceed regular price.",
                });
            }

            if (
                price.startDate &&
                price.endDate &&
                price.endDate < price.startDate
            ) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["prices", index, "endDate"],
                    message: "Sale end date cannot be earlier than start date.",
                });
            }
        });
    });

export const ProductBulkFormSchema = z.object({
    products: z
        .array(ProductBulkItemSchema)
        .min(1, "Please select at least one image.")
        .max(50, "You can create a maximum of 50 products at once."),
});
