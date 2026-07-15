import axiosInstance from "./axios";

export interface ApiResponse<T> {
    data: T;
    message?: string;
    success: boolean;
}

class ApiClient {
    async get<T>(url: string, params?: object): Promise<T> {
        const response = await axiosInstance.get<ApiResponse<T>>(url, {
            params,
        });

        return response.data.data;
    }

    async post<T>(url: string, body?: unknown): Promise<T> {
        const response = await axiosInstance.post<ApiResponse<T>>(url, body);

        return response.data.data;
    }

    async put<T>(url: string, body?: unknown): Promise<T> {
        const response = await axiosInstance.put<ApiResponse<T>>(url, body);

        return response.data.data;
    }

    async patch<T>(url: string, body?: unknown): Promise<T> {
        const response = await axiosInstance.patch<ApiResponse<T>>(url, body);

        return response.data.data;
    }

    async delete<T>(url: string): Promise<T> {
        const response = await axiosInstance.delete<ApiResponse<T>>(url);

        return response.data.data;
    }
}

export default new ApiClient();
