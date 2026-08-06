import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";

import { pwaServiceWorkerPlugin } from "../build/pwa-service-worker-plugin";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    pwaServiceWorkerPlugin({ cachePrefix: "pharmacy-store" }),
  ],
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
