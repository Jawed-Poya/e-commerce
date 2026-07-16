import { Outlet } from "react-router-dom";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import AppHeader from "./app-header";
import { Toaster } from "sonner";
import { useTheme } from "next-themes";

export default function AppLayout() {
    const { theme } = useTheme();
    return (
        <SidebarProvider>
            <AppSidebar />

            <SidebarInset>
                <AppHeader />

                <main
                    className="
                    flex-1
                    p-4
                "
                >
                    <Outlet />
                </main>
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
