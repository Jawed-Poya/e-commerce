import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Product } from "../../../schemas/product-schema";
import { productService } from "@/services/product.service";
import { productKeys } from "../../../keys/product-keys";

export function useUpdateProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, model }: { id: number; model: Product }) =>
            productService.update(id, model),

        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: productKeys.all,
            });

            queryClient.invalidateQueries({
                queryKey: productKeys.detail(variables.id),
            });
        },
    });
}
