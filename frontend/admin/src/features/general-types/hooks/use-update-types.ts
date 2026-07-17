import type { GeneralType } from "@/schemas/type.schema";
import { productKeys } from "@/keys/product-keys";
import {
    generalTypeService,
    type GeneralTypeSubmission,
} from "@/services/type.service";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useUpdateGeneralType() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            id,
            data,
            image,
        }: { id: number; data: GeneralType; image?: File }) =>
            generalTypeService.update(id, { data, image } satisfies GeneralTypeSubmission),

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
