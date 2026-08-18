import { apiGet, apiPost, apiPut } from "../../shared/api/api-client";
import type {
    AuthResponse,
    AuthUser,
    LoginRequest,
    RegisterRequest,
    VerificationChannel,
    VerificationDispatch,
} from "./auth-types";

export const loginCustomer = (request: LoginRequest) =>
    apiPost<AuthResponse>("/auth/customer/login", request);

export const registerCustomer = (request: RegisterRequest) =>
    apiPost<AuthResponse>("/auth/customer/register", request);

export const signInWithGoogle = (credential: string) =>
    apiPost<AuthResponse>("/auth/customer/google", { credential });

export const getCurrentCustomer = () => apiGet<AuthUser>("/auth/me");

export const sendVerificationCode = (channel: VerificationChannel) =>
    apiPost<VerificationDispatch>("/auth/verification/send", { channel });

export const confirmVerificationCode = (
    channel: VerificationChannel,
    code: string,
) => apiPost<AuthUser>("/auth/verification/confirm", { channel, code });

export const requestPasswordReset = (email: string) =>
    apiPost<Record<string, never>>("/auth/customer/forgot-password", { email });

export const resetCustomerPassword = (email: string, token: string, newPassword: string) =>
    apiPost<Record<string, never>>("/auth/customer/reset-password", { email, token, newPassword });

export const updateCustomerProfile = (request: { fullName: string; email: string | null; phone: string | null }) =>
    apiPut<unknown>("/auth/profile", request);

export const setCustomerPassword = (newPassword: string) =>
    apiPost<Record<string, never>>("/auth/set-password", { newPassword });

export const changeCustomerPassword = (currentPassword: string, newPassword: string) =>
    apiPost<Record<string, never>>("/auth/change-password", { currentPassword, newPassword });
