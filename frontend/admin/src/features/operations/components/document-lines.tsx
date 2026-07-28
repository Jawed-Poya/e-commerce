import {
    Barcode,
    Boxes,
    CalendarDays,
    Calculator,
    PackageSearch,
    Plus,
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
    quantity: 1,
    amount: 0,
    lotNumber: "",
    expireDate: null,
});

function quantityError(
    item: DocumentItem,
    mode: "purchase" | "sale",
    translate: (value: string) => string,
) {
    const product = item.product;
    if (!product || item.quantity <= 0) return null;
    if (product.minimumValue != null && item.quantity < product.minimumValue)
        return `${translate("Minimum quantity")}: ${product.minimumValue}.`;
    if (product.maximumValue != null && item.quantity > product.maximumValue)
        return `${translate("Maximum quantity")}: ${product.maximumValue}.`;
    if (mode === "sale" && item.quantity > product.availableQuantity)
        return `${translate("Available quantity")}: ${product.availableQuantity}.`;
    return null;
}

export function DocumentLines({ items, setItems, mode }: DocumentLinesProps) {
    const { formatMoney } = useCompany();
    const { tr } = useI18n();
    const selectedIds = new Set(
        items.map((item) => item.productId).filter(Boolean),
    );

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
        if (
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

        update(index, {
            product,
            productId: product?.id ?? 0,
            quantity: product
                ? Math.max(product.minimumValue ?? 1, 0.001)
                : 1,
            amount:
                mode === "sale" && product?.defaultPrice != null
                    ? product.defaultPrice
                    : product
                      ? items[index]?.amount ?? 0
                      : 0,
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
                        {tr(
                            "Search by product name or barcode, then enter quantity and",
                        )}{" "}
                        {mode === "purchase"
                            ? tr("receiving details.")
                            : tr("selling price.")}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                        setItems((current) => [...current, emptyItem()])
                    }
                >
                    <Plus className="me-2 size-4" />
                    {tr("Add product")}
                </Button>
            </div>

            <div className="space-y-4">
                {items.map((item, index) => {
                    const lineTotal = item.quantity * item.amount;
                    const validation = quantityError(item, mode, tr);
                    return (
                        <Card
                            key={index}
                            className="overflow-hidden border-border/80 shadow-none"
                        >
                            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b bg-muted/25 px-4 py-3">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="secondary">
                                            {tr("Line")} {index + 1}
                                        </Badge>
                                        <p className="truncate text-sm font-medium">
                                            {item.product?.name ?? tr("Choose a product")}
                                        </p>
                                        {item.product?.usesDisplayStock ? (
                                            <Badge variant="outline">{tr("Display stock")}</Badge>
                                        ) : null}
                                    </div>
                                    {item.product ? (
                                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                            <span className="inline-flex items-center gap-1">
                                                <Barcode className="size-3" />
                                                {item.product.barcode ?? tr("No barcode")}
                                            </span>
                                            <span className="inline-flex items-center gap-1">
                                                <Boxes className="size-3" />
                                                {item.product.availableQuantity} {tr("available")}
                                            </span>
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
                                            const products = await operationsService.products(
                                                search,
                                                30,
                                            );
                                            return products.filter(
                                                (product) =>
                                                    (mode === "sale" || !product.usesDisplayStock) &&
                                                    (product.id === item.productId ||
                                                        !selectedIds.has(product.id)),
                                            );
                                        }}
                                        getLabel={(product) => product.name}
                                        getDescription={(product) =>
                                            `${product.barcode ?? tr("No barcode")} · ${tr("Stock")} ${product.availableQuantity}${
                                                product.defaultPrice != null
                                                    ? ` · ${formatMoney(product.defaultPrice)}`
                                                    : ""
                                            }`
                                        }
                                        placeholder={tr("Search product or barcode…")}
                                        emptyText={tr("No available products match your search.")}
                                    />
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                    <LineField label={tr("Quantity")}>
                                        <Input
                                            type="number"
                                            min={item.product?.minimumValue ?? 0.001}
                                            max={
                                                mode === "sale"
                                                    ? Math.min(
                                                          item.product?.maximumValue ??
                                                              Number.MAX_SAFE_INTEGER,
                                                          item.product?.availableQuantity ??
                                                              Number.MAX_SAFE_INTEGER,
                                                      )
                                                    : item.product?.maximumValue ?? undefined
                                            }
                                            step="0.001"
                                            value={item.quantity}
                                            aria-invalid={Boolean(validation)}
                                            onChange={(event) =>
                                                update(index, {
                                                    quantity: Number(event.target.value),
                                                })
                                            }
                                        />
                                        {validation ? (
                                            <p className="text-xs font-medium text-destructive">
                                                {validation}
                                            </p>
                                        ) : null}
                                    </LineField>

                                    <LineField
                                        label={
                                            mode === "purchase"
                                                ? tr("Unit cost")
                                                : tr("Unit price")
                                        }
                                    >
                                        <Input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={item.amount}
                                            onChange={(event) =>
                                                update(index, {
                                                    amount: Number(event.target.value),
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
                                                            lotNumber: event.target.value,
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
                                                        value={item.expireDate ?? ""}
                                                        onChange={(event) =>
                                                            update(index, {
                                                                expireDate:
                                                                    event.target.value || null,
                                                            })
                                                        }
                                                    />
                                                </div>
                                            </LineField>
                                        </>
                                    ) : null}

                                    <div className="rounded-lg border bg-primary/[0.04] p-3">
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
