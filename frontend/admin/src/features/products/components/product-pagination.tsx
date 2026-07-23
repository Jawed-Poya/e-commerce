import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { useI18n } from "@/i18n/i18n-provider";

export function ProductPagination({ page, pageSize, totalCount, totalPages, onPageChange, onPageSizeChange }: { page: number; pageSize: number; totalCount: number; totalPages: number; onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void }) {
    const { t } = useI18n();
    const calculatedTotalPages = Math.ceil(totalCount / Math.max(1, pageSize));
    const pageCount = Math.max(1, calculatedTotalPages || totalPages || 1);
    const currentPage = Math.min(Math.max(1, page), pageCount);
    const start = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalCount);
    const visiblePages = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1]);
    const pages = Array.from(visiblePages).filter(value => value >= 1 && value <= pageCount).sort((a, b) => a - b);
    const pageSizeOptions = [10, 20, 50].map(size => ({ id: size, name: String(size) }));
    const selectedPageSize = pageSizeOptions.find(option => option.id === pageSize) ?? pageSizeOptions[1];

    return <footer className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">{t("pagination.showing")} {start}–{end} {t("pagination.of")} {totalCount}</p>
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>{t("pagination.rows")}</span><Combobox items={pageSizeOptions} value={selectedPageSize} onValueChange={option => option && onPageSizeChange(option.id)} itemToStringLabel={option => option.name}><ComboboxInput className="w-20 text-foreground" aria-label={t("pagination.rows")} /><ComboboxContent><ComboboxList>{pageSizeOptions.map(option => <ComboboxItem key={option.id} value={option}>{option.name}</ComboboxItem>)}</ComboboxList></ComboboxContent></Combobox></div>
            <Button variant="outline" size="icon" aria-label={t("pagination.previous")} disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}><ChevronLeft className="size-4 rtl:rotate-180" /></Button>
            {pages.map((value, index) => <span key={value} className="contents">{index > 0 && value - pages[index - 1] > 1 && <span className="flex size-8 items-center justify-center text-muted-foreground" aria-hidden>…</span>}<Button variant={value === currentPage ? "default" : "outline"} size="icon" aria-label={`${t("pagination.page")} ${value}`} aria-current={value === currentPage ? "page" : undefined} onClick={() => onPageChange(value)}>{value}</Button></span>)}
            <Button variant="outline" size="icon" aria-label={t("pagination.next")} disabled={currentPage >= pageCount} onClick={() => onPageChange(currentPage + 1)}><ChevronRight className="size-4 rtl:rotate-180" /></Button>
        </div>
    </footer>;
}
