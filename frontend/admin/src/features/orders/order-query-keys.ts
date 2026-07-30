import type { OrderFilters } from "./order-service";

export const orderQueryKeys = {
    all: ["orders"] as const,
    lists: () => [...orderQueryKeys.all, "list"] as const,
    list: (filters: OrderFilters) => [...orderQueryKeys.lists(), filters] as const,
    details: () => [...orderQueryKeys.all, "detail"] as const,
    detail: (id: number) => [...orderQueryKeys.details(), id] as const,
};
