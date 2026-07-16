import { productService } from "@/services/product.service";
import { useQuery } from "@tanstack/react-query";
import { productKeys } from "../../../keys/product-keys";

export function useProduct(id: number) {
    return useQuery({
        queryKey: productKeys.detail(id),
        queryFn: async () => {
            const { data } = await productService.getById(id);
            return data;
        },
        enabled: id > 0,
    });
}
