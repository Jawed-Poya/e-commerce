import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const operationKeys = {
    all: ["operations"] as const,
    summary: ["operations", "summary"] as const,
    policy: ["operations", "policy"] as const,
    suppliers: ["operations", "suppliers"] as const,
    purchaseRoot: ["operations", "purchases"] as const,
    purchases: (search = "") => ["operations", "purchases", search] as const,
    purchase: (id: number) => ["operations", "purchases", id, "details"] as const,
    purchasePayments: (id: number) => ["operations", "purchases", id, "payments"] as const,
    saleRoot: ["operations", "sales"] as const,
    sales: (search = "") => ["operations", "sales", search] as const,
    saleLots: (id: number) => ["operations", "sales", id, "lots"] as const,
    salePayments: (id: number) => ["operations", "sales", id, "payments"] as const,
    staff: ["operations", "staff"] as const,
    salaries: ["operations", "salaries"] as const,
    salaryPayments: (id: number) => ["operations", "salaries", id, "payments"] as const,
    expenseCategories: ["operations", "expense-categories"] as const,
    expenses: ["operations", "expenses"] as const,
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
