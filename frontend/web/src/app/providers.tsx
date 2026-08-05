import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, type PropsWithChildren } from "react";

import { AuthProvider } from "../features/auth/auth-context";
import { CartProvider } from "../features/cart/cart-context";
import { CompanyProvider } from "../features/company/company-context";
import { NotificationProvider } from "../features/notifications/notification-context";
import { I18nProvider } from "../i18n/i18n-provider";
import { ThemeProvider } from "./theme-provider";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60_000,
            gcTime: 10 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
        },
        mutations: {
            retry: 0,
        },
    },
});

function PwaQueryCacheWarmer() {
    const client = useQueryClient();

    useEffect(() => {
        const warmActiveQueries = () => {
            void client.invalidateQueries({ refetchType: "active" });
        };

        window.addEventListener("commerce-pwa-ready", warmActiveQueries);
        return () =>
            window.removeEventListener(
                "commerce-pwa-ready",
                warmActiveQueries,
            );
    }, [client]);

    return null;
}

export function AppProviders({ children }: PropsWithChildren) {
    return (
        <ThemeProvider>
            <I18nProvider>
                <QueryClientProvider client={queryClient}>
                    <PwaQueryCacheWarmer />
                    <CompanyProvider>
                        <AuthProvider>
                            <CartProvider>
                                <NotificationProvider>
                                    {children}
                                </NotificationProvider>
                            </CartProvider>
                        </AuthProvider>
                    </CompanyProvider>
                </QueryClientProvider>
            </I18nProvider>
        </ThemeProvider>
    );
}
