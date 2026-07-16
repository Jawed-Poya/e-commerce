import { productService } from "@/services/product.service";
import { useQuery } from "@tanstack/react-query";
import { productKeys } from "../../../keys/product-keys";

export function useProducts() {
    return useQuery({
        queryKey: productKeys.all,
        queryFn: async () => {
            const { data } = await productService.getAll();
            return data;
        },
        staleTime: 1000 * 60 * 5,
    });
}
