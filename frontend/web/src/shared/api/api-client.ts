const API_URL =
    import.meta.env.VITE_API_BASE_URL ?? "http://10.85.233.134:5188/api";
export const apiOrigin = new URL(API_URL).origin;
type ApiEnvelope<T> = {
    success: boolean;
    message: string;
    data: T;
    errors?: Record<string, string[]>;
};

export async function apiGet<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
) {
    const url = new URL(`${API_URL}${path}`);
    Object.entries(params ?? {}).forEach(
        ([key, value]) =>
            value !== undefined && url.searchParams.set(key, String(value)),
    );
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(
            response.status === 404
                ? "Not found"
                : "The store could not load this information.",
        );
    const payload = (await response.json()) as ApiEnvelope<T> | T;
    return (
        typeof payload === "object" && payload !== null && "data" in payload
            ? payload.data
            : payload
    ) as T;
}

export function imageUrl(path?: string | null) {
    if (!path) return null;
    return /^https?:/.test(path)
        ? path
        : `${apiOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}
