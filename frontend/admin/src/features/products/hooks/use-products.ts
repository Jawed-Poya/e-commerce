import { productKeys } from "@/keys/product-keys";
import { productService } from "@/services/product.service";
import { useQuery } from "@tanstack/react-query";

export function useProducts(search = "") {
    return useQuery({
        queryKey: [...productKeys.all, search],
        queryFn: async () => {
            const { data } = await productService.getAll({ search: search || undefined, pageSize: 50 });
            return data;
        },
        staleTime: 1000 * 60 * 5,
    });
}
