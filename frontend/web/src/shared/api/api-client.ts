import { resolveTenantSlug } from "../../features/tenancy/tenant-storage";
const API_URL =
    import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5188/api";

export const apiOrigin = new URL(API_URL).origin;
export const customerTokenKey = "easycart-customer-token";

type ApiEnvelope<T> = {
    success: boolean;
    message: string;
    data: T;
    errors?: Record<string, string[]>;
};

export class ApiError extends Error {
    readonly status: number;
    readonly errors?: Record<string, string[]>;

    constructor(
        message: string,
        status: number,
        errors?: Record<string, string[]>,
    ) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.errors = errors;
    }
}

function requestHeaders(includeJson = false) {
    const headers = new Headers();
    if (includeJson) headers.set("Content-Type", "application/json");
    const tenantSlug = resolveTenantSlug();
    if (tenantSlug) headers.set("X-Tenant-Slug", tenantSlug);
    headers.set("X-Tenant-Host", window.location.hostname.toLowerCase());

    const token = localStorage.getItem(customerTokenKey);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
}

async function readResponse<T>(response: Response): Promise<T> {
    const payload = (await response.json().catch(() => null)) as
        | ApiEnvelope<T>
        | T
        | null;

    if (!response.ok) {
        const envelope =
            payload && typeof payload === "object" && "message" in payload
                ? (payload as ApiEnvelope<T>)
                : null;

        if (response.status === 401) {
            localStorage.removeItem(customerTokenKey);
            localStorage.removeItem("easycart-customer-session");
            window.dispatchEvent(new Event("easycart-auth-changed"));
        }

        throw new ApiError(
            envelope?.message ?? "The request could not be completed.",
            response.status,
            envelope?.errors,
        );
    }

    return (
        payload && typeof payload === "object" && "data" in payload
            ? (payload as ApiEnvelope<T>).data
            : payload
    ) as T;
}

export async function apiGet<T>(
    path: string,
    params?: Record<
        string,
        string | number | boolean | (string | number)[] | undefined
    >,
) {
    const url = new URL(`${API_URL}${path}`);

    Object.entries(params ?? {}).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach((item) => url.searchParams.append(key, String(item)));
        } else if (value !== undefined) {
            url.searchParams.set(key, String(value));
        }
    });

    return readResponse<T>(
        await fetch(url, {
            headers: requestHeaders(),
        }),
    );
}

export async function apiPost<T>(path: string, body?: unknown) {
    return readResponse<T>(
        await fetch(`${API_URL}${path}`, {
            method: "POST",
            headers: requestHeaders(true),
            body: body === undefined ? undefined : JSON.stringify(body),
        }),
    );
}

export async function apiPut<T>(path: string, body?: unknown) {
    return readResponse<T>(
        await fetch(`${API_URL}${path}`, {
            method: "PUT",
            headers: requestHeaders(true),
            body: body === undefined ? undefined : JSON.stringify(body),
        }),
    );
}

export async function apiPatch<T>(path: string, body?: unknown) {
    return readResponse<T>(
        await fetch(`${API_URL}${path}`, {
            method: "PATCH",
            headers: requestHeaders(true),
            body: body === undefined ? undefined : JSON.stringify(body),
        }),
    );
}

export async function apiDelete<T>(path: string) {
    return readResponse<T>(
        await fetch(`${API_URL}${path}`, {
            method: "DELETE",
            headers: requestHeaders(),
        }),
    );
}

export function imageUrl(path?: string | null) {
    if (!path) return null;
    return /^https?:/.test(path)
        ? path
        : `${apiOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}
