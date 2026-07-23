import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

import { AuthProvider } from "../features/auth/auth-context";
import { CartProvider } from "../features/cart/cart-context";
import { NotificationProvider } from "../features/notifications/notification-context";
import { ThemeProvider } from "./theme-provider";
import { I18nProvider } from "../i18n/i18n-provider";
import { TenantProvider } from "../features/tenancy/tenant-context";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});

export function AppProviders({ children }: PropsWithChildren) {
    return (
        <ThemeProvider>
            <I18nProvider>
            <QueryClientProvider client={queryClient}>
                <TenantProvider>
                    <AuthProvider>
                        <CartProvider>
                            <NotificationProvider>
                                {children}
                            </NotificationProvider>
                        </CartProvider>
                    </AuthProvider>
                </TenantProvider>
            </QueryClientProvider>
            </I18nProvider>
        </ThemeProvider>
    );
}
