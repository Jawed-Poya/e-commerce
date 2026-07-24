import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/manrope/wght.css";
import "@fontsource-variable/vazirmatn/wght.css";
import "@fontsource-variable/noto-sans-arabic/wght.css";
import "@fontsource-variable/noto-naskh-arabic/wght.css";
import React from "react";
import ReactDOM from "react-dom/client";

import { RouterProvider } from "react-router-dom";
import { router } from "./routes/routes";
import "@/index.css";
import { ThemeProvider } from "./components/theme-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/i18n/i18n-provider";
import { AdminAuthProvider } from "@/features/auth/auth-context";
import { AdminNotificationProvider } from "@/features/notifications/admin-notification-context";
import { TenantProvider } from "@/features/tenancy/tenant-context";

const client = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <ThemeProvider>
          <I18nProvider>
            <QueryClientProvider client={client}>
                <TenantProvider>
                    <AdminAuthProvider>
                        <AdminNotificationProvider>
                            <RouterProvider router={router} />
                        </AdminNotificationProvider>
                    </AdminAuthProvider>
                </TenantProvider>
            </QueryClientProvider>
          </I18nProvider>
        </ThemeProvider>
    </React.StrictMode>,
);
