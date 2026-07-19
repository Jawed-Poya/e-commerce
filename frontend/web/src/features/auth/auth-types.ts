export interface AuthUser {
    userId: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    roles: string[];
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

export interface RegisterRequest {
    firstName: string;
    lastName: string | null;
    phone: string;
    email: string | null;
    password: string;
}
