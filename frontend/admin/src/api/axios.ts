import axios, {
    type AxiosError,
    type InternalAxiosRequestConfig,
} from "axios";

import {
    dispatchAdminUnauthorized,
    getAdminToken,
} from "@/features/auth/auth-storage";
import { literalTranslations } from "@/i18n/literal-translations";

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const apiBaseUrl = (configuredApiBaseUrl || "/api").replace(/\/+$/, "");

const absoluteApiBaseUrl = new URL(`${apiBaseUrl}/`, window.location.origin);

export function resolveApiAssetUrl(path: string | null | undefined) {
    if (!path) return null;

    const value = path.trim();
    if (!value) return null;
    if (/^(https?:|blob:|data:)/i.test(value)) return value;
    if (value.startsWith("//")) {
        return new URL(value, window.location.origin).toString();
    }

    const relativePath = value.replace(/\\/g, "/").replace(/^\/+/, "");
    const apiPathPrefix = absoluteApiBaseUrl.pathname
        .replace(/^\/+|\/+$/g, "");

    if (
        apiPathPrefix &&
        (relativePath === apiPathPrefix ||
            relativePath.startsWith(`${apiPathPrefix}/`))
    ) {
        return new URL(`/${relativePath}`, absoluteApiBaseUrl.origin).toString();
    }

    return new URL(relativePath, absoluteApiBaseUrl).toString();
}

type AdminRequestConfig = InternalAxiosRequestConfig & {
    adminAccessToken?: string;
};

const axiosInstance = axios.create({
    baseURL: apiBaseUrl,
    headers: {
        "Content-Type": "application/json",
    },
    timeout: 240_000,
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

function localizeApiMessage(data: unknown, useFallback: boolean) {
    if (!data || typeof data !== "object" || !("message" in data)) return;

    const response = data as { message?: unknown };
    if (typeof response.message !== "string" || !response.message.trim()) return;

    const language = localStorage.getItem("language");
    if (language !== "dr" && language !== "ps") return;

    const translations = literalTranslations[language];
    response.message =
        translations[response.message] ??
        (useFallback
            ? translations["The request could not be completed."]
            : response.message);
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
    (response) => {
        localizeApiMessage(response.data, false);
        return response;
    },
    (error: AxiosError) => {
        localizeApiMessage(error.response?.data, true);
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
