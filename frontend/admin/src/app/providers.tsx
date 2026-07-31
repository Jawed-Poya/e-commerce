import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

import { ThemeProvider } from "@/components/theme-provider";
import { AdminAuthProvider } from "@/features/auth/auth-context";
import { CompanyProvider } from "@/features/company/company-context";
import { AdminNotificationProvider } from "@/features/notifications/admin-notification-context";
import { OfflineSyncManager } from "@/features/offline/offline-sync-manager";
import { I18nProvider } from "@/i18n/i18n-provider";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            gcTime: 10 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
        },
        mutations: {
            retry: 0,
        },
    },
});

export function AdminProviders({ children }: PropsWithChildren) {
    return (
        <ThemeProvider>
            <I18nProvider>
                <QueryClientProvider client={queryClient}>
                    <CompanyProvider>
                        <AdminAuthProvider>
                            <AdminNotificationProvider>
                                <OfflineSyncManager />
                                {children}
                            </AdminNotificationProvider>
                        </AdminAuthProvider>
                    </CompanyProvider>
                </QueryClientProvider>
            </I18nProvider>
        </ThemeProvider>
    );
}
