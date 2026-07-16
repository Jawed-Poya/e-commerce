import apiClient from "@/api/api-client";
import type { GeneralType } from "@/schemas/type.schema";

export const generalTypeService = {
    get(group?: string) {
        return apiClient.get<GeneralType[]>("/types", {
            group,
        });
    },

    getById(id: number) {
        return apiClient.get<GeneralType>(`/types/${id}`);
    },

    create(model: GeneralType) {
        return apiClient.post<number>("/types", model);
    },

    update(id: number, model: GeneralType) {
        return apiClient.put(`/types/${id}`, model);
    },

    delete(id: number) {
        return apiClient.delete(`/types/${id}`);
    },
};
