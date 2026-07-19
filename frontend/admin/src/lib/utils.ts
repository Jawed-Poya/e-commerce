import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function flattenTree<T extends {
    id?: number;
    parentId?: number | null;
}>(items: T[]) {
    const ids = new Set(
        items
            .map((item) => item.id)
            .filter((id): id is number => id != null),
    );
    const children = new Map<number | null, T[]>();

    items.forEach((item) => {
        const parentId = item.parentId ?? null;
        const siblings = children.get(parentId) ?? [];
        siblings.push(item);
        children.set(parentId, siblings);
    });

    const result: { item: T; depth: number }[] = [];
    const visited = new Set<number>();

    const append = (item: T, depth: number, path: Set<number>) => {
        if (item.id == null || path.has(item.id) || visited.has(item.id)) {
            return;
        }

        visited.add(item.id);
        result.push({ item, depth });

        const nextPath = new Set(path).add(item.id);
        (children.get(item.id) ?? []).forEach((child) =>
            append(child, depth + 1, nextPath),
        );
    };

    items
        .filter(
            (item) =>
                item.parentId == null || !ids.has(item.parentId),
        )
        .forEach((item) => append(item, 0, new Set()));

    // Keep malformed/orphaned cycles visible and selectable instead of hiding them.
    items.forEach((item) => append(item, 0, new Set()));

    return result;
}
