import type { CustomerListParams } from "./customer-service";

export const customerQueryKeys = {
    all: ["customers"] as const,
    list: (params: CustomerListParams) =>
        ["customers", "list", params.search ?? "", params.page ?? 1, params.pageSize ?? 20] as const,
    details: (id: number) => ["customers", "details", id] as const,
    engagement: (id: number) => ["customers", "engagement", id] as const,
};
