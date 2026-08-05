import { Outlet } from "react-router-dom";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import AppHeader from "./app-header";
import { Toaster } from "sonner";
import { useTheme } from "next-themes";
import { MobileAdminNav } from "@/components/navigation/mobile-admin-nav";

export default function AppLayout() {
    const { theme } = useTheme();
    return (
        <SidebarProvider>
            <AppSidebar />

            <SidebarInset>
                <AppHeader />

                <main
                    className="min-w-0 flex-1 overflow-x-hidden p-3 pb-24 sm:p-4 sm:pb-24 lg:p-6 lg:pb-6"
                >
                    <Outlet />
                </main>
                <MobileAdminNav />
            </SidebarInset>

            <Toaster
                closeButton
                position="bottom-left"
                richColors
                theme={theme as "dark" | "light"}
            />
        </SidebarProvider>
    );
}
