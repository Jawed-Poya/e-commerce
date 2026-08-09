import { dispatchAdminUnauthorized, getAdminToken } from "@/features/auth/auth-storage";
import { getResponseMessage } from "@/lib/api-error";
import axiosInstance, { apiBaseUrl } from "./axios";

export interface ApiResponse<T> {
    data: T;
    message?: string;
    success: boolean;
}

function normalizeApiResponse<T>(response: ApiResponse<T>): ApiResponse<T> {
    if (!response || typeof response !== "object") {
        throw new Error("The server returned an invalid API response.");
    }
    const message = typeof response.message === "string" ? response.message.trim() : "";
    return { ...response, message: message || undefined };
}

class ApiClient {
    async get<T>(url: string, params?: object): Promise<ApiResponse<T>> {
        const response = await axiosInstance.get<ApiResponse<T>>(url, { params });
        return normalizeApiResponse(response.data);
    }

    async post<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
        const response = await axiosInstance.post<ApiResponse<T>>(url, body);
        return normalizeApiResponse(response.data);
    }

    async put<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
        const response = await axiosInstance.put<ApiResponse<T>>(url, body);
        return normalizeApiResponse(response.data);
    }

    async patch<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
        const response = await axiosInstance.patch<ApiResponse<T>>(url, body);
        return normalizeApiResponse(response.data);
    }

    async download(url: string, params?: object): Promise<{ filename: string; size: number }> {
        const { blob, filename } = await this.getBlob(url, params);
        const href = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = href;
        link.download = filename;
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
        return { filename, size: blob.size };
    }

    async createObjectUrl(url: string, params?: object): Promise<string> {
        const { blob } = await this.getBlob(url, params);
        return URL.createObjectURL(blob);
    }

    private async getBlob(url: string, params?: object) {
        // Keep binary downloads outside the JSON Axios interceptor path. Native fetch is
        // more reliable for large PDF/image bodies behind IIS/Nginx/reverse proxies and
        // avoids a successful response being interpreted as an empty Axios Blob.
        for (let attempt = 0; attempt < 2; attempt += 1) {
            const requestUrl = createDownloadUrl(url, params, attempt);
            const headers = new Headers({
                Accept: "application/pdf, image/png, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, */*",
                "Cache-Control": "no-cache, no-store",
                Pragma: "no-cache",
            });
            const token = getAdminToken();
            if (token) headers.set("Authorization", `Bearer ${token}`);

            let response: Response;
            try {
                response = await fetch(requestUrl, {
                    method: "GET",
                    headers,
                    cache: "no-store",
                    credentials: "same-origin",
                });
            } catch (error) {
                if (attempt === 0) continue;
                throw error instanceof Error && error.message.trim()
                    ? error
                    : new Error("Could not connect to the document service.");
            }

            const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
            const bytes = await response.arrayBuffer();

            if (response.status === 401 && token && getAdminToken() === token) {
                dispatchAdminUnauthorized(token);
            }

            if (!response.ok || contentType.includes("json") || contentType.includes("problem+json")) {
                const message = parseBufferMessage(bytes);
                throw new Error(
                    message ??
                        (response.ok
                            ? "The server returned an unexpected response instead of a document."
                            : responseStatusMessage(response.status)),
                );
            }

            if (bytes.byteLength > 0) {
                const blob = new Blob([bytes], {
                    type: contentType.split(";")[0] || "application/octet-stream",
                });
                return {
                    blob,
                    filename: resolveFilename(response.headers.get("content-disposition") ?? undefined, contentType),
                };
            }

            // Retry once with a cache-busting query value. This handles proxies that can
            // occasionally return a 200 response before forwarding the generated body.
            if (attempt === 0) continue;
        }

        throw new Error("The document download did not complete. Please try again.");
    }

    async delete<T>(url: string): Promise<ApiResponse<T>> {
        const response = await axiosInstance.delete<ApiResponse<T>>(url);
        return normalizeApiResponse(response.data);
    }
}

function createDownloadUrl(path: string, params: object | undefined, attempt: number) {
    const base = new URL(`${apiBaseUrl.replace(/\/+$/, "")}/`, window.location.origin);
    const url = new URL(path.replace(/^\/+/, ""), base);
    const entries = Object.entries((params ?? {}) as Record<string, unknown>);
    for (const [key, value] of entries) {
        if (value === undefined || value === null || value === "") continue;
        if (Array.isArray(value)) {
            value.forEach((item) => url.searchParams.append(key, String(item)));
        } else {
            url.searchParams.set(key, String(value));
        }
    }
    if (attempt > 0) url.searchParams.set("_download", `${Date.now()}-${attempt}`);
    return url.toString();
}

function parseBufferMessage(buffer: ArrayBuffer) {
    if (!buffer.byteLength) return null;
    try {
        const text = new TextDecoder().decode(buffer).trim();
        if (!text) return null;
        const body = JSON.parse(text) as unknown;
        return getResponseMessage(body);
    } catch {
        return null;
    }
}

function responseStatusMessage(status: number) {
    if (status === 400) return "The document request is invalid.";
    if (status === 401) return "Your session has expired. Sign in again.";
    if (status === 403) return "You do not have permission to download this document.";
    if (status === 404) return "The requested document endpoint was not found.";
    if (status >= 500) return "The server could not generate the document.";
    return "The document could not be downloaded.";
}

function resolveFilename(disposition?: string, contentType = "") {
    const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const quoted = disposition?.match(/filename="?([^";]+)"?/i)?.[1];
    let resolved: string | undefined;
    try {
        resolved = (encoded ? decodeURIComponent(encoded) : quoted)?.trim();
    } catch {
        resolved = quoted?.trim();
    }
    if (resolved) return resolved;
    if (contentType.includes("application/pdf")) return "document.pdf";
    if (contentType.includes("image/png")) return "document.png";
    if (contentType.includes("spreadsheetml")) return "report.xlsx";
    return "download";
}

export default new ApiClient();
