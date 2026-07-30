import type { AxiosError } from "axios";

interface ApiErrorEnvelope {
    message?: string;
    errors?: Record<string, string[]>;
}

export function getApiErrorMessage(error: unknown, fallback: string) {
    const axiosError = error as AxiosError<ApiErrorEnvelope>;
    const message = axiosError.response?.data?.message;
    if (typeof message === "string" && message.trim()) return message;

    if (error instanceof Error && error.message.trim()) return error.message;
    return fallback;
}
