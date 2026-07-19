import { useMutation, useQueryClient } from "@tanstack/react-query";
import { productKeys } from "@/keys/product-keys";
import { productService, type ProductPriceInput } from "@/services/product.service";

export function useReplaceProductPrices(productId: number) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (prices: ProductPriceInput[]) => productService.replacePrices(productId, prices),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: productKeys.detail(productId) }),
                queryClient.invalidateQueries({ queryKey: productKeys.all }),
            ]);
        },
    });
}
