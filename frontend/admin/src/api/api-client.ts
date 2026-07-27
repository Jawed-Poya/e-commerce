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

    async download(url: string, params?: object): Promise<void> {
        const { blob, filename } = await this.getBlob(url, params);
        const href = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = href;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(href);
    }

    async createObjectUrl(url: string, params?: object): Promise<string> {
        const { blob } = await this.getBlob(url, params);
        return URL.createObjectURL(blob);
    }

    private async getBlob(url: string, params?: object) {
        const response = await axiosInstance.get<Blob>(url, {
            params,
            responseType: "blob",
            timeout: 600_000,
        });
        const disposition = response.headers["content-disposition"] as string | undefined;
        const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
        const quoted = disposition?.match(/filename="?([^";]+)"?/i)?.[1];
        return {
            blob: response.data,
            filename: encoded ? decodeURIComponent(encoded) : quoted || "download",
        };
    }

    async delete<T>(url: string): Promise<ApiResponse<T>> {
        const response = await axiosInstance.delete<ApiResponse<T>>(url);

        return response.data;
    }
}

export default new ApiClient();
