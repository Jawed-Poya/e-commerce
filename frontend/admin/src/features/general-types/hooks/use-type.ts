import { generalTypeKeys } from "@/keys/type-keys";
import { generalTypeService } from "@/services/type.service";
import { useQuery } from "@tanstack/react-query";

export function useGeneralTypes(group: string | undefined) {
    return useQuery({
        queryKey: generalTypeKeys.group(group),

        queryFn: async () => await generalTypeService.get(group),
    });
}
