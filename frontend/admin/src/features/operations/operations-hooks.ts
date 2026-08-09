import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const operationKeys = {
    all: ["operations"] as const,
    summary: ["operations", "summary"] as const,
    policy: ["operations", "policy"] as const,
    suppliers: ["operations", "suppliers"] as const,
    supplierPage: (search = "", page = 1, pageSize = 20) => ["operations", "suppliers", "page", search, page, pageSize] as const,
    purchaseRoot: ["operations", "purchases"] as const,
    purchases: (search = "", page = 1, pageSize = 20) => ["operations", "purchases", search, page, pageSize] as const,
    purchase: (id: number) => ["operations", "purchases", id, "details"] as const,
    purchasePayments: (id: number) => ["operations", "purchases", id, "payments"] as const,
    saleRoot: ["operations", "sales"] as const,
    sales: (search = "", page = 1, pageSize = 20) => ["operations", "sales", search, page, pageSize] as const,
    saleLots: (id: number) => ["operations", "sales", id, "lots"] as const,
    salePayments: (id: number) => ["operations", "sales", id, "payments"] as const,
    staff: ["operations", "staff"] as const,
    staffPage: (search = "", page = 1, pageSize = 20) => ["operations", "staff", "page", search, page, pageSize] as const,
    salaries: ["operations", "salaries"] as const,
    salaryPage: (page = 1, pageSize = 20) => ["operations", "salaries", page, pageSize] as const,
    salaryPayments: (id: number) => ["operations", "salaries", id, "payments"] as const,
    expenseCategories: ["operations", "expense-categories"] as const,
    expenses: ["operations", "expenses"] as const,
    expensePage: (page = 1, pageSize = 20) => ["operations", "expenses", page, pageSize] as const,
};

export const useOperationQuery = <T>(key: readonly unknown[], queryFn: () => Promise<{ data: T }>, enabled = true) =>
    useQuery({ queryKey: key, queryFn: async () => (await queryFn()).data, enabled });

export function useOperationMutation<T>(mutationFn: (body: T) => Promise<unknown>, invalidate: readonly (readonly unknown[])[]) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn,
        onSuccess: async () => {
            await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
        },
    });
}
