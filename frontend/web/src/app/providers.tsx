import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

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

export function AppProviders({ children }: PropsWithChildren) {
    return (
        <ThemeProvider>
            <I18nProvider>
                <QueryClientProvider client={queryClient}>
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
