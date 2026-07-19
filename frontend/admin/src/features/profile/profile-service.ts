import apiClient from "@/api/api-client";
import type {
    ChangePasswordRequest,
    UpdateProfileRequest,
    UserProfile,
} from "./profile-types";

export const profileService = {
    async get() {
        return (await apiClient.get<UserProfile>("/auth/profile")).data;
    },
    async update(request: UpdateProfileRequest) {
        return (await apiClient.put<UserProfile>("/auth/profile", request)).data;
    },
    async changePassword(request: ChangePasswordRequest) {
        return (
            await apiClient.post<object>("/auth/change-password", request)
        ).data;
    },
};
