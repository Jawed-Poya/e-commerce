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
const configuredAssetBaseUrl = import.meta.env.VITE_ASSET_BASE_URL?.trim();

export const apiBaseUrl = (configuredApiBaseUrl || "/api").replace(/\/+$/, "");

const absoluteApiBaseUrl = new URL(`${apiBaseUrl}/`, window.location.origin);

function getDefaultAssetBaseUrl() {
    const url = new URL(absoluteApiBaseUrl);
    const apiPath = url.pathname.replace(/\/+$/, "");

    url.pathname = apiPath.toLowerCase().endsWith("/api")
        ? apiPath.slice(0, -4) || "/"
        : apiPath || "/";
    url.search = "";
    url.hash = "";

    return url.toString().replace(/\/+$/, "");
}

export const assetBaseUrl =
    (configuredAssetBaseUrl || getDefaultAssetBaseUrl()).replace(/\/+$/, "") ||
    "/";

const absoluteAssetBaseUrl = new URL(assetBaseUrl, window.location.origin);
absoluteAssetBaseUrl.pathname = `${absoluteAssetBaseUrl.pathname.replace(/\/+$/, "")}/`;
absoluteAssetBaseUrl.search = "";
absoluteAssetBaseUrl.hash = "";

function removeApiPrefix(pathname: string) {
    const relativePath = pathname.replace(/\\/g, "/").replace(/^\/+/, "");
    const apiPathPrefix = absoluteApiBaseUrl.pathname.replace(
        /^\/+|\/+$/g,
        "",
    );

    if (
        apiPathPrefix &&
        (relativePath === apiPathPrefix ||
            relativePath.startsWith(`${apiPathPrefix}/`))
    ) {
        return relativePath.slice(apiPathPrefix.length).replace(/^\/+/, "");
    }

    if (relativePath.toLowerCase().startsWith("api/uploads/")) {
        return relativePath.slice(4);
    }

    return relativePath;
}

function resolveManagedAssetUrl(url: URL) {
    const assetPath = removeApiPrefix(url.pathname);
    const isManagedUpload = assetPath.toLowerCase().startsWith("uploads/");

    if (!isManagedUpload || url.origin !== absoluteApiBaseUrl.origin) {
        return url.toString();
    }

    const resolvedUrl = new URL(assetPath, absoluteAssetBaseUrl);
    resolvedUrl.search = url.search;
    resolvedUrl.hash = url.hash;
    return resolvedUrl.toString();
}

export function resolveApiAssetUrl(path: string | null | undefined) {
    if (!path) return null;

    const value = path.trim();
    if (!value) return null;
    if (/^(blob:|data:)/i.test(value)) return value;

    if (/^(https?:)?\/\//i.test(value)) {
        return resolveManagedAssetUrl(new URL(value, window.location.origin));
    }

    const relativeUrl = new URL(value.replace(/\\/g, "/"), window.location.origin);
    const assetPath = removeApiPrefix(relativeUrl.pathname);
    const resolvedUrl = new URL(assetPath, absoluteAssetBaseUrl);
    resolvedUrl.search = relativeUrl.search;
    resolvedUrl.hash = relativeUrl.hash;
    return resolvedUrl.toString();
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
