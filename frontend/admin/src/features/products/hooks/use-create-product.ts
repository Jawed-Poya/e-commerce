import { productService } from "@/services/product.service";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { productKeys } from "../../../keys/product-keys";

export function useCreateProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: productService.create,

        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: productKeys.all,
            });
        },
    });
}
