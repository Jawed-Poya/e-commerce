import { generalTypeService } from "@/services/type.service";
import { productKeys } from "@/keys/product-keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteGeneralType() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => generalTypeService.delete(id),

        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["general-types"],
            });
            queryClient.invalidateQueries({
                queryKey: productKeys.lookups,
            });
        },
    });
}
