export interface AdminUserListItem {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    isActive: boolean;
    roles: string[];
    permissionCount: number;
    branchId: number | null;
    branchName: string | null;
    lastLoginAt: string | null;
    createdAt: string;
}

export interface AdminUserDetails {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    isActive: boolean;
    roles: string[];
    directPermissions: string[];
    effectivePermissions: string[];
    branchId: number | null;
    branchName: string | null;
    lastLoginAt: string | null;
    createdAt: string;
}

export interface RoleListItem {
    id: string;
    name: string;
    description: string | null;
    userCount: number;
    permissions: string[];
    isSystemRole: boolean;
}

export interface PermissionItem {
    value: string;
    name: string;
    description: string;
}

export interface PermissionGroup {
    group: string;
    items: PermissionItem[];
}

export interface CreateUserRequest {
    fullName: string;
    email: string;
    phone: string | null;
    password: string;
    isActive: boolean;
    branchId: number | null;
    roles: string[];
    permissions: string[];
}

export interface UpdateUserRequest {
    fullName: string;
    email: string;
    phone: string | null;
    isActive: boolean;
    branchId: number | null;
    roles: string[];
    permissions: string[];
}

export interface UpsertRoleRequest {
    name: string;
    description: string | null;
    permissions: string[];
}
