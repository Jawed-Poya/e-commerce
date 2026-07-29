import {
    Barcode,
    Boxes,
    CalendarDays,
    Calculator,
    PackageSearch,
    Plus,
    Scale,
    Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ServerSearchCombobox } from "@/components/server-search-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompany } from "@/features/company/company-context";
import { operationsService } from "@/features/operations/operations-service";
import type {
    DocumentItem,
    OperationProduct,
    OperationProductUnit,
} from "@/features/operations/operations-types";
import { useI18n } from "@/i18n/i18n-provider";

interface DocumentLinesProps {
    items: DocumentItem[];
    setItems: React.Dispatch<React.SetStateAction<DocumentItem[]>>;
    mode: "purchase" | "sale";
}

const emptyItem = (): DocumentItem => ({
    productId: 0,
    product: null,
    unitId: null,
    unitName: null,
    conversionFactor: 1,
    quantity: 1,
    amount: 0,
    lotNumber: "",
    expireDate: null,
});

function fallbackUnit(product: OperationProduct): OperationProductUnit {
    return {
        unitId: product.baseUnitId ?? 0,
        unitName: product.baseUnitName ?? "Base unit",
        conversionFactor: 1,
        barcode: product.barcode,
        defaultPrice: product.defaultPrice,
        availableQuantity: product.availableQuantity,
        isBase: true,
        isDefault: true,
    };
}

function defaultUnit(product: OperationProduct) {
    return (
        product.units.find((unit) => unit.isDefault) ??
        product.units.find((unit) => unit.isBase) ??
        product.units[0] ??
        fallbackUnit(product)
    );
}

function currentUnit(item: DocumentItem) {
    if (!item.product) return null;
    return (
        item.product.units.find((unit) => unit.unitId === item.unitId) ??
        fallbackUnit(item.product)
    );
}

function selectedBounds(item: DocumentItem, mode: "purchase" | "sale") {
    const product = item.product;
    const unit = currentUnit(item);
    const factor = Math.max(unit?.conversionFactor ?? 1, 0.000001);
    const minimum = Math.max((product?.minimumValue ?? 1) / factor, 0.001);
    const configuredMaximum = product?.maximumValue != null
        ? product.maximumValue / factor
        : Number.MAX_SAFE_INTEGER;
    const availableMaximum = mode === "sale"
        ? unit?.availableQuantity ?? product?.availableQuantity ?? Number.MAX_SAFE_INTEGER
        : Number.MAX_SAFE_INTEGER;
    return {
        minimum,
        maximum: Math.min(configuredMaximum, availableMaximum),
    };
}

function quantityError(
    item: DocumentItem,
    mode: "purchase" | "sale",
    translate: (value: string) => string,
) {
    const product = item.product;
    const unit = currentUnit(item);
    if (!product || !unit || item.quantity <= 0) return null;
    const bounds = selectedBounds(item, mode);
    if (item.quantity < bounds.minimum)
        return `${translate("Minimum quantity")}: ${bounds.minimum.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${unit.unitName}.`;
    if (item.quantity > bounds.maximum) {
        const label = mode === "sale" && bounds.maximum === unit.availableQuantity
            ? translate("Available quantity")
            : translate("Maximum quantity");
        return `${label}: ${bounds.maximum.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${unit.unitName}.`;
    }
    return null;
}

