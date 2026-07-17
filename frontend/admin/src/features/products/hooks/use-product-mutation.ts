import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ProductService } from "../services/product-bulk-service";
import type { CreateBulkProductsRequest } from "../types/product-bulk-types";
import { productKeys } from "@/keys/product-keys";

export function useProductLookupsQuery() {
    return useQuery({
        queryKey: productKeys.lookups,
        queryFn: ProductService.GetLookups,
        staleTime: 10 * 60 * 1000,
        refetchOnMount: "always",
    });
}

export function useCreateBulkProductsMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (request: CreateBulkProductsRequest) =>
            ProductService.CreateBulk(request),

        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: productKeys.all,
            });
        },
    });
}
