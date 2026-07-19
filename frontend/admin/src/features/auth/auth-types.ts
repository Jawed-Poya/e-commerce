export interface AuthUser {
    userId: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    roles: string[];
    permissions: string[];
    customerId: number | null;
    customerTypeId: number | null;
    customerTypeName: string | null;
    isAdmin: boolean;
}

export interface AuthResponse {
    token: string;
    expiresAt: string;
    user: AuthUser;
}

export interface LoginRequest {
    identifier: string;
    password: string;
}
