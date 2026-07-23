import axios, {
    type AxiosError,
    type InternalAxiosRequestConfig,
} from "axios";

import {
    dispatchAdminUnauthorized,
    getAdminToken,
} from "@/features/auth/auth-storage";

export const apiBaseUrl = (
    import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5188/api"
).replace(/\/+$/, "");
export const apiOrigin = new URL(apiBaseUrl, window.location.origin).origin;

type AdminRequestConfig = InternalAxiosRequestConfig & {
    adminAccessToken?: string;
};

const axiosInstance = axios.create({
    baseURL: apiBaseUrl,
    headers: {
        "Content-Type": "application/json",
    },
    timeout: 30000,
});

function normalizedRequestPath(config: InternalAxiosRequestConfig | undefined) {
    return config?.url?.replace(/^\/+/, "") ?? "";
}

function isLoginRequest(config: InternalAxiosRequestConfig | undefined) {
    return normalizedRequestPath(config) === "auth/admin/login";
}

function isSessionValidationRequest(
    config: InternalAxiosRequestConfig | undefined,
) {
    return normalizedRequestPath(config) === "auth/me";
}

axiosInstance.interceptors.request.use(
    (config) => {
        const token = getAdminToken();
        const adminConfig = config as AdminRequestConfig;

        // Remember the exact token used by this request. A late 401 from an old
        // request must not remove a newer token created by a successful login.
        adminConfig.adminAccessToken = token ?? undefined;

        // The login endpoint must never receive a stale Authorization header.
        if (token && !isLoginRequest(config)) {
            config.headers.Authorization = `Bearer ${token}`;
        } else {
            delete config.headers.Authorization;
        }

        if (config.data instanceof FormData) {
            delete config.headers["Content-Type"];
        } else {
            config.headers["Content-Type"] = "application/json";
        }

        return config;
    },
    (error) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        const config = error.config as AdminRequestConfig | undefined;
        const failedToken = config?.adminAccessToken;

        if (
            error.response?.status === 401 &&
            failedToken &&
            !isLoginRequest(config) &&
            !isSessionValidationRequest(config) &&
            getAdminToken() === failedToken
        ) {
            dispatchAdminUnauthorized(failedToken);
        }

        return Promise.reject(error);
    },
);

export default axiosInstance;
