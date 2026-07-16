import { generalTypeKeys } from "@/keys/type-keys";
import { generalTypeService } from "@/services/type.service";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useCreateGeneralType() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: generalTypeService.create,

        onSuccess(_, model) {
            toast.success("Success", {
                description: "New type added.",
            });
            queryClient.invalidateQueries({
                queryKey: generalTypeKeys.group(model.group),
            });
        },
    });
}
