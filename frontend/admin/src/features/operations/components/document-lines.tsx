import {
    Barcode,
    Boxes,
    CalendarDays,
    Calculator,
    PackageSearch,
    Plus,
    Trash2,
} from "lucide-react";

import { ServerSearchCombobox } from "@/components/server-search-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { operationsService } from "@/features/operations/operations-service";
import type {
    DocumentItem,
    OperationProduct,
} from "@/features/operations/operations-types";
import { useTenant } from "@/features/tenancy/tenant-context";

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

export function DocumentLines({ items, setItems, mode }: DocumentLinesProps) {
    const { formatMoney } = useTenant();
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

    return (
        <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="flex items-center gap-2 font-semibold">
                        <PackageSearch className="size-4 text-primary" />
                        Product lines
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Search by product name or barcode, then enter quantity and
                        {mode === "purchase" ? " receiving details." : " selling price."}
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
                    Add product
                </Button>
            </div>

            <div className="space-y-4">
                {items.map((item, index) => {
                    const lineTotal = item.quantity * item.amount;
                    return (
                        <Card key={index} className="overflow-hidden border-border/80 shadow-none">
                            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b bg-muted/25 px-4 py-3">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="secondary">Line {index + 1}</Badge>
                                        <p className="truncate text-sm font-medium">
                                            {item.product?.name ?? "Choose a product"}
                                        </p>
                                    </div>
                                    {item.product ? (
                                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                            <span className="inline-flex items-center gap-1">
                                                <Barcode className="size-3" />
                                                {item.product.barcode ?? "No barcode"}
                                            </span>
                                            <span className="inline-flex items-center gap-1">
                                                <Boxes className="size-3" />
                                                {item.product.availableQuantity} available
                                            </span>
                                        </div>
                                    ) : null}
                                </div>
                                <Button
                                    type="button"
                                    size="icon-sm"
                                    variant="ghost"
                                    className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    aria-label={`Remove line ${index + 1}`}
                                    onClick={() => remove(index)}
                                >
                                    <Trash2 className="size-4" />
                                </Button>
                            </CardHeader>

                            <CardContent className="space-y-4 p-4">
                                <div className="space-y-2">
                                    <Label>Product</Label>
                                    <ServerSearchCombobox<OperationProduct>
                                        value={item.product ?? null}
                                        onValueChange={(product) =>
                                            update(index, {
                                                product,
                                                productId: product?.id ?? 0,
                                                amount:
                                                    mode === "sale" &&
                                                    product?.defaultPrice != null
                                                        ? product.defaultPrice
                                                        : item.amount,
                                            })
                                        }
                                        queryKey={[
                                            "operations",
                                            "product-search",
                                            mode,
                                            index,
                                        ]}
                                        search={(search) =>
                                            operationsService.products(search, 20)
                                        }
                                        getLabel={(product) => product.name}
                                        getDescription={(product) =>
                                            `${product.barcode ?? "No barcode"} · Stock ${product.availableQuantity}${
                                                product.defaultPrice != null
                                                    ? ` · ${formatMoney(product.defaultPrice)}`
                                                    : ""
                                            }`
                                        }
                                        placeholder="Search product or barcode…"
                                        allowClear={false}
                                    />
                                </div>

                                <div
                                    className={
                                        mode === "purchase"
                                            ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(110px,.75fr)_minmax(130px,.9fr)_minmax(130px,1fr)_minmax(155px,1fr)_minmax(150px,1fr)]"
                                            : "grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(120px,.8fr)_minmax(150px,1fr)_minmax(180px,1fr)]"
                                    }
                                >
                                    <LineField label="Quantity">
                                        <Input
                                            type="number"
                                            min={0.01}
                                            step="0.01"
                                            value={item.quantity}
                                            onChange={(event) =>
                                                update(index, {
                                                    quantity: Number(event.target.value),
                                                })
                                            }
                                        />
                                    </LineField>
                                    <LineField
                                        label={
                                            mode === "purchase"
                                                ? "Unit cost"
                                                : "Unit price"
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
                                            <LineField label="Lot number">
                                                <Input
                                                    value={item.lotNumber ?? ""}
                                                    onChange={(event) =>
                                                        update(index, {
                                                            lotNumber: event.target.value,
                                                        })
                                                    }
                                                    placeholder="Optional"
                                                />
                                            </LineField>
                                            <LineField label="Expiry date">
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
                                            Line total
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
