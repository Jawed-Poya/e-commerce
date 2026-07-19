import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

import { AuthProvider } from "../features/auth/auth-context";
import { CartProvider } from "../features/cart/cart-context";
import { NotificationProvider } from "../features/notifications/notification-context";
import { ThemeProvider } from "./theme-provider";

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
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <CartProvider>
                        <NotificationProvider>
                            {children}
                        </NotificationProvider>
                    </CartProvider>
                </AuthProvider>
            </QueryClientProvider>
        </ThemeProvider>
    );
}
