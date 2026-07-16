import { generalTypeKeys } from "@/keys/type-keys";
import { generalTypeService } from "@/services/type.service";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useCreateGeneralType() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: generalTypeService.create,

        onSuccess(_, model) {
            queryClient.invalidateQueries({
                queryKey: generalTypeKeys.group(model.group),
            });
        },
    });
}
