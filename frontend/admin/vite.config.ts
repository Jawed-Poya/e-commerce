import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

import { pwaServiceWorkerPlugin } from "../build/pwa-service-worker-plugin";

export default defineConfig({
    plugins: [
        tailwindcss(),
        react(),
        pwaServiceWorkerPlugin({ cachePrefix: "pharmacy-admin" }),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
