import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/manrope/wght.css";
import "@fontsource-variable/vazirmatn/wght.css";
import "@fontsource-variable/noto-sans-arabic/wght.css";
import "@fontsource-variable/noto-naskh-arabic/wght.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import { AdminProviders } from "@/app/providers";
import "@/index.css";
import { router } from "@/routes/routes";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <AdminProviders>
            <RouterProvider router={router} />
        </AdminProviders>
    </React.StrictMode>,
);


if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => {
        void navigator.serviceWorker.register("/service-worker.js");
    });
}
