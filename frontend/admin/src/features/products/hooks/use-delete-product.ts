import { productService } from "@/services/product.service";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { productKeys } from "../../../keys/product-keys";

export function useDeleteProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: productService.delete,

        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: productKeys.all,
            });
        },
    });
}
