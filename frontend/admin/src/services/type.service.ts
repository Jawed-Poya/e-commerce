import apiClient from "@/api/api-client";
import type { GeneralType } from "@/schemas/type.schema";

const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5188/api";
const apiOrigin = new URL(apiBaseUrl, window.location.origin).origin;

export interface GeneralTypeSubmission {
    data: GeneralType;
    image?: File;
}

export function resolveGeneralTypeImageUrl(
    path: string | null | undefined,
) {
    if (!path) return null;
    if (/^https?:\/\//i.test(path) || path.startsWith("blob:")) return path;

    return new URL(
        path.startsWith("/") ? path : `/${path}`,
        apiOrigin,
    ).toString();
}

function toFormData({ data, image }: GeneralTypeSubmission) {
    const formData = new FormData();

    formData.append("Name", data.name.trim());
    formData.append("Group", data.group);
    formData.append("ImageUrl", data.imageUrl?.trim() ?? "");

    if (data.parentId != null) {
        formData.append("ParentId", String(data.parentId));
    }

    if (image) {
        formData.append("Image", image);
    }

    return formData;
}

export const generalTypeService = {
    get(group?: string) {
        return apiClient.get<GeneralType[]>("/types", {
            group,
        });
    },

    getById(id: number) {
        return apiClient.get<GeneralType>(`/types/${id}`);
    },

    create(submission: GeneralTypeSubmission) {
        return apiClient.post<number>("/types", toFormData(submission));
    },

    update(id: number, submission: GeneralTypeSubmission) {
        return apiClient.put(`/types/${id}`, toFormData(submission));
    },

    delete(id: number) {
        return apiClient.delete(`/types/${id}`);
    },
};
