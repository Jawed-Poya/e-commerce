import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, LoaderCircle, Pencil, Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useProducts } from "@/features/products/hooks/use-products";
import { useProductLookupsQuery } from "@/features/products/hooks/use-product-mutation";
import { productService, resolveProductImageUrl, type BulkUpdateProduct, type ProductListItem } from "@/services/product.service";
import { productKeys } from "@/keys/product-keys";
import { useI18n } from "@/i18n/i18n-provider";

function getUpdateErrorMessage(error: unknown, messages: { connection: string; endpoint: string; failed: string }) {
    const apiError = error as {
        code?: string;
        message?: string;
        response?: {
            status?: number;
            data?: { message?: string; title?: string; errors?: Record<string, string[]> };
        };
    };
    if (!apiError.response) {
        return messages.connection;
    }
    const data = apiError.response.data;
    const validationMessage = data?.errors && Object.values(data.errors).flat()[0];
    if (validationMessage) return validationMessage;
    if (apiError.response.status === 415) return messages.endpoint;
    return data?.message ?? data?.title ?? apiError.message ?? messages.failed;
}

export default function ProductsPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { t } = useI18n();
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<number[]>([]);
    const [drafts, setDrafts] = useState<BulkUpdateProduct[]>([]);
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [activeEditor, setActiveEditor] = useState(0);
    const { data, isLoading, isError } = useProducts(search);
    const { data: lookups } = useProductLookupsQuery();
    const products = data?.items ?? [];
    const selectedProducts = useMemo(() => products.filter(x => selected.includes(x.id)), [products, selected]);

    useEffect(() => setSelected(ids => ids.filter(id => products.some(x => x.id === id))), [products]);
    const toggle = (id: number) => setSelected(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
    const editProducts = (items: ProductListItem[]) => {
        setDrafts(items.map(({ id, name, barcode, shortDescription, description, slug, categoryId, brandId, unitId, minimumValue, maximumValue, isFeatured, isActive, primaryImageUrl }) =>
            ({ id, name, barcode, shortDescription, description, slug, categoryId, brandId, unitId, minimumValue, maximumValue, isFeatured, isActive, primaryImageUrl })));
        setActiveEditor(0);
        setOpen(true);
    };
    const change = (id: number, values: Partial<BulkUpdateProduct>) => setDrafts(items => items.map(item => item.id === id ? { ...item, ...values } : item));
    const save = async () => {
        setSaving(true);
        try {
            const response = await productService.bulkUpdate(drafts);
            toast.success(response.message ?? t("update.success"));
            await queryClient.invalidateQueries({ queryKey: productKeys.all });
            setSelected([]); setOpen(false);
        } catch (error) {
            toast.error(getUpdateErrorMessage(error, { connection: t("update.connectionError"), endpoint: t("update.endpointError"), failed: t("update.failed") }));
        } finally { setSaving(false); }
    };

    return <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h1 className="text-2xl font-bold">{t("products.title")}</h1><p className="text-sm text-muted-foreground">{t("products.subtitle")}</p></div>
            <div className="flex gap-2">
                {selected.length > 0 && <Button variant="outline" onClick={() => editProducts(selectedProducts)}><Pencil className="me-2 size-4" />{t("products.updateSelected")} ({selected.length})</Button>}
                <Button onClick={() => navigate("/products/new")}><Plus className="me-2 size-4" />{t("products.bulkCreate")}</Button>
            </div>
        </div>
        <div className="relative"><Search className="absolute start-3 top-2.5 size-4 text-muted-foreground" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("products.search")} className="ps-9" /></div>
        <div className="rounded-md border"><Table>
            <TableHeader><TableRow>
                <TableHead className="w-10"><Checkbox aria-label="Select all" checked={products.length > 0 && selected.length === products.length} onCheckedChange={() => setSelected(selected.length === products.length ? [] : products.map(x => x.id))} /></TableHead>
                <TableHead>{t("products.product")}</TableHead><TableHead>{t("products.barcode")}</TableHead><TableHead>{t("products.category")}</TableHead><TableHead>{t("products.price")}</TableHead><TableHead>{t("products.stock")}</TableHead><TableHead>{t("products.status")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
                {isLoading && <TableRow><TableCell colSpan={7} className="h-28 text-center"><LoaderCircle className="mx-auto animate-spin" /></TableCell></TableRow>}
                {isError && <TableRow><TableCell colSpan={7} className="h-28 text-center text-destructive">{t("products.loadError")}</TableCell></TableRow>}
                {!isLoading && !isError && products.length === 0 && <TableRow><TableCell colSpan={7} className="h-28 text-center text-muted-foreground">{t("products.empty")}</TableCell></TableRow>}
                {products.map(product => <TableRow key={product.id} data-state={selected.includes(product.id) ? "selected" : undefined}>
                    <TableCell><Checkbox aria-label={`Select ${product.name}`} checked={selected.includes(product.id)} onCheckedChange={() => toggle(product.id)} /></TableCell>
                    <TableCell><div className="flex items-center gap-3">{resolveProductImageUrl(product.primaryImageUrl) ? <img src={resolveProductImageUrl(product.primaryImageUrl)!} alt="" className="size-10 shrink-0 rounded-md border bg-muted object-cover" /> : <div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted"><ImagePlus className="size-4 text-muted-foreground" /></div>}<span className="font-medium">{product.name}</span></div></TableCell><TableCell>{product.barcode || "—"}</TableCell><TableCell>{product.categoryName}</TableCell>
                    <TableCell>{product.price == null ? "—" : product.price.toLocaleString()}</TableCell><TableCell>{product.stock.toLocaleString()}</TableCell>
                    <TableCell><Badge variant={product.isActive ? "outline" : "secondary"}>{product.isActive ? t("products.active") : t("products.inactive")}</Badge></TableCell>
                </TableRow>)}
            </TableBody>
        </Table></div>

        {open && createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm" onMouseDown={() => !saving && setOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="product-editor-title" className="relative grid max-h-[94vh] w-full max-w-6xl grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-4 overflow-hidden rounded-xl border bg-background p-5 text-foreground shadow-2xl" onMouseDown={event => event.stopPropagation()}>
            <header className="pe-10"><h2 id="product-editor-title" className="text-xl font-semibold">{drafts.length === 1 ? t("update.title") : t("update.bulkTitle")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("update.subtitle")}</p><Button type="button" variant="ghost" size="icon" className="absolute end-6 top-6" aria-label={t("update.close")} onClick={() => setOpen(false)}>×</Button></header>
            <div className={drafts.length > 1 ? "flex gap-2 overflow-x-auto border-b pb-3" : "hidden"}>{drafts.map((item, index) => <Button key={item.id} type="button" size="sm" variant={activeEditor === index ? "default" : "outline"} onClick={() => setActiveEditor(index)}>{index + 1}. {item.name || t("update.untitled")}</Button>)}</div>
            <div className="min-h-0 overflow-y-auto pe-1">{drafts[activeEditor] && [drafts[activeEditor]].map((item) => {
                const index = activeEditor;
                const preview = item.image ? URL.createObjectURL(item.image) : resolveProductImageUrl(item.primaryImageUrl);
                return <div key={item.id} className="grid gap-5 rounded-xl border p-5 lg:grid-cols-[180px_1fr]">
                    <div><div className="aspect-square overflow-hidden rounded-lg border bg-muted">{preview ? <img src={preview} alt={item.name} className="size-full object-cover" /> : <ImagePlus className="m-auto mt-16 text-muted-foreground" />}</div>
                        <Label className="mt-3 flex cursor-pointer items-center justify-center border px-3 py-2 text-sm"><ImagePlus className="me-2 size-4" />{t("update.replaceImage")}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => change(item.id, { image: e.target.files?.[0] })} /></Label>
                        <p className="mt-2 text-xs text-muted-foreground">{t("update.keepImage")}</p></div>
                    <div className="space-y-4"><h3 className="font-semibold">{t("update.productNumber")} #{index + 1}</h3>
                        <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>{t("form.name")} *</Label><Input value={item.name} onChange={e => change(item.id, { name: e.target.value })} /></div><div className="space-y-2"><Label>{t("update.barcode")}</Label><Input value={item.barcode ?? ""} onChange={e => change(item.id, { barcode: e.target.value || null })} /></div></div>
                        <div className="grid gap-4 md:grid-cols-3">
                            <LookupSelect label={`${t("update.category")} *`} value={item.categoryId} options={lookups?.categories ?? []} onChange={categoryId => change(item.id, { categoryId: categoryId! })} required searchText={t("update.searchOption")} emptyText={t("update.noMatch")} />
                            <LookupSelect label={t("form.brand")} value={item.brandId} options={lookups?.brands ?? []} onChange={brandId => change(item.id, { brandId })} searchText={t("update.searchOption")} emptyText={t("update.noMatch")} />
                            <LookupSelect label={t("form.unit")} value={item.unitId} options={lookups?.units ?? []} onChange={unitId => change(item.id, { unitId })} searchText={t("update.searchOption")} emptyText={t("update.noMatch")} />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>{t("form.minimum")}</Label><Input type="number" min={0} value={item.minimumValue ?? ""} onChange={e => change(item.id, { minimumValue: e.target.value ? Number(e.target.value) : null })} /></div><div className="space-y-2"><Label>{t("form.maximum")}</Label><Input type="number" min={0} value={item.maximumValue ?? ""} onChange={e => change(item.id, { maximumValue: e.target.value ? Number(e.target.value) : null })} /></div></div>
                        <div className="space-y-2"><Label>{t("form.slug")}</Label><Input value={item.slug ?? ""} onChange={e => change(item.id, { slug: e.target.value || null })} /></div>
                        <div className="space-y-2"><Label>{t("form.shortDescription")}</Label><Textarea rows={2} value={item.shortDescription ?? ""} onChange={e => change(item.id, { shortDescription: e.target.value || null })} /></div>
                        <div className="space-y-2"><Label>{t("form.description")}</Label><Textarea rows={5} value={item.description ?? ""} onChange={e => change(item.id, { description: e.target.value || null })} /></div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <ToggleCard title={t("bulk.activeProduct")} description={t("update.activeHelp")} checked={item.isActive} onChange={isActive => change(item.id, { isActive })} />
                            <ToggleCard title={t("bulk.featuredProduct")} description={t("update.featuredHelp")} checked={item.isFeatured} onChange={isFeatured => change(item.id, { isFeatured })} />
                        </div>
                    </div>
                </div>;
            })}</div>
            <footer className="flex flex-col-reverse items-center justify-between gap-2 border-t pt-4 sm:flex-row">
                <div className="flex gap-2">{drafts.length > 1 && <><Button type="button" variant="outline" disabled={activeEditor === 0} onClick={() => setActiveEditor(x => x - 1)}>{t("update.previous")}</Button><Button type="button" variant="outline" disabled={activeEditor === drafts.length - 1} onClick={() => setActiveEditor(x => x + 1)}>{t("update.next")}</Button></>}</div>
                <div className="flex gap-2"><Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("form.cancel")}</Button><Button onClick={save} disabled={saving || drafts.some(x => x.name.trim().length < 2 || x.categoryId < 1)}>{saving && <LoaderCircle className="me-2 size-4 animate-spin" />}{saving ? t("update.submitting") : `${t("update.submit")} (${drafts.length})`}</Button></div>
            </footer>
          </section>
        </div>, document.body)}
    </div>;
}

