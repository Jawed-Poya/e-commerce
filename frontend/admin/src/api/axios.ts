import axios from "axios";

import {
    adminUnauthorizedEvent,
    clearAdminSession,
    getAdminToken,
} from "@/features/auth/auth-storage";

export const apiBaseUrl = (
    import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5188/api"
).replace(/\/+$/, "");
export const apiOrigin = new URL(apiBaseUrl, window.location.origin).origin;

const axiosInstance = axios.create({
    baseURL: apiBaseUrl,
    headers: {
        "Content-Type": "application/json",
    },
    timeout: 30000,
});

axiosInstance.interceptors.request.use(
    (config) => {
        const token = getAdminToken();

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        if (config.data instanceof FormData) {
            delete config.headers["Content-Type"];
        } else {
            config.headers["Content-Type"] = "application/json";
        }

        return config;
    },
    (error) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && getAdminToken()) {
            clearAdminSession();
            window.dispatchEvent(new Event(adminUnauthorizedEvent));
        }

        return Promise.reject(error);
    },
);

export default axiosInstance;
