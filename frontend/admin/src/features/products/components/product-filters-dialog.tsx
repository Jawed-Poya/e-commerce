import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { useI18n } from "@/i18n/i18n-provider";
import type { ProductListFilters } from "@/services/product.service";

type Option = { id: string; name: string };
type Lookup = { id: number; name: string };

export type AppliedProductFilters = Omit<ProductListFilters, "search" | "page" | "pageSize">;

export function ProductFiltersDialog({ open, filters, categories, brands, units, onOpenChange, onApply }: { open: boolean; filters: AppliedProductFilters; categories: Lookup[]; brands: Lookup[]; units: Lookup[]; onOpenChange: (open: boolean) => void; onApply: (filters: AppliedProductFilters) => void }) {
    const { t } = useI18n();
    const [draft, setDraft] = useState(filters);
    useEffect(() => { if (open) setDraft(filters); }, [open, filters]);

    const booleanOptions: Option[] = [{ id: "all", name: t("filters.all") }, { id: "true", name: t("filters.yes") }, { id: "false", name: t("filters.no") }];
    const sortOptions: Option[] = [{ id: "createdAt-desc", name: t("filters.newest") }, { id: "createdAt-asc", name: t("filters.oldest") }, { id: "name-asc", name: t("filters.nameAsc") }, { id: "name-desc", name: t("filters.nameDesc") }, { id: "price-asc", name: t("filters.priceAsc") }, { id: "price-desc", name: t("filters.priceDesc") }];
    const sortValue = `${draft.sortBy ?? "createdAt"}-${draft.sortDescending === false ? "asc" : "desc"}`;

    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full sm:max-w-2xl">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><SlidersHorizontal className="size-5" />{t("filters.title")}</DialogTitle><DialogDescription>{t("filters.description")}</DialogDescription></DialogHeader>
            <div className="grid max-h-[65vh] gap-5 overflow-y-auto py-2 sm:grid-cols-2">
                <FilterLookup label={t("products.category")} value={draft.categoryId} options={categories} onChange={categoryId => setDraft(x => ({ ...x, categoryId }))} />
                <FilterLookup label={t("form.brand")} value={draft.brandId} options={brands} onChange={brandId => setDraft(x => ({ ...x, brandId }))} />
                <FilterLookup label={t("form.unit")} value={draft.unitId} options={units} onChange={unitId => setDraft(x => ({ ...x, unitId }))} />
                <OptionCombobox label={t("products.status")} value={draft.isActive === undefined ? "all" : String(draft.isActive)} options={booleanOptions} onChange={value => setDraft(x => ({ ...x, isActive: value === "all" ? undefined : value === "true" }))} />
                <OptionCombobox label={t("filters.featured")} value={draft.isFeatured === undefined ? "all" : String(draft.isFeatured)} options={booleanOptions} onChange={value => setDraft(x => ({ ...x, isFeatured: value === "all" ? undefined : value === "true" }))} />
                <OptionCombobox label={t("filters.sort") } value={sortValue} options={sortOptions} onChange={value => { const [sortBy, direction] = value.split("-") as ["name" | "price" | "createdAt", "asc" | "desc"]; setDraft(x => ({ ...x, sortBy, sortDescending: direction === "desc" })); }} />
                <div className="space-y-2"><Label>{t("filters.minPrice")}</Label><Input type="number" min={0} value={draft.minPrice ?? ""} onChange={event => setDraft(x => ({ ...x, minPrice: event.target.value === "" ? undefined : Number(event.target.value) }))} /></div>
                <div className="space-y-2"><Label>{t("filters.maxPrice")}</Label><Input type="number" min={0} value={draft.maxPrice ?? ""} onChange={event => setDraft(x => ({ ...x, maxPrice: event.target.value === "" ? undefined : Number(event.target.value) }))} /></div>
            </div>
            <DialogFooter className="border-t pt-4"><Button type="button" variant="ghost" onClick={() => setDraft({})}>{t("filters.clear")}</Button><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("form.cancel")}</Button><Button type="button" onClick={() => { onApply(draft); onOpenChange(false); }}>{t("filters.apply")}</Button></DialogFooter>
        </DialogContent>
    </Dialog>;
}

function FilterLookup({ label, value, options, onChange }: { label: string; value?: number; options: Lookup[]; onChange: (value?: number) => void }) {
    const { t } = useI18n();
    const selected = options.find(option => option.id === value) ?? null;
    return <div className="space-y-2"><Label>{label}</Label><Combobox items={options} value={selected} onValueChange={option => onChange(option?.id)} itemToStringLabel={option => option.name}><ComboboxInput className="w-full" placeholder={t("form.search")} showClear /><ComboboxContent><ComboboxEmpty>{t("form.noMatch")}</ComboboxEmpty><ComboboxList>{options.map(option => <ComboboxItem key={option.id} value={option}>{option.name}</ComboboxItem>)}</ComboboxList></ComboboxContent></Combobox></div>;
}

function OptionCombobox({ label, value, options, onChange }: { label: string; value: string; options: Option[]; onChange: (value: string) => void }) {
    const { t } = useI18n();
    const selected = options.find(option => option.id === value) ?? options[0];
    return <div className="space-y-2"><Label>{label}</Label><Combobox items={options} value={selected} onValueChange={option => option && onChange(option.id)} itemToStringLabel={option => option.name}><ComboboxInput className="w-full" placeholder={t("form.search")} /><ComboboxContent><ComboboxEmpty>{t("form.noMatch")}</ComboboxEmpty><ComboboxList>{options.map(option => <ComboboxItem key={option.id} value={option}>{option.name}</ComboboxItem>)}</ComboboxList></ComboboxContent></Combobox></div>;
}
