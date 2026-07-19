export interface UserProfile {
    userId: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
    isActive: boolean;
    roles: string[];
    permissions: string[];
    lastLoginAt: string | null;
    createdAt: string;
}

export interface UpdateProfileRequest {
    fullName: string;
    email: string;
    phone: string | null;
}

export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}
