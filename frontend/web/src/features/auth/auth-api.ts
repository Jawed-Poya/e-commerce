import { apiGet, apiPost } from "../../shared/api/api-client";
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