function LookupSelect({ label, value, options, onChange, searchText, emptyText, required = false }: { label: string; value: number | null; options: { id: number; name: string }[]; onChange: (value: number | null) => void; searchText: string; emptyText: string; required?: boolean }) {
    const selected = options.find(option => option.id === value) ?? null;
    return <div className="space-y-2"><Label>{label}</Label><Combobox items={options} value={selected} onValueChange={option => onChange(option?.id ?? null)} itemToStringLabel={option => option.name}>
        <ComboboxInput className="w-full" placeholder={searchText} showClear={!required} />
        <ComboboxContent><ComboboxEmpty>{emptyText}</ComboboxEmpty><ComboboxList>{options.map(option => <ComboboxItem key={option.id} value={option}>{option.name}</ComboboxItem>)}</ComboboxList></ComboboxContent>
    </Combobox></div>;
}

function ToggleCard({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
    const toggle = () => onChange(!checked);
    return <div role="switch" aria-checked={checked} tabIndex={0} onClick={toggle} onKeyDown={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); toggle(); } }} className={`flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${checked ? "border-primary/50 bg-primary/5" : "hover:bg-muted/50"}`}>
        <div className="me-4 text-start"><p className="font-medium">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>
        <Switch checked={checked} tabIndex={-1} aria-hidden className="pointer-events-none" />
    </div>;
}
