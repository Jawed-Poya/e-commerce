import { Outlet } from "react-router-dom";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import AppHeader from "./app-header";

export default function AppLayout() {
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
        </SidebarProvider>
    );
}
