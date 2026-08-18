import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import type * as React from "react";

import { cn } from "../../lib/utils";

export function ScrollArea({
    className,
    children,
    ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {
    return (
        <ScrollAreaPrimitive.Root
            className={cn("relative overflow-hidden", className)}
            {...props}
        >
            <ScrollAreaPrimitive.Viewport className="size-full rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-primary/35">
                {children}
            </ScrollAreaPrimitive.Viewport>
            <ScrollBar />
            <ScrollAreaPrimitive.Corner />
        </ScrollAreaPrimitive.Root>
    );
}

function ScrollBar({
    className,
    orientation = "vertical",
    ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
    return (
        <ScrollAreaPrimitive.ScrollAreaScrollbar
            orientation={orientation}
            className={cn(
                "z-20 flex touch-none select-none p-0.5 transition-colors",
                orientation === "vertical" && "h-full w-2.5 border-s border-transparent",
                orientation === "horizontal" && "h-2.5 flex-col border-t border-transparent",
                className,
            )}
            {...props}
        >
            <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border hover:bg-muted-foreground/45" />
        </ScrollAreaPrimitive.ScrollAreaScrollbar>
    );
}
