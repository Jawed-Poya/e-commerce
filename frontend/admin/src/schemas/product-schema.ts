import { z } from "zod";

export const ProductSchema = z.object({
    id: z.number().optional(),

    name: z
        .string()
        .min(2, "Product name must be at least 2 characters")
        .max(200),

    barcode: z.string().max(100).optional().nullable(),

    shortDescription: z.string().max(500).optional().nullable(),

    description: z.string().optional().nullable(),

    categoryId: z
        .number({
            message: "Category is required",
        })
        .min(1),

    brandId: z.number().optional().nullable(),

    unitId: z
        .number({
            message: "Unit is required",
        })
        .min(1),

    slug: z.string().max(250).optional().nullable(),

    isFeatured: z.boolean().default(false),

    isActive: z.boolean().default(true),

    images: z
        .array(
            z.object({
                id: z.number().optional(),

                imageUrl: z.string(),

                thumbnailUrl: z.string().optional().nullable(),

                altText: z.string().optional().nullable(),

                sortOrder: z.number().default(0),

                isPrimary: z.boolean().default(false),
            }),
        )
        .default([]),
});

export type Product = z.infer<typeof ProductSchema>;
