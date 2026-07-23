import apiClient from "@/api/api-client";
import axiosInstance from "@/api/axios";
import type {
    StorefrontContent,
    UpdateStorefrontContentRequest,
} from "./storefront-content-types";

export const storefrontContentService = {
    async get() {
        return (await apiClient.get<StorefrontContent>("/storefront/content")).data;
    },
    async update(request: UpdateStorefrontContentRequest) {
        return (
            await apiClient.put<StorefrontContent>(
                "/storefront/content",
                request,
            )
        ).data;
    },
    async uploadHeroImage(image: File) {
        const form = new FormData();
        form.append("image", image, image.name);
        const response = await axiosInstance.post<{
            data: { imageUrl: string };
        }>("/storefront/content/hero-image", form);
        return response.data.data.imageUrl;
    },
};
