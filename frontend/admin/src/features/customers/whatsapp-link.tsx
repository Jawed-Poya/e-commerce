import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WhatsAppLinkProps = {
    url: string | null | undefined;
    customerName: string;
    compact?: boolean;
    className?: string;
};

export function WhatsAppLink({
    url,
    customerName,
    compact = false,
    className,
}: WhatsAppLinkProps) {
    if (!url) return null;

    const accessibleLabel = `Message ${customerName} on WhatsApp`;

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={accessibleLabel}
            title={accessibleLabel}
            className={cn(
                buttonVariants({
                    variant: "outline",
                    size: compact ? "icon-sm" : "sm",
                }),
                "border-emerald-500/35 text-emerald-700 hover:border-emerald-500/60 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300",
                className,
            )}
        >
            <WhatsAppIcon className="size-4" />
            {!compact && <span>WhatsApp</span>}
        </a>
    );
}

function WhatsAppIcon({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={className}
            fill="currentColor"
        >
            <path d="M12.04 2a9.84 9.84 0 0 0-8.43 14.92L2 22l5.22-1.56A9.96 9.96 0 1 0 12.04 2Zm0 17.98a8 8 0 0 1-4.08-1.12l-.29-.17-3.1.93.96-3.01-.19-.31A7.84 7.84 0 1 1 12.04 20Zm4.56-5.88c-.25-.13-1.48-.73-1.71-.81-.23-.09-.4-.13-.57.12-.17.25-.65.81-.8.98-.15.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23a7.5 7.5 0 0 1-1.38-1.72c-.15-.25-.02-.38.11-.5.11-.11.25-.29.38-.44.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.49-.41-.42-.57-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.23.9 2.43 1.02 2.6.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.48-.61 1.69-1.19.21-.59.21-1.09.15-1.19-.06-.11-.23-.17-.48-.29Z" />
        </svg>
    );
}
