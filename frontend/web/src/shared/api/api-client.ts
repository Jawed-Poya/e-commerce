const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const apiBaseUrl = (configuredApiBaseUrl || "/api").replace(/\/+$/, "");

const absoluteApiBaseUrl = new URL(`${apiBaseUrl}/`, window.location.origin);

export const customerTokenKey = "easycart-customer-token";

export function apiUrl(path: string) {
    return new URL(path.replace(/^\/+/, ""), absoluteApiBaseUrl).toString();
}

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
    const url = new URL(apiUrl(path));

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
        await fetch(apiUrl(path), {
            method: "POST",
            headers: requestHeaders(true),
            body: body === undefined ? undefined : JSON.stringify(body),
        }),
    );
}

export async function apiPut<T>(path: string, body?: unknown) {
    return readResponse<T>(
        await fetch(apiUrl(path), {
            method: "PUT",
            headers: requestHeaders(true),
            body: body === undefined ? undefined : JSON.stringify(body),
        }),
    );
}

export async function apiPatch<T>(path: string, body?: unknown) {
    return readResponse<T>(
        await fetch(apiUrl(path), {
            method: "PATCH",
            headers: requestHeaders(true),
            body: body === undefined ? undefined : JSON.stringify(body),
        }),
    );
}

export async function apiDelete<T>(path: string) {
    return readResponse<T>(
        await fetch(apiUrl(path), {
            method: "DELETE",
            headers: requestHeaders(),
        }),
    );
}

export function imageUrl(path?: string | null) {
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
