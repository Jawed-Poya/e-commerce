import type { AxiosError } from "axios";

interface ApiErrorEnvelope {
    message?: unknown;
    title?: unknown;
    detail?: unknown;
    errors?: Record<string, unknown>;
}

function nonBlank(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstValidationMessage(errors: ApiErrorEnvelope["errors"]) {
    if (!errors || typeof errors !== "object") return null;
    for (const value of Object.values(errors)) {
        if (Array.isArray(value)) {
            const message = value.map(nonBlank).find(Boolean);
            if (message) return message;
        } else {
            const message = nonBlank(value);
            if (message) return message;
        }
    }
    return null;
}

export function getResponseMessage(data: unknown) {
    if (!data || typeof data !== "object") return null;
    const envelope = data as ApiErrorEnvelope;
    return (
        nonBlank(envelope.message) ??
        nonBlank(envelope.detail) ??
        nonBlank(envelope.title) ??
        firstValidationMessage(envelope.errors)
    );
}

export function getApiErrorMessage(error: unknown, fallback: string) {
    const axiosError = error as AxiosError<unknown>;
    const responseMessage = getResponseMessage(axiosError.response?.data);
    if (responseMessage) return responseMessage;

    if (error instanceof Error) {
        const message = nonBlank(error.message);
        if (message) return message;
    }

    return nonBlank(fallback) ?? "The request could not be completed.";
}
