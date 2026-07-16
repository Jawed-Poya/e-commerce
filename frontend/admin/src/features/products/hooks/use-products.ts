import { productKeys } from "@/keys/product-keys";
import { productService } from "@/services/product.service";
import { useQuery } from "@tanstack/react-query";
import type { ProductListFilters } from "@/services/product.service";

export function useProducts(filters: ProductListFilters = {}) {
    return useQuery({
        queryKey: [...productKeys.all, filters],
        queryFn: async () => {
            const { data } = await productService.getAll(filters);
            return data;
        },
        placeholderData: previous => previous,
        staleTime: 1000 * 60 * 5,
    });
}

export function useProduct(id: number) {
    return useQuery({
        queryKey: productKeys.detail(id),
        queryFn: async () => (await productService.getById(id)).data,
        enabled: Number.isInteger(id) && id > 0,
        staleTime: 1000 * 60 * 5,
    });
}
