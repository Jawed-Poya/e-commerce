import axiosInstance from "./axios";

export interface ApiResponse<T> {
    data: T;
    message?: string;
    success: boolean;
}

class ApiClient {
    async get<T>(url: string, params?: object): Promise<ApiResponse<T>> {
        const response = await axiosInstance.get<ApiResponse<T>>(url, {
            params,
        });

        return response.data;
    }

    async post<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
        const response = await axiosInstance.post<ApiResponse<T>>(url, body);

        return response.data;
    }

    async put<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
        const response = await axiosInstance.put<ApiResponse<T>>(url, body);

        return response.data;
    }

    async patch<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
        const response = await axiosInstance.patch<ApiResponse<T>>(url, body);

        return response.data;
    }

    async download(url: string, params?: object): Promise<{ filename: string; size: number }> {
        const { blob, filename } = await this.getBlob(url, params);
        const href = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = href;
        link.download = filename;
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
        let response;
        try {
            response = await axiosInstance.get<Blob>(url, {
                params,
                responseType: "blob",
                timeout: 600_000,
            });
        } catch (error) {
            const candidate = error as { response?: { data?: unknown }; message?: string };
            if (candidate.response?.data instanceof Blob) {
                try {
                    const body = JSON.parse(await candidate.response.data.text()) as {
                        message?: string;
                        title?: string;
                        errors?: Record<string, string[]>;
                    };
                    const validationMessage = body.errors && Object.values(body.errors).flat().find((value) => value?.trim());
                    const responseMessage = body.message?.trim() || body.title?.trim() || validationMessage?.trim();
                    if (responseMessage) candidate.message = responseMessage;
                } catch {
                    // Keep the original transport error when the response is not JSON.
                }
            }
            throw candidate;
        }
        const contentType = (response.headers["content-type"] as string | undefined)?.toLowerCase() ?? "";
        if (contentType.includes("json")) {
            let message = "The server returned an unexpected response instead of a file.";
            try {
                const body = JSON.parse(await response.data.text()) as {
                    message?: string;
                    title?: string;
                    errors?: Record<string, string[]>;
                };
                const validationMessage = body.errors && Object.values(body.errors).flat().find((value) => value?.trim());
                message = body.message?.trim() || body.title?.trim() || validationMessage?.trim() || message;
            } catch {
                // Keep the safe download-specific message for malformed JSON.
            }
            throw new Error(message);
        }
        const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
        if (blob.size === 0) {
            throw new Error("The server returned an empty file. Please try again.");
        }
        const disposition = response.headers["content-disposition"] as string | undefined;
        const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
        const quoted = disposition?.match(/filename="?([^";]+)"?/i)?.[1];
        const resolvedFilename = (encoded ? decodeURIComponent(encoded) : quoted)?.trim();
        return {
            blob,
            filename: resolvedFilename || "download",
        };
    }

    async delete<T>(url: string): Promise<ApiResponse<T>> {
        const response = await axiosInstance.delete<ApiResponse<T>>(url);

        return response.data;
    }
}

export default new ApiClient();
