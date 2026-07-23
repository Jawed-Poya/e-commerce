import { apiGet, apiPost } from "../../shared/api/api-client";
import type {
    AuthResponse,
    AuthUser,
    LoginRequest,
    RegisterRequest,
} from "./auth-types";

export const loginCustomer = (request: LoginRequest) =>
    apiPost<AuthResponse>("/auth/customer/login", request);

export const registerCustomer = (request: RegisterRequest) =>
    apiPost<AuthResponse>("/auth/customer/register", request);

export const getCurrentCustomer = () => apiGet<AuthUser>("/auth/me");
