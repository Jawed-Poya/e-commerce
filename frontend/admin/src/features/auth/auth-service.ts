import apiClient from "@/api/api-client";
import type { AuthResponse, AuthUser, LoginRequest } from "./auth-types";

export const adminTokenKey = "token";
export const adminSessionKey = "easycart-admin-session";

export const authService = {
    async login(request: LoginRequest) {
        return (await apiClient.post<AuthResponse>("/auth/admin/login", request)).data;
    },
    async me() {
        return (await apiClient.get<AuthUser>("/auth/me")).data;
    },
};
