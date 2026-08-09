import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions, className }: { title: ReactNode; description: ReactNode; actions?: ReactNode; className?: string }) {
    return (
        <header className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
            <div className="space-y-1">
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
                <p className="max-w-3xl text-xs leading-5 text-muted-foreground sm:text-sm">{description}</p>
            </div>
            {actions && <div className="flex w-full min-w-0 shrink-0 flex-wrap items-center gap-2 [&>*]:max-w-full sm:w-auto">{actions}</div>}
        </header>
    );
}
