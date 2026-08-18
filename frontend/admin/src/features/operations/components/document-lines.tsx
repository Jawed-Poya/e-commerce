import {
    AlertCircle,
    Barcode,
    Boxes,
    CalendarDays,
    Calculator,
    CheckCircle2,
    CircleDashed,
    PackageSearch,
    Plus,
    Scale,
    ShieldCheck,
    Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import { ServerSearchCombobox } from "@/components/server-search-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompany } from "@/features/company/company-context";
import {
    createEmptyDocumentItem,
    getDocumentLineState,
    isDocumentLineComplete,
    isDocumentLineEmpty,
} from "@/features/operations/document-line-state";
import { operationsService } from "@/features/operations/operations-service";
import type {
    DocumentItem,
    OperationProduct,
    OperationProductUnit,
} from "@/features/operations/operations-types";
import { useI18n } from "@/i18n/i18n-provider";
import { cn } from "@/lib/utils";
import { toFiniteNumber } from "@/lib/numbers";

interface DocumentLinesProps {
    items: DocumentItem[];
    setItems: React.Dispatch<React.SetStateAction<DocumentItem[]>>;
    mode: "purchase" | "sale";
    maximumLines: number;
    canOverrideLineLimit: boolean;
    overrideLineLimit: boolean;
    onOverrideLineLimitChange: (enabled: boolean) => void;
    allowNegativeStock?: boolean;
}

const emptyItem = createEmptyDocumentItem;

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

function selectedBounds(item: DocumentItem, mode: "purchase" | "sale", allowNegativeStock = false) {
    if (mode === "purchase") {
        return {
            minimum: 0.001,
            maximum: Number.POSITIVE_INFINITY,
        };
    }

    const product = item.product;
    const unit = currentUnit(item);
    return {
        minimum: 0.001,
        maximum: allowNegativeStock
            ? Number.POSITIVE_INFINITY
            :
            unit?.availableQuantity ??
            product?.availableQuantity ??
            Number.MAX_SAFE_INTEGER,
    };
}

function quantityError(
    item: DocumentItem,
    mode: "purchase" | "sale",
    translate: (value: string) => string,
    allowNegativeStock = false,
) {
    const product = item.product;
    const unit = currentUnit(item);
    if (!product || !unit || item.quantity <= 0) return null;

    const bounds = selectedBounds(item, mode, allowNegativeStock);
    if (item.quantity < bounds.minimum) {
        return `${translate("Minimum quantity")}: ${toFiniteNumber(bounds.minimum).toLocaleString(undefined, { maximumFractionDigits: 3 })} ${unit.unitName}.`;
    }

    if (item.quantity > bounds.maximum) {
        const label =
            mode === "sale" && bounds.maximum === unit.availableQuantity
                ? translate("Available quantity")
                : translate("Maximum quantity");
        return `${label}: ${toFiniteNumber(bounds.maximum).toLocaleString(undefined, { maximumFractionDigits: 3 })} ${unit.unitName}.`;
    }

    return null;
}

export function DocumentLines({
    items,
    setItems,
    mode,
    maximumLines,
    canOverrideLineLimit,
    overrideLineLimit,
    onOverrideLineLimitChange,
    allowNegativeStock = false,
}: DocumentLinesProps) {
    const { formatMoney } = useCompany();
    const { tr } = useI18n();
    const linesContainerRef = useRef<HTMLDivElement>(null);
    const minimumExpiryDate = new Date().toISOString().slice(0, 10);
    const pendingScrollIndexRef = useRef<number | null>(null);
    const selectedIds = new Set(
        mode === "sale"
            ? items.map((item) => item.productId).filter(Boolean)
            : [],
    );
    const safeMaximumLines = Math.max(1, Math.min(maximumLines || 1, 500));
    const overrideActive = canOverrideLineLimit && overrideLineLimit;
    const effectiveMaximumLines = overrideActive ? 500 : safeMaximumLines;
    const atLineLimit = items.length >= effectiveMaximumLines;

    const summary = useMemo(() => {
        const ready = items.filter(
            (item) =>
                isDocumentLineComplete(item) &&
                !quantityError(item, mode, tr, allowNegativeStock),
        ).length;
        const empty = items.filter(isDocumentLineEmpty).length;
        return {
            ready,
            empty,
            incomplete: Math.max(0, items.length - ready - empty),
            total: items.reduce(
                (sum, item) => sum + stackedLineTotal(item),
                0,
            ),
        };
    }, [allowNegativeStock, items, mode, tr]);

    useEffect(() => {
        const index = pendingScrollIndexRef.current;
        if (index == null) return;

        pendingScrollIndexRef.current = null;
        window.requestAnimationFrame(() => {
            linesContainerRef.current
                ?.querySelector<HTMLElement>(`[data-document-line="${index}"]`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
    }, [items.length]);

    const update = (index: number, patch: Partial<DocumentItem>) =>
        setItems((current) =>
            current.map((item, itemIndex) =>
                itemIndex === index ? { ...item, ...patch } : item,
            ),
        );

    const add = () => {
        if (atLineLimit) {
            toast.error(
                canOverrideLineLimit
                    ? tr("A document cannot contain more than 500 product lines.")
                    : `${tr("The configured product-line limit is")} ${safeMaximumLines}.`,
            );
            return;
        }

        setItems((current) => {
            pendingScrollIndexRef.current = current.length;
            return [...current, emptyItem()];
        });
    };

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
        if (
            mode === "sale" &&
            product &&
            product.id !== currentProductId &&
            selectedIds.has(product.id)
        ) {
            toast.error(
                tr(
                    "A product can be selected only once. Update the existing line quantity instead.",
                ),
            );
            return;
        }

        if (!product) {
            update(index, emptyItem());
            return;
        }

        const unit = defaultUnit(product);
        const initialQuantity = 1;
        update(index, {
            product,
            productId: product.id,
            unitId: unit.unitId || null,
            unitName: unit.unitName,
            conversionFactor: unit.conversionFactor,
            quantity: initialQuantity,
            amount: mode === "sale" ? unit.defaultPrice ?? 0 : 0,
        });
    };

    const selectUnit = (index: number, unit: OperationProductUnit) => {
        const product = items[index]?.product;
        if (!product) return;

        const initialQuantity = 1;
        update(index, {
            unitId: unit.unitId || null,
            unitName: unit.unitName,
            conversionFactor: unit.conversionFactor,
            quantity: initialQuantity,
            amount: mode === "sale" ? unit.defaultPrice ?? 0 : 0,
        });
    };

    return (
        <section className="relative space-y-4">
            <div className="sticky top-0 z-30 -mx-1 rounded-xl border border-border/80 bg-background/95 px-3 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:px-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="flex items-center gap-2 font-semibold">
                                <PackageSearch className="size-4 text-primary" />
                                {tr("Product lines")}
                            </h3>
                            <Badge variant="secondary">
                                {items.length} {tr("lines")}
                            </Badge>
                            <Badge variant={atLineLimit ? "destructive" : "outline"}>
                                {items.length}/{effectiveMaximumLines} {tr(overrideActive ? "safety limit" : "line limit")}
                            </Badge>
                            {summary.ready > 0 ? (
                                <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                                    {summary.ready} {tr("ready")}
                                </Badge>
                            ) : null}
                            {summary.empty > 0 ? (
                                <Badge variant="outline">
                                    {summary.empty} {tr("empty")}
                                </Badge>
                            ) : null}
                            {summary.incomplete > 0 ? (
                                <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                                    {summary.incomplete} {tr("incomplete")}
                                </Badge>
                            ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {tr(
                                "Search by product name or barcode, select the selling unit, then enter quantity and",
                            )}{" "}
                            {mode === "purchase"
                                ? tr("receiving details.")
                                : tr("selling price.")}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {overrideActive
                                ? tr("Override active. This document can contain up to 500 product lines.")
                                : canOverrideLineLimit
                                    ? `${tr("Configured maximum")}: ${safeMaximumLines} ${tr("lines")}. ${tr("Override access is available when business operations require it.")}`
                                    : `${tr("Configured maximum")}: ${safeMaximumLines} ${tr("lines")}.`}
                        </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                        {canOverrideLineLimit ? (
                            <Button
                                type="button"
                                size="sm"
                                variant={overrideActive ? "outline" : "secondary"}
                                aria-pressed={overrideActive}
                                disabled={overrideActive && items.length > safeMaximumLines}
                                onClick={() => onOverrideLineLimitChange(!overrideActive)}
                            >
                                <ShieldCheck className="me-1 size-4" />
                                {tr(
                                    overrideActive
                                        ? items.length > safeMaximumLines
                                            ? "Override active"
                                            : "Use configured limit"
                                        : "Override line limit",
                                )}
                            </Button>
                        ) : null}
                        <div className="text-end">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                {tr("Lines total")}
                            </p>
                            <p className="font-semibold tabular-nums">
                                {formatMoney(summary.total)}
                            </p>
                        </div>
                        <Button
                            type="button"
                            size="lg"
                            className="min-w-32 shadow-sm"
                            onClick={add}
                            disabled={atLineLimit}
                        >
                            <Plus className="me-1 size-4" />
                            {tr("Add product")}
                        </Button>
                    </div>
                </div>
            </div>

            <div ref={linesContainerRef} className="space-y-4">
                {items.map((item, index) => {
                    const lineTotal = stackedLineTotal(item);
                    const validation = quantityError(item, mode, tr, allowNegativeStock);
                    const baseState = getDocumentLineState(item);
                    const lineState = validation ? "incomplete" : baseState;
                    const unit = currentUnit(item);
                    const units = item.product?.units.length
                        ? item.product.units
                        : item.product
                          ? [fallbackUnit(item.product)]
                          : [];
                    const bounds = selectedBounds(item, mode, allowNegativeStock);

                    return (
                        <Card
                            key={index}
                            data-document-line={index}
                            className={cn(
                                "scroll-mt-24 overflow-hidden border-border/80 bg-card shadow-none transition-colors dark:border-white/10",
                                lineState === "empty" &&
                                    "border-dashed bg-muted/[0.12]",
                                lineState === "incomplete" &&
                                    "border-amber-500/35",
                                lineState === "ready" &&
                                    "border-primary/20",
                            )}
                        >
                            <CardHeader
                                className={cn(
                                    "flex flex-row items-center justify-between gap-3 border-b border-border/70 bg-muted/25 px-4 py-3 dark:border-white/10",
                                    lineState === "empty" && "bg-muted/15",
                                    lineState === "incomplete" &&
                                        "bg-amber-500/[0.045]",
                                    lineState === "ready" &&
                                        "bg-primary/[0.035]",
                                )}
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="secondary">
                                            {tr("Line")} {index + 1}
                                        </Badge>
                                        <LineStateBadge state={lineState} tr={tr} />
                                        <p className="min-w-0 flex-1 truncate text-sm font-medium">
                                            {item.product?.name ??
                                                tr("Choose a product")}
                                        </p>
                                        {item.product?.usesDisplayStock ? (
                                            <Badge variant="outline">
                                                {tr("Display stock")}
                                            </Badge>
                                        ) : null}
                                        {unit ? (
                                            <Badge
                                                variant="outline"
                                                className="border-primary/25 bg-primary/5 text-primary"
                                            >
                                                {unit.unitName}
                                            </Badge>
                                        ) : null}
                                    </div>
                                    {item.product ? (
                                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                            <span className="inline-flex items-center gap-1">
                                                <Barcode className="size-3" />
                                                {unit?.barcode ??
                                                    item.product.barcode ??
                                                    tr("No barcode")}
                                            </span>
                                            <span className="inline-flex items-center gap-1">
                                                <Boxes className="size-3" />
                                                {unit?.availableQuantity ??
                                                    item.product
                                                        .availableQuantity}{" "}
                                                {unit?.unitName ?? tr("available")}
                                            </span>
                                            {unit && unit.conversionFactor !== 1 ? (
                                                <span className="inline-flex items-center gap-1">
                                                    <Scale className="size-3" />1{" "}
                                                    {unit.unitName} ={" "}
                                                    {unit.conversionFactor}{" "}
                                                    {item.product.baseUnitName ??
                                                        tr("base units")}
                                                </span>
                                            ) : null}
                                            {item.product.genericName ? <span>{tr("Generic")}: {item.product.genericName}</span> : null}
                                            {item.product.formula ? <span>{tr("Formula")}: {item.product.formula}</span> : null}
                                        </div>
                                    ) : (
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {tr(
                                                "This line is empty and will be ignored until a product is selected.",
                                            )}
                                        </p>
                                    )}
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                    <div className="hidden text-end sm:block">
                                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                            {tr("Line total")}
                                        </p>
                                        <p className="text-sm font-semibold tabular-nums">
                                            {formatMoney(lineTotal)}
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        size="icon-sm"
                                        variant="ghost"
                                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                        aria-label={`${tr("Remove line")} ${index + 1}`}
                                        onClick={() => remove(index)}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-4 p-4">
                                <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2 sm:hidden">
                                    <span className="text-xs font-medium text-muted-foreground">
                                        {tr("Line total")}
                                    </span>
                                    <span className="font-semibold tabular-nums">
                                        {formatMoney(lineTotal)}
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    <Label>{tr("Product")}</Label>
                                    <ServerSearchCombobox<OperationProduct>
                                        value={item.product ?? null}
                                        onValueChange={(product) =>
                                            selectProduct(
                                                index,
                                                item.productId,
                                                product,
                                            )
                                        }
                                        queryKey={[
                                            "operations",
                                            "product-search",
                                            mode,
                                            index,
                                            ...Array.from(selectedIds).sort(),
                                        ]}
                                        search={async (search) => {
                                            const products =
                                                await operationsService.products(
                                                    search,
                                                    30,
                                                    mode === "sale",
                                                );
                                            return products.filter(
                                                (product) =>
                                                    (mode === "sale" ||
                                                        !product.usesDisplayStock) &&
                                                    (product.id ===
                                                        item.productId ||
                                                        !selectedIds.has(
                                                            product.id,
                                                        )),
                                            );
                                        }}
                                        getLabel={(product) => [product.name, product.strength, product.genericName].filter(Boolean).join(" — ")}
                                        getDescription={(product) => {
                                            const defaultSellingUnit =
                                                defaultUnit(product);
                                            return `${defaultSellingUnit.barcode ?? product.barcode ?? tr("No barcode")} · ${tr("Stock")} ${defaultSellingUnit.availableQuantity} ${defaultSellingUnit.unitName}${defaultSellingUnit.defaultPrice != null ? ` · ${formatMoney(defaultSellingUnit.defaultPrice)}` : ""}`;
                                        }}
                                        placeholder={tr(
                                            "Search product or barcode…",
                                        )}
                                        emptyText={tr(
                                            "No available products match your search.",
                                        )}
                                    />
                                </div>

                                {units.length > 1 ? (
                                    <div className="space-y-2">
                                        <Label>
                                            {mode === "purchase"
                                                ? tr("Receiving unit")
                                                : tr("Selling unit")}
                                        </Label>
                                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                            {units.map((option) => {
                                                const active =
                                                    option.unitId === unit?.unitId;
                                                return (
                                                    <button
                                                        key={option.unitId}
                                                        type="button"
                                                        onClick={() =>
                                                            selectUnit(
                                                                index,
                                                                option,
                                                            )
                                                        }
                                                        className={cn(
                                                            "rounded-xl border p-3 text-start transition",
                                                            active
                                                                ? "border-primary bg-primary/8 ring-2 ring-primary/10"
                                                                : "border-border/80 bg-background hover:border-primary/40 hover:bg-muted/40 dark:border-white/10",
                                                        )}
                                                    >
                                                        <span className="block text-sm font-semibold">
                                                            {option.unitName}
                                                        </span>
                                                        <span className="mt-1 block text-xs text-muted-foreground">
                                                            1 ={" "}
                                                            {
                                                                option.conversionFactor
                                                            }{" "}
                                                            {item.product
                                                                ?.baseUnitName ??
                                                                tr("base units")}
                                                        </span>
                                                        {mode === "sale" ? (
                                                            <span className="mt-2 block text-xs font-medium text-primary">
                                                                {option.defaultPrice !=
                                                                null
                                                                    ? formatMoney(
                                                                          option.defaultPrice,
                                                                      )
                                                                    : tr(
                                                                          "Set price",
                                                                      )}
                                                            </span>
                                                        ) : null}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : null}

                                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                    <LineField
                                        label={`${tr("Quantity")} · ${unit?.unitName ?? tr("Unit")}`}
                                    >
                                        <Input
                                            type="number"
                                            min={bounds.minimum}
                                            max={
                                                Number.isFinite(bounds.maximum)
                                                    ? bounds.maximum
                                                    : undefined
                                            }
                                            step="0.001"
                                            value={item.quantity}
                                            aria-invalid={Boolean(validation)}
                                            onChange={(event) =>
                                                update(index, {
                                                    quantity: Number(
                                                        event.target.value,
                                                    ),
                                                })
                                            }
                                        />
                                        {validation ? (
                                            <p className="text-xs font-medium text-destructive">
                                                {validation}
                                            </p>
                                        ) : null}
                                    </LineField>

                                    <LineField label={tr("Bonus quantity")}>
                                        <Input
                                            type="number"
                                            min={0}
                                            step="0.001"
                                            value={item.bonusQuantity}
                                            onChange={(event) => update(index, { bonusQuantity: Number(event.target.value) })}
                                        />
                                    </LineField>

                                    <LineField label={tr("Discount %")}>
                                        <Input
                                            type="number"
                                            min={0}
                                            max={100}
                                            step="0.01"
                                            value={item.discountPercent}
                                            onChange={(event) => update(index, { discountPercent: Number(event.target.value) })}
                                        />
                                    </LineField>

                                    <LineField label={tr("Second discount %")}>
                                        <Input
                                            type="number"
                                            min={0}
                                            max={100}
                                            step="0.01"
                                            value={item.secondaryDiscountPercent}
                                            onChange={(event) => update(index, { secondaryDiscountPercent: Number(event.target.value) })}
                                        />
                                    </LineField>

                                    <LineField
                                        label={`${mode === "purchase" ? tr("Unit cost") : tr("Unit price")} · ${unit?.unitName ?? tr("Unit")}`}
                                    >
                                        <Input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={item.amount}
                                            onChange={(event) =>
                                                update(index, {
                                                    amount: Number(
                                                        event.target.value,
                                                    ),
                                                })
                                            }
                                        />
                                    </LineField>

                                    {mode === "purchase" ? (
                                        <>
                                            <LineField label={tr("Lot number")}>
                                                <Input
                                                    value={item.lotNumber ?? ""}
                                                    onChange={(event) =>
                                                        update(index, {
                                                            lotNumber:
                                                                event.target
                                                                    .value,
                                                        })
                                                    }
                                                    placeholder={tr("Optional")}
                                                />
                                            </LineField>
                                            <LineField label={tr("Expiry date")}>
                                                <div className="relative">
                                                    <CalendarDays className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                                    <Input
                                                        className="ps-9"
                                                        type="date"
                                                        min={minimumExpiryDate}
                                                        value={
                                                            item.expireDate ?? ""
                                                        }
                                                        onChange={(event) =>
                                                            update(index, {
                                                                expireDate:
                                                                    event.target
                                                                        .value ||
                                                                    null,
                                                            })
                                                        }
                                                    />
                                                </div>
                                            </LineField>
                                        </>
                                    ) : null}

                                    <div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-3 dark:border-primary/25">
                                        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                            <Calculator className="size-3.5" />
                                            {tr("Line total")}
                                        </p>
                                        <p className="mt-2 text-lg font-semibold tabular-nums text-foreground">
                                            {formatMoney(lineTotal)}
                                        </p>
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

function stackedLineTotal(item: DocumentItem) {
    const gross = item.quantity * item.amount;
    const first = gross * (1 - Math.min(100, Math.max(0, item.discountPercent)) / 100);
    return first * (1 - Math.min(100, Math.max(0, item.secondaryDiscountPercent)) / 100);
}

function LineStateBadge({
    state,
    tr,
}: {
    state: "empty" | "incomplete" | "ready";
    tr: (value: string) => string;
}) {
    if (state === "ready") {
        return (
            <Badge className="gap-1 border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-3" />
                {tr("Ready")}
            </Badge>
        );
    }

    if (state === "incomplete") {
        return (
            <Badge className="gap-1 border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                <AlertCircle className="size-3" />
                {tr("Incomplete")}
            </Badge>
        );
    }

    return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
            <CircleDashed className="size-3" />
            {tr("Empty line")}
        </Badge>
    );
}

function LineField({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            {children}
        </div>
    );
}

export function newDocumentItem(): DocumentItem {
    return emptyItem();
}
