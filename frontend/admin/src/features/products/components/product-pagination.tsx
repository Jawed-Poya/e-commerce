import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { useI18n } from "@/i18n/i18n-provider";

export function ProductPagination({ page, pageSize, totalCount, totalPages, onPageChange, onPageSizeChange }: { page: number; pageSize: number; totalCount: number; totalPages: number; onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void }) {
    const { t } = useI18n();
    const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, totalCount);
    const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => Math.max(1, Math.min(page - 2, totalPages - 4)) + index).filter(value => value <= totalPages);
    const pageSizeOptions = [10, 20, 50].map(size => ({ id: size, name: String(size) }));
    const selectedPageSize = pageSizeOptions.find(option => option.id === pageSize) ?? pageSizeOptions[1];

    return <footer className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">{t("pagination.showing")} {start}–{end} {t("pagination.of")} {totalCount}</p>
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>{t("pagination.rows")}</span><Combobox items={pageSizeOptions} value={selectedPageSize} onValueChange={option => option && onPageSizeChange(option.id)} itemToStringLabel={option => option.name}><ComboboxInput className="w-20 text-foreground" aria-label={t("pagination.rows")} /><ComboboxContent><ComboboxList>{pageSizeOptions.map(option => <ComboboxItem key={option.id} value={option}>{option.name}</ComboboxItem>)}</ComboboxList></ComboboxContent></Combobox></div>
            <Button variant="outline" size="icon" aria-label={t("pagination.previous")} disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft className="size-4 rtl:rotate-180" /></Button>
            {pages.map(value => <Button key={value} variant={value === page ? "default" : "outline"} size="icon" aria-current={value === page ? "page" : undefined} onClick={() => onPageChange(value)}>{value}</Button>)}
            <Button variant="outline" size="icon" aria-label={t("pagination.next")} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}><ChevronRight className="size-4 rtl:rotate-180" /></Button>
        </div>
    </footer>;
}
