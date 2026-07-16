import type { GeneralType } from "@/schemas/type.schema";
import { generalTypeService } from "@/services/type.service";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useUpdateGeneralType() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: GeneralType }) =>
            generalTypeService.update(id, data),

        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["general-types"],
            });
        },
    });
}
