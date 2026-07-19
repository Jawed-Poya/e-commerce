const API_URL =
    import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5188/api";

export const apiOrigin = new URL(API_URL).origin;

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
    params?: Record<string, string | number | boolean | undefined>,
) {
    const url = new URL(`${API_URL}${path}`);

    Object.entries(params ?? {}).forEach(([key, value]) => {
        if (value !== undefined) url.searchParams.set(key, String(value));
    });

    return readResponse<T>(await fetch(url));
}

export async function apiPost<T>(path: string, body?: unknown) {
    return readResponse<T>(
        await fetch(`${API_URL}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: body === undefined ? undefined : JSON.stringify(body),
        }),
    );
}

export function imageUrl(path?: string | null) {
    if (!path) return null;
    return /^https?:/.test(path)
        ? path
        : `${apiOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}