export function DocumentLines({ items, setItems, mode }: DocumentLinesProps) {
    const { formatMoney } = useCompany();
    const { tr } = useI18n();
    const selectedIds = new Set(items.map((item) => item.productId).filter(Boolean));

    const update = (index: number, patch: Partial<DocumentItem>) =>
        setItems((current) =>
            current.map((item, itemIndex) =>
                itemIndex === index ? { ...item, ...patch } : item,
            ),
        );

    const remove = (index: number) =>
        setItems((current) =>
            current.length === 1
                ? [emptyItem()]
                : current.filter((_, itemIndex) => itemIndex !== index),
        );

    const selectProduct = (
        index: number,
        currentProductId: number,
        product: OperationProduct | null,
    ) => {
        if (product && product.id !== currentProductId && selectedIds.has(product.id)) {
            toast.error(
                tr("A product can be selected only once. Update the existing line quantity instead."),
            );
            return;
        }

        if (!product) {
            update(index, emptyItem());
            return;
        }

        const unit = defaultUnit(product);
        const minimum = Math.max((product.minimumValue ?? 1) / unit.conversionFactor, 0.001);
        update(index, {
            product,
            productId: product.id,
            unitId: unit.unitId || null,
            unitName: unit.unitName,
            conversionFactor: unit.conversionFactor,
            quantity: minimum,
            amount: mode === "sale" ? unit.defaultPrice ?? 0 : 0,
        });
    };

    const selectUnit = (index: number, unit: OperationProductUnit) => {
        const product = items[index]?.product;
        if (!product) return;
        const minimum = Math.max((product.minimumValue ?? 1) / unit.conversionFactor, 0.001);
        update(index, {
            unitId: unit.unitId || null,
            unitName: unit.unitName,
            conversionFactor: unit.conversionFactor,
            quantity: minimum,
            amount: mode === "sale" ? unit.defaultPrice ?? 0 : 0,
        });
    };

    return (
        <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="flex items-center gap-2 font-semibold">
                        <PackageSearch className="size-4 text-primary" />
                        {tr("Product lines")}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {tr("Search by product name or barcode, select the selling unit, then enter quantity and")} {mode === "purchase" ? tr("receiving details.") : tr("selling price.")}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setItems((current) => [...current, emptyItem()])}
                >
                    <Plus className="me-2 size-4" />
                    {tr("Add product")}
                </Button>
            </div>

            <div className="space-y-4">
                {items.map((item, index) => {
                    const lineTotal = item.quantity * item.amount;
                    const validation = quantityError(item, mode, tr);
                    const unit = currentUnit(item);
                    const units = item.product?.units.length
                        ? item.product.units
                        : item.product
                          ? [fallbackUnit(item.product)]
                          : [];
                    const bounds = selectedBounds(item, mode);

                    return (
                        <Card key={index} className="overflow-hidden border-border/80 bg-card shadow-none dark:border-white/10">
                            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/70 bg-muted/25 px-4 py-3 dark:border-white/10">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="secondary">{tr("Line")} {index + 1}</Badge>
                                        <p className="truncate text-sm font-medium">{item.product?.name ?? tr("Choose a product")}</p>
                                        {item.product?.usesDisplayStock ? <Badge variant="outline">{tr("Display stock")}</Badge> : null}
                                        {unit ? <Badge variant="outline" className="border-primary/25 bg-primary/5 text-primary">{unit.unitName}</Badge> : null}
                                    </div>
                                    {item.product ? (
                                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                            <span className="inline-flex items-center gap-1"><Barcode className="size-3" />{unit?.barcode ?? item.product.barcode ?? tr("No barcode")}</span>
                                            <span className="inline-flex items-center gap-1"><Boxes className="size-3" />{unit?.availableQuantity ?? item.product.availableQuantity} {unit?.unitName ?? tr("available")}</span>
                                            {unit && unit.conversionFactor !== 1 ? (
                                                <span className="inline-flex items-center gap-1"><Scale className="size-3" />1 {unit.unitName} = {unit.conversionFactor} {item.product.baseUnitName ?? tr("base units")}</span>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                                <Button
                                    type="button"
                                    size="icon-sm"
                                    variant="ghost"
                                    className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    aria-label={`${tr("Remove line")} ${index + 1}`}
                                    onClick={() => remove(index)}
                                >
                                    <Trash2 className="size-4" />
                                </Button>
                            </CardHeader>

                            <CardContent className="space-y-4 p-4">
                                <div className="space-y-2">
                                    <Label>{tr("Product")}</Label>
                                    <ServerSearchCombobox<OperationProduct>
                                        value={item.product ?? null}
                                        onValueChange={(product) => selectProduct(index, item.productId, product)}
                                        queryKey={["operations", "product-search", mode, index, ...Array.from(selectedIds).sort()]}
                                        search={async (search) => {
                                            const products = await operationsService.products(search, 30);
                                            return products.filter((product) =>
                                                (mode === "sale" || !product.usesDisplayStock) &&
                                                (product.id === item.productId || !selectedIds.has(product.id)),
                                            );
                                        }}
                                        getLabel={(product) => product.name}
                                        getDescription={(product) => {
                                            const defaultSellingUnit = defaultUnit(product);
                                            return `${defaultSellingUnit.barcode ?? product.barcode ?? tr("No barcode")} · ${tr("Stock")} ${defaultSellingUnit.availableQuantity} ${defaultSellingUnit.unitName}${defaultSellingUnit.defaultPrice != null ? ` · ${formatMoney(defaultSellingUnit.defaultPrice)}` : ""}`;
                                        }}
                                        placeholder={tr("Search product or barcode…")}
                                        emptyText={tr("No available products match your search.")}
                                    />
                                </div>

                                {units.length > 1 ? (
                                    <div className="space-y-2">
                                        <Label>{mode === "purchase" ? tr("Receiving unit") : tr("Selling unit")}</Label>
                                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                            {units.map((option) => {
                                                const active = option.unitId === unit?.unitId;
                                                return (
                                                    <button
                                                        key={option.unitId}
                                                        type="button"
                                                        onClick={() => selectUnit(index, option)}
                                                        className={`rounded-xl border p-3 text-start transition ${active ? "border-primary bg-primary/8 ring-2 ring-primary/10" : "border-border/80 bg-background hover:border-primary/40 hover:bg-muted/40 dark:border-white/10"}`}
                                                    >
                                                        <span className="block text-sm font-semibold">{option.unitName}</span>
                                                        <span className="mt-1 block text-xs text-muted-foreground">1 = {option.conversionFactor} {item.product?.baseUnitName ?? tr("base units")}</span>
                                                        {mode === "sale" ? <span className="mt-2 block text-xs font-medium text-primary">{option.defaultPrice != null ? formatMoney(option.defaultPrice) : tr("Set price")}</span> : null}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : null}

                                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                    <LineField label={`${tr("Quantity")} · ${unit?.unitName ?? tr("Unit")}`}>
                                        <Input
                                            type="number"
                                            min={bounds.minimum}
                                            max={Number.isFinite(bounds.maximum) ? bounds.maximum : undefined}
                                            step="0.001"
                                            value={item.quantity}
                                            aria-invalid={Boolean(validation)}
                                            onChange={(event) => update(index, { quantity: Number(event.target.value) })}
                                        />
                                        {validation ? <p className="text-xs font-medium text-destructive">{validation}</p> : null}
                                    </LineField>

                                    <LineField label={`${mode === "purchase" ? tr("Unit cost") : tr("Unit price")} · ${unit?.unitName ?? tr("Unit")}`}>
                                        <Input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={item.amount}
                                            onChange={(event) => update(index, { amount: Number(event.target.value) })}
                                        />
                                    </LineField>

                                    {mode === "purchase" ? (
                                        <>
                                            <LineField label={tr("Lot number")}>
                                                <Input value={item.lotNumber ?? ""} onChange={(event) => update(index, { lotNumber: event.target.value })} placeholder={tr("Optional")} />
                                            </LineField>
                                            <LineField label={tr("Expiry date")}>
                                                <div className="relative">
                                                    <CalendarDays className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                                    <Input className="ps-9" type="date" value={item.expireDate ?? ""} onChange={(event) => update(index, { expireDate: event.target.value || null })} />
                                                </div>
                                            </LineField>
                                        </>
                                    ) : null}

                                    <div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-3 dark:border-primary/25">
                                        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Calculator className="size-3.5" />{tr("Line total")}</p>
                                        <p className="mt-2 text-lg font-semibold tabular-nums text-foreground">{formatMoney(lineTotal)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </section>
    );
}

function LineField({ label, children }: { label: string; children: React.ReactNode }) {
    return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

export function newDocumentItem(): DocumentItem {
    return emptyItem();
}
