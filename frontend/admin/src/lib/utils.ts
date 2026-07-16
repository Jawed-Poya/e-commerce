import type { GeneralType } from "@/schemas/type.schema";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function buildTree(
    items: GeneralType[],
    parentId: number | null = null,
): any {
    if (!items) {
        return [];
    }
    return items
        .filter((item) => item.parentId === parentId)
        .map((item) => ({
            ...item,
            children: buildTree(items, item.id),
        }));
}
