import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { useAdminAuth } from "./auth-context";

export function ProtectedRoute() {
    const auth = useAdminAuth();
    const location = useLocation();

    if (auth.loading) {
        return <div className="grid min-h-screen place-items-center bg-background"><div className="text-center"><LoaderCircle className="mx-auto size-8 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Checking admin session...</p></div></div>;
    }

    if (!auth.isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    return <Outlet />;
}
