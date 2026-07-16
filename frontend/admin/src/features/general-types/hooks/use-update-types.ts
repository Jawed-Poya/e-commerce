import type { GeneralType } from "@/schemas/type.schema";
import { generalTypeService } from "@/services/type.service";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useUpdateGeneralType() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: GeneralType }) =>
            generalTypeService.update(id, data),

        onSuccess: () => {
            toast.success("Success", {
                description: "Selected type updated.",
            });
            queryClient.invalidateQueries({
                queryKey: ["general-types"],
            });
        },
    });
}
