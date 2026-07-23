import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const operationKeys = {
    all: ["operations"] as const,
    summary: ["operations", "summary"] as const,
    products: ["operations", "products"] as const,
    suppliers: ["operations", "suppliers"] as const,
    purchases: ["operations", "purchases"] as const,
    sales: ["operations", "sales"] as const,
    staff: ["operations", "staff"] as const,
    salaries: ["operations", "salaries"] as const,
    expenseCategories: ["operations", "expense-categories"] as const,
    expenses: ["operations", "expenses"] as const,
};

export const useOperationQuery = <T>(
    key: readonly unknown[],
    queryFn: () => Promise<{ data: T }>,
    enabled = true,
) =>
    useQuery({
        queryKey: key,
        queryFn: async () => (await queryFn()).data,
        enabled,
    });

export function useOperationMutation<T>(
    mutationFn: (body: T) => Promise<unknown>,
    invalidate: readonly (readonly unknown[])[],
) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn,
        onSuccess: async () => {
            await Promise.all(
                invalidate.map((queryKey) =>
                    queryClient.invalidateQueries({ queryKey }),
                ),
            );
        },
    });
}
