import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "./ui/button";

type ListPaginationProps = {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    disabled?: boolean;
};

export function ListPagination({
    page,
    totalPages,
    onPageChange,
    disabled = false,
}: ListPaginationProps) {
    if (totalPages <= 1) return null;

    const first = Math.max(1, Math.min(page - 2, Math.max(1, totalPages - 4)));
    const pages = Array.from(
        { length: Math.min(5, totalPages) },
        (_, index) => first + index,
    );

    return (
        <nav
            className="mt-6 flex flex-wrap items-center justify-center gap-1.5"
            aria-label="Pagination"
        >
            <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-lg"
                disabled={disabled || page <= 1}
                onClick={() => onPageChange(page - 1)}
                aria-label="Previous page"
            >
                <ChevronLeft className="size-4 rtl:rotate-180" />
            </Button>

            {pages.map((value) => (
                <Button
                    key={value}
                    type="button"
                    variant={value === page ? "default" : "outline"}
                    size="icon"
                    className="rounded-lg"
                    disabled={disabled}
                    onClick={() => onPageChange(value)}
                    aria-current={value === page ? "page" : undefined}
                >
                    {value}
                </Button>
            ))}

            <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-lg"
                disabled={disabled || page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                aria-label="Next page"
            >
                <ChevronRight className="size-4 rtl:rotate-180" />
            </Button>

            <span className="ms-2 text-xs font-semibold tabular-nums text-muted-foreground">
                {page} / {totalPages}
            </span>
        </nav>
    );
}
