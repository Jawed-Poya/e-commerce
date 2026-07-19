import apiClient from "@/api/api-client";
import type {
    AdminUserDetails,
    AdminUserListItem,
    CreateUserRequest,
    PermissionGroup,
    RoleListItem,
    UpdateUserRequest,
    UpsertRoleRequest,
} from "./user-types";

export const userService = {
    async getUsers(params?: {
        search?: string;
        role?: string;
        isActive?: boolean;
    }) {
        const response = await apiClient.get<AdminUserListItem[]>(
            "/admin/users",
            params,
        );
        return response.data;
    },
    async getUser(id: string) {
        const response = await apiClient.get<AdminUserDetails>(
            `/admin/users/${id}`,
        );
        return response.data;
    },
    async createUser(request: CreateUserRequest) {
        const response = await apiClient.post<AdminUserDetails>(
            "/admin/users",
            request,
        );
        return response.data;
    },
    async updateUser(id: string, request: UpdateUserRequest) {
        const response = await apiClient.put<AdminUserDetails>(
            `/admin/users/${id}`,
            request,
        );
        return response.data;
    },
    async resetPassword(id: string, password: string) {
        await apiClient.post(`/admin/users/${id}/reset-password`, { password });
    },
    async deactivateUser(id: string) {
        await apiClient.delete(`/admin/users/${id}`);
    },
    async getRoles() {
        const response = await apiClient.get<RoleListItem[]>("/admin/roles");
        return response.data;
    },
    async getPermissions() {
        const response = await apiClient.get<PermissionGroup[]>(
            "/admin/roles/permissions",
        );
        return response.data;
    },
    async createRole(request: UpsertRoleRequest) {
        const response = await apiClient.post<RoleListItem>(
            "/admin/roles",
            request,
        );
        return response.data;
    },
    async updateRole(id: string, request: UpsertRoleRequest) {
        const response = await apiClient.put<RoleListItem>(
            `/admin/roles/${id}`,
            request,
        );
        return response.data;
    },
    async deleteRole(id: string) {
        await apiClient.delete(`/admin/roles/${id}`);
    },
};
