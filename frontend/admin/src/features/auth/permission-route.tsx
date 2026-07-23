import { ShieldX } from "lucide-react";
import { Link } from "react-router-dom";

import { buttonVariants } from "@/components/ui/button";
import { useAdminAuth } from "./auth-context";
import { getDefaultAdminRoute, hasPermission } from "./permissions";

export function PermissionRoute({
    permission,
    children,
}: {
    permission: string;
    children: React.ReactNode;
}) {
    const { user } = useAdminAuth();
    if (hasPermission(user, permission)) return children;

    return (
        <div className="grid min-h-[65vh] place-items-center p-6 text-center">
            <div className="max-w-md">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
                    <ShieldX className="size-7" />
                </span>
                <h1 className="mt-5 text-2xl font-bold">Permission required</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Your account does not have <code>{permission}</code>. Ask an
                    administrator to assign a role or direct permission, then sign in
                    again.
                </p>
                <Link
                    to={getDefaultAdminRoute(
                        user?.permissions ?? [],
                        user?.roles ?? [],
                    )}
                    className={buttonVariants({ className: "mt-5" })}
                >
                    Go to an allowed section
                </Link>
            </div>
        </div>
    );
}
