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
    const text = await response.text();
    let payload: unknown = null;
    if (text.trim()) {
        try {
            payload = JSON.parse(text);
        } catch {
            payload = text;
        }
    }

    const objectPayload = payload && typeof payload === "object"
        ? payload as Record<string, unknown>
        : null;
    const errors = objectPayload?.errors && typeof objectPayload.errors === "object"
        ? objectPayload.errors as Record<string, string[]>
        : undefined;
    const validationMessage = errors
        ? Object.values(errors).flat().find((value) => typeof value === "string" && value.trim())?.trim()
        : undefined;
    const message = [objectPayload?.message, objectPayload?.detail, objectPayload?.title]
        .find((value) => typeof value === "string" && value.trim()) as string | undefined;
    const resolvedMessage = message?.trim() || validationMessage;

    if (!response.ok || objectPayload?.success === false) {
        if (response.status === 401) {
            localStorage.removeItem(customerTokenKey);
            localStorage.removeItem("easycart-customer-session");
            window.dispatchEvent(new Event("easycart-auth-changed"));
        }

        throw new ApiError(
            resolvedMessage || statusMessage(response.status),
            response.status,
            errors,
        );
    }

    if (objectPayload && "data" in objectPayload) {
        return objectPayload.data as T;
    }

    return payload as T;
}

function statusMessage(status: number) {
    if (status === 400) return "Check the entered information and try again.";
    if (status === 401) return "Your session has expired. Sign in again.";
    if (status === 403) return "You do not have permission to perform this action.";
    if (status === 404) return "The requested resource was not found.";
    if (status === 409) return "The request conflicts with the current data. Refresh and try again.";
    if (status >= 500) return "The server could not complete the request. Please try again.";
    return "The request could not be completed.";
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
