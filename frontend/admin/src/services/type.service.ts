import apiClient from "@/api/api-client";
import { resolveApiAssetUrl } from "@/api/axios";
import type { GeneralType } from "@/schemas/type.schema";

export interface GeneralTypeSubmission {
    data: GeneralType;
    image?: File;
}

export function resolveGeneralTypeImageUrl(
    path: string | null | undefined,
) {
    return resolveApiAssetUrl(path);
}

function toFormData({ data, image }: GeneralTypeSubmission) {
    const formData = new FormData();

    formData.append("Name", data.name.trim());
    formData.append("Group", data.group);

    const imageUrl = data.imageUrl?.trim();

    if (imageUrl) {
        formData.append("ImageUrl", imageUrl);
    }

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
        if (!submission.image) {
            return apiClient.post<number>("/types", {
                ...submission.data,
                name: submission.data.name.trim(),
                imageUrl: submission.data.imageUrl?.trim() || null,
            });
        }

        return apiClient.post<number>("/types", toFormData(submission));
    },

    update(id: number, submission: GeneralTypeSubmission) {
        if (!submission.image) {
            return apiClient.put(`/types/${id}`, {
                ...submission.data,
                name: submission.data.name.trim(),
                imageUrl: submission.data.imageUrl?.trim() || null,
            });
        }

        return apiClient.put(`/types/${id}`, toFormData(submission));
    },

    delete(id: number) {
        return apiClient.delete(`/types/${id}`);
    },
};
