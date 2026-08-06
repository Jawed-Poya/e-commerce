import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

import { pwaServiceWorkerPlugin } from "../build/pwa-service-worker-plugin";

export default defineConfig({
    plugins: [
        tailwindcss(),
        react(),
        pwaServiceWorkerPlugin({ cachePrefix: "pharmacy-admin" }),
    ],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    server: {
        proxy: {
            "/api": {
                target: "http://localhost:5188",
                changeOrigin: true,
                ws: true,
            },
            "/uploads": {
                target: "http://localhost:5188",
                changeOrigin: true,
            },
        },
    },
});
