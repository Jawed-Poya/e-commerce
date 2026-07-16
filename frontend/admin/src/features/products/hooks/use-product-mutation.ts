import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ProductService } from "../services/product-bulk-service";
import type { CreateBulkProductsRequest } from "../types/product-bulk-types";

export const ProductQueryKeys = {
    all: ["products"] as const,
    lists: ["products", "list"] as const,
    lookups: ["products", "lookups"] as const,
};

export function useProductLookupsQuery() {
    return useQuery({
        queryKey: ProductQueryKeys.lookups,
        queryFn: ProductService.GetLookups,
        staleTime: 10 * 60 * 1000,
    });
}

export function useCreateBulkProductsMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (request: CreateBulkProductsRequest) =>
            ProductService.CreateBulk(request),

        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: ProductQueryKeys.lists,
            });
        },
    });
}
