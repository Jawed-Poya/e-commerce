import { z } from "zod";

export const GeneralTypeSchema = z.object({
    id: z.number().optional(),

    name: z
        .string()
        .min(2, "Name must be at least 2 characters.")
        .max(200, "Name cannot exceed 200 characters."),

    group: z.string().min(1, "Group is required."),

    parentId: z.number().nullable().optional(),
    parentName: z.string().nullable().optional(),
});

export type GeneralType = z.infer<typeof GeneralTypeSchema>;
