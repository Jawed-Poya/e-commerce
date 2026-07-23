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

        categoryId: z.number().int().positive("Please select a category."),

        brandId: z.number().int().positive().nullable(),

        unitId: z.number().int().positive().nullable(),

        isFeatured: z.boolean(),

        isActive: z.boolean(),

        slug: z.string().trim().max(250, "Slug cannot exceed 250 characters."),
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
    });

export const ProductBulkFormSchema = z.object({
    products: z
        .array(ProductBulkItemSchema)
        .min(1, "Please select at least one image.")
        .max(50, "You can create a maximum of 50 products at once."),
});
