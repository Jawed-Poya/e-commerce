import React from "react";
import ReactDOM from "react-dom/client";

import { RouterProvider } from "react-router-dom";
import { router } from "./routes/routes";
import "@/index.css";
import { ThemeProvider } from "./components/theme-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/i18n/i18n-provider";
import { AdminAuthProvider } from "@/features/auth/auth-context";

const client = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <ThemeProvider>
          <I18nProvider>
            <QueryClientProvider client={client}>
                <AdminAuthProvider>
                    <RouterProvider router={router} />
                </AdminAuthProvider>
            </QueryClientProvider>
          </I18nProvider>
        </ThemeProvider>
    </React.StrictMode>,
);
