import { Plus, Trash2 } from "lucide-react";

import { ServerSearchCombobox } from "@/components/server-search-combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { operationsService } from "@/features/operations/operations-service";
import type { DocumentItem, OperationProduct } from "@/features/operations/operations-types";

interface DocumentLinesProps {
    items: DocumentItem[];
    setItems: React.Dispatch<React.SetStateAction<DocumentItem[]>>;
    mode: "purchase" | "sale";
}

const emptyItem = (): DocumentItem => ({ productId: 0, product: null, quantity: 1, amount: 0, lotNumber: "", expireDate: null });

export function DocumentLines({ items, setItems, mode }: DocumentLinesProps) {
    const update = (index: number, patch: Partial<DocumentItem>) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
    const remove = (index: number) => setItems((current) => current.length === 1 ? [emptyItem()] : current.filter((_, itemIndex) => itemIndex !== index));

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold">Products</h3>
                    <p className="text-xs text-muted-foreground">Search the server by product name or barcode.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setItems((current) => [...current, emptyItem()])}>
                    <Plus className="me-2 size-4" />Add line
                </Button>
            </div>
            {items.map((item, index) => (
                <Card key={index}>
                    <CardContent className="grid gap-4 p-4 md:grid-cols-12 md:items-end">
                        <div className="space-y-2 md:col-span-5">
                            <Label>Product</Label>
                            <ServerSearchCombobox<OperationProduct>
                                value={item.product ?? null}
                                onValueChange={(product) => update(index, { product, productId: product?.id ?? 0, amount: mode === "sale" && product?.defaultPrice != null ? product.defaultPrice : item.amount })}
                                queryKey={["operations", "product-search", mode, index]}
                                search={(search) => operationsService.products(search, 20)}
                                getLabel={(product) => product.name}
                                getDescription={(product) => `${product.barcode ?? "No barcode"} · Stock ${product.availableQuantity}${product.defaultPrice != null ? ` · ${money(product.defaultPrice)}` : ""}`}
                                placeholder="Search product or barcode…"
                                allowClear={false}
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>Quantity</Label>
                            <Input type="number" min={0.01} step="0.01" value={item.quantity} onChange={(event) => update(index, { quantity: Number(event.target.value) })} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>{mode === "purchase" ? "Unit cost" : "Unit price"}</Label>
                            <Input type="number" min={0} step="0.01" value={item.amount} onChange={(event) => update(index, { amount: Number(event.target.value) })} />
                        </div>
                        {mode === "purchase" ? <>
                            <div className="space-y-2 md:col-span-2"><Label>Lot</Label><Input value={item.lotNumber ?? ""} onChange={(event) => update(index, { lotNumber: event.target.value })} /></div>
                            <div className="space-y-2 md:col-span-3"><Label>Expiry</Label><Input type="date" value={item.expireDate ?? ""} onChange={(event) => update(index, { expireDate: event.target.value || null })} /></div>
                        </> : null}
                        <div className={mode === "purchase" ? "md:col-span-3" : "md:col-span-2"}>
                            <p className="text-xs text-muted-foreground">Line total</p>
                            <p className="mt-2 font-semibold">{money(item.quantity * item.amount)}</p>
                        </div>
                        <div className="flex justify-end md:col-span-1">
                            <Button size="icon" variant="ghost" aria-label="Remove line" onClick={() => remove(index)}><Trash2 className="size-4" /></Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

export function newDocumentItem(): DocumentItem { return emptyItem(); }
function money(value: number) { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value); }
