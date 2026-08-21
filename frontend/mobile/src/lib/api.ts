import { getToken } from '@/lib/storage';
import { reportApiAvailable, reportApiUnavailable } from '@/lib/connectivity';
import { getApiBaseUrl, getAssetBaseUrl } from '@/lib/runtime-config';

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

type QueryValue = string | number | boolean | null | undefined;

function requestUrl(path: string, params?: Record<string, QueryValue | QueryValue[]>) {
  const url = new URL(`${getApiBaseUrl()}/${path.replace(/^\/+/, '')}`);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    const values = Array.isArray(value) ? value : [value];
    values.forEach((item) => {
      if (item !== undefined && item !== null && item !== '') {
        url.searchParams.append(key, String(item));
      }
    });
  });
  return url.toString();
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  const object = payload && typeof payload === 'object'
    ? (payload as Record<string, unknown>)
    : null;
  const errors = object?.errors && typeof object.errors === 'object'
    ? (object.errors as Record<string, string[]>)
    : undefined;
  const validationMessage = errors
    ? Object.values(errors).flat().find((value) => typeof value === 'string' && value.trim())
    : undefined;
  const message = [object?.message, object?.detail, object?.title, validationMessage]
    .find((value) => typeof value === 'string' && value.trim()) as string | undefined;

  if (!response.ok || object?.success === false) {
    throw new ApiError(message || fallbackMessage(response.status), response.status, errors);
  }

  return object && 'data' in object ? (object.data as T) : (payload as T);
}

function fallbackMessage(status: number) {
  if (status === 400) return 'Check the entered information and try again.';
  if (status === 401) return 'Your session has expired. Sign in again.';
  if (status === 403) return 'Your account cannot perform this action yet.';
  if (status === 404) return 'The requested information was not found.';
  if (status >= 500) return 'The server could not complete the request. Try again shortly.';
  return 'The request could not be completed.';
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  options?: {
    body?: unknown;
    params?: Record<string, QueryValue | QueryValue[]>;
    signal?: AbortSignal;
  },
) {
  const token = await getToken();
  let response: Response;
  try {
    response = await fetch(requestUrl(path, options?.params), {
      method,
      headers: {
        Accept: 'application/json',
        ...(options?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options?.signal,
    });
  } catch (error) {
    if (!(error instanceof Error && error.name === 'AbortError')) {
      reportApiUnavailable('network');
      throw new ApiError('The store is temporarily unreachable. Your saved products and cart are still available.', 0);
    }
    throw error;
  }

  if (response.status >= 500) reportApiUnavailable('server');
  else reportApiAvailable();
  return parseResponse<T>(response);
}

export const api = {
  get: <T>(path: string, params?: Record<string, QueryValue | QueryValue[]>, signal?: AbortSignal) =>
    request<T>('GET', path, { params, signal }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
};

export function imageUrl(path?: string | null) {
  const value = path?.trim();
  if (!value) return null;
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^api\//i, '');
  return `${getAssetBaseUrl()}/${normalized}`;
}
