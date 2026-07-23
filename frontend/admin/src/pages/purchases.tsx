import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    LoaderCircle,
    PackagePlus,
    Pencil,
    Plus,
    Save,
    Trash2,
    Truck,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAuth } from "@/features/auth/auth-context";
import { hasPermission, Permissions } from "@/features/auth/permissions";
import {
    operationKeys,
    useOperationQuery,
} from "@/features/operations/operations-hooks";
import { operationsService } from "@/features/operations/operations-service";
import type {
    DocumentItem,
    OperationProduct,
    Supplier,
} from "@/features/operations/operations-types";

const today = () => new Date().toISOString().slice(0, 10);
const newItem = (): DocumentItem => ({
    productId: 0,
    quantity: 1,
    amount: 0,
    lotNumber: "",
    expireDate: null,
});
const emptySupplier = () => ({
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    taxNumber: "",
    isActive: true,
});

export default function PurchasesPage() {
    const queryClient = useQueryClient();
    const { user } = useAdminAuth();
    const canManage = hasPermission(user, Permissions.PurchasesManage);
    const { data: purchases, isLoading } = useOperationQuery(
        operationKeys.purchases,
        operationsService.purchases,
    );
    const { data: products } = useOperationQuery(
        operationKeys.products,
        operationsService.products,
    );
    const { data: suppliers, isLoading: suppliersLoading } = useOperationQuery(
        operationKeys.suppliers,
        operationsService.suppliers,
    );
    const [tab, setTab] = useState<"purchases" | "suppliers">("purchases");
    const [purchaseOpen, setPurchaseOpen] = useState(false);
    const [supplierOpen, setSupplierOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [saving, setSaving] = useState(false);
    const [items, setItems] = useState<DocumentItem[]>([newItem()]);
    const [form, setForm] = useState({
        supplierId: 0,
        purchaseDate: today(),
        discount: 0,
        tax: 0,
        otherCost: 0,
        paidAmount: 0,
        referenceNumber: "",
        notes: "",
    });
    const [supplier, setSupplier] = useState(emptySupplier);

    const subtotal = useMemo(
        () => items.reduce((sum, item) => sum + item.quantity * item.amount, 0),
        [items],
    );
    const total = Math.max(
        0,
        subtotal - form.discount + form.tax + form.otherCost,
    );

    const openSupplier = (item?: Supplier) => {
        setEditingSupplier(item ?? null);
        setSupplier(
            item
                ? {
                      name: item.name,
                      contactPerson: item.contactPerson ?? "",
                      phone: item.phone ?? "",
                      email: item.email ?? "",
                      address: item.address ?? "",
                      taxNumber: item.taxNumber ?? "",
                      isActive: item.isActive,
                  }
                : emptySupplier(),
        );
        setSupplierOpen(true);
    };

    const submit = async () => {
        if (!canManage) return;
        if (items.some((item) => !item.productId || item.quantity <= 0 || item.amount < 0)) {
            toast.error("Complete every purchase line.");
            return;
        }
        if (form.paidAmount < 0 || form.paidAmount > total) {
            toast.error("Paid amount must be between zero and the purchase total.");
            return;
        }

        setSaving(true);
        try {
            await operationsService.createPurchase({
                ...form,
                supplierId: form.supplierId || null,
                items: items.map((item) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    unitCost: item.amount,
                    lotNumber: item.lotNumber || null,
                    expireDate: item.expireDate || null,
                })),
            });
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: operationKeys.purchases }),
                queryClient.invalidateQueries({ queryKey: ["inventory"] }),
                queryClient.invalidateQueries({ queryKey: operationKeys.summary }),
                queryClient.invalidateQueries({ queryKey: operationKeys.products }),
            ]);
            toast.success("Purchase received and stock updated.");
            setPurchaseOpen(false);
            setItems([newItem()]);
            setForm({
                supplierId: 0,
                purchaseDate: today(),
                discount: 0,
                tax: 0,
                otherCost: 0,
                paidAmount: 0,
                referenceNumber: "",
                notes: "",
            });
        } catch (error) {
            toast.error(message(error));
        } finally {
            setSaving(false);
        }
    };

    const saveSupplier = async () => {
        if (!canManage) return;
        if (!supplier.name.trim()) {
            toast.error("Supplier name is required.");
            return;
        }

        setSaving(true);
        try {
            await operationsService.saveSupplier(editingSupplier?.id ?? null, {
                name: supplier.name.trim(),
                contactPerson: nullable(supplier.contactPerson),
                phone: nullable(supplier.phone),
                email: nullable(supplier.email),
                address: nullable(supplier.address),
                taxNumber: nullable(supplier.taxNumber),
                isActive: supplier.isActive,
            });
            await queryClient.invalidateQueries({ queryKey: operationKeys.suppliers });
            toast.success(editingSupplier ? "Supplier updated." : "Supplier created.");
            setSupplierOpen(false);
        } catch (error) {
            toast.error(message(error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Purchases"
                description="Receive products from suppliers and increase stock with a complete cost and lot record."
                actions={
                    canManage ? (
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => openSupplier()}>
                                <Truck className="me-2 size-4" />
                                New supplier
                            </Button>
                            <Button onClick={() => setPurchaseOpen(true)}>
                                <PackagePlus className="me-2 size-4" />
                                New purchase
                            </Button>
                        </div>
                    ) : undefined
                }
            />

            <div className="inline-flex rounded-lg border bg-muted/40 p-1">
                <Button
                    size="sm"
                    variant={tab === "purchases" ? "default" : "ghost"}
                    onClick={() => setTab("purchases")}
                >
                    <PackagePlus className="me-2 size-4" />
                    Purchases
                </Button>
                <Button
                    size="sm"
                    variant={tab === "suppliers" ? "default" : "ghost"}
                    onClick={() => setTab("suppliers")}
                >
                    <Truck className="me-2 size-4" />
                    Suppliers
                </Button>
            </div>

            {tab === "purchases" ? (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Purchase</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Items</TableHead>
                                    <TableHead className="text-end">Total</TableHead>
                                    <TableHead className="text-end">Paid</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <Loading colSpan={7} />
                                ) : purchases?.length ? (
                                    purchases.map((purchase) => (
                                        <TableRow key={purchase.id}>
                                            <TableCell className="font-medium">
                                                {purchase.purchaseNumber}
                                            </TableCell>
                                            <TableCell>{date(purchase.purchaseDate)}</TableCell>
                                            <TableCell>
                                                {purchase.supplierName ?? "Direct purchase"}
                                            </TableCell>
                                            <TableCell>{purchase.itemCount}</TableCell>
                                            <TableCell className="text-end">
                                                {money(purchase.total)}
                                            </TableCell>
                                            <TableCell className="text-end">
                                                {money(purchase.paidAmount)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        purchase.paymentStatus === "Paid"
                                                            ? "default"
                                                            : "outline"
                                                    }
                                                >
                                                    {purchase.paymentStatus}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <Empty
                                        colSpan={7}
                                        text="No purchases have been recorded."
                                    />
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Contact</TableHead>
                                    <TableHead>Phone / email</TableHead>
                                    <TableHead>Tax number</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-20" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {suppliersLoading ? (
                                    <Loading colSpan={6} />
                                ) : suppliers?.length ? (
                                    suppliers.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <p className="font-medium">{item.name}</p>
                                                <p className="max-w-xs truncate text-xs text-muted-foreground">
                                                    {item.address ?? "No address"}
                                                </p>
                                            </TableCell>
                                            <TableCell>{item.contactPerson ?? "—"}</TableCell>
                                            <TableCell>
                                                <p>{item.phone ?? "—"}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {item.email ?? ""}
                                                </p>
                                            </TableCell>
                                            <TableCell>{item.taxNumber ?? "—"}</TableCell>
                                            <TableCell>
                                                <Badge variant={item.isActive ? "default" : "outline"}>
                                                    {item.isActive ? "Active" : "Inactive"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {canManage && (
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        aria-label={`Edit ${item.name}`}
                                                        onClick={() => openSupplier(item)}
                                                    >
                                                        <Pencil className="size-4" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <Empty colSpan={6} text="No suppliers have been added." />
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            <Dialog open={purchaseOpen} onOpenChange={setPurchaseOpen}>
                <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-6xl">
                    <DialogHeader>
                        <DialogTitle>Receive purchase</DialogTitle>
                        <DialogDescription>
                            Stock and inventory lots are increased only after the complete
                            document is saved.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 md:grid-cols-3">
                        <Field label="Supplier">
                            <select
                                className="h-9 w-full rounded-md border bg-background px-3"
                                value={form.supplierId}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        supplierId: Number(event.target.value),
                                    }))
                                }
                            >
                                <option value={0}>Direct / no supplier</option>
                                {suppliers
                                    ?.filter((item) => item.isActive)
                                    .map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                        </option>
                                    ))}
                            </select>
                        </Field>
                        <Field label="Purchase date">
                            <Input
                                type="date"
                                value={form.purchaseDate}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        purchaseDate: event.target.value,
                                    }))
                                }
                            />
                        </Field>
                        <Field label="Supplier reference">
                            <Input
                                value={form.referenceNumber}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        referenceNumber: event.target.value,
                                    }))
                                }
                            />
                        </Field>
                    </div>
                    <DocumentLines
                        items={items}
                        setItems={setItems}
                        products={products ?? []}
                        purchase
                    />
                    <div className="grid gap-4 md:grid-cols-[1fr_360px]">
                        <Field label="Notes">
                            <Textarea
                                rows={5}
                                value={form.notes}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        notes: event.target.value,
                                    }))
                                }
                            />
                        </Field>
                        <Card>
                            <CardContent className="space-y-3 p-4">
                                <MoneyRow label="Subtotal" value={subtotal} />
                                <NumberField
                                    label="Discount"
                                    value={form.discount}
                                    set={(value) =>
                                        setForm((current) => ({ ...current, discount: value }))
                                    }
                                />
                                <NumberField
                                    label="Tax"
                                    value={form.tax}
                                    set={(value) =>
                                        setForm((current) => ({ ...current, tax: value }))
                                    }
                                />
                                <NumberField
                                    label="Other cost"
                                    value={form.otherCost}
                                    set={(value) =>
                                        setForm((current) => ({ ...current, otherCost: value }))
                                    }
                                />
                                <div className="border-t pt-3">
                                    <MoneyRow label="Purchase total" value={total} strong />
                                </div>
                                <NumberField
                                    label="Paid amount"
                                    value={form.paidAmount}
                                    set={(value) =>
                                        setForm((current) => ({ ...current, paidAmount: value }))
                                    }
                                />
                            </CardContent>
                        </Card>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPurchaseOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={submit} disabled={saving}>
                            {saving ? (
                                <LoaderCircle className="me-2 size-4 animate-spin" />
                            ) : (
                                <Save className="me-2 size-4" />
                            )}
                            Receive purchase
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingSupplier ? "Edit supplier" : "New supplier"}
                        </DialogTitle>
                        <DialogDescription>
                            Reusable supplier details for purchase documents.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Supplier name *">
                            <Input
                                value={supplier.name}
                                onChange={(event) =>
                                    setSupplier((current) => ({
                                        ...current,
                                        name: event.target.value,
                                    }))
                                }
                            />
                        </Field>
                        <Field label="Contact person">
                            <Input
                                value={supplier.contactPerson}
                                onChange={(event) =>
                                    setSupplier((current) => ({
                                        ...current,
                                        contactPerson: event.target.value,
                                    }))
                                }
                            />
                        </Field>
                        <Field label="Phone">
                            <Input
                                value={supplier.phone}
                                onChange={(event) =>
                                    setSupplier((current) => ({
                                        ...current,
                                        phone: event.target.value,
                                    }))
                                }
                            />
                        </Field>
                        <Field label="Email">
                            <Input
                                type="email"
                                value={supplier.email}
                                onChange={(event) =>
                                    setSupplier((current) => ({
                                        ...current,
                                        email: event.target.value,
                                    }))
                                }
                            />
                        </Field>
                        <Field label="Tax number">
                            <Input
                                value={supplier.taxNumber}
                                onChange={(event) =>
                                    setSupplier((current) => ({
                                        ...current,
                                        taxNumber: event.target.value,
                                    }))
                                }
                            />
                        </Field>
                        <div className="sm:col-span-2">
                            <Field label="Address">
                                <Textarea
                                    value={supplier.address}
                                    onChange={(event) =>
                                        setSupplier((current) => ({
                                            ...current,
                                            address: event.target.value,
                                        }))
                                    }
                                />
                            </Field>
                        </div>
                        <label className="flex items-center gap-3 sm:col-span-2">
                            <Checkbox
                                checked={supplier.isActive}
                                onCheckedChange={(checked) =>
                                    setSupplier((current) => ({
                                        ...current,
                                        isActive: checked === true,
                                    }))
                                }
                            />
                            Active supplier
                        </label>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSupplierOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={saveSupplier} disabled={saving}>
                            <Save className="me-2 size-4" />
                            Save supplier
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export function DocumentLines({
    items,
    setItems,
    products,
    purchase = false,
}: {
    items: DocumentItem[];
    setItems: React.Dispatch<React.SetStateAction<DocumentItem[]>>;
    products: OperationProduct[];
    purchase?: boolean;
}) {
    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">Products</CardTitle>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setItems((rows) => [...rows, newItem()])}
                >
                    <Plus className="me-2 size-4" />
                    Add line
                </Button>
            </CardHeader>
            <CardContent className="space-y-3">
                {items.map((item, index) => (
                    <div
                        key={index}
                        className={`grid gap-3 rounded-lg border p-3 ${
                            purchase
                                ? "lg:grid-cols-[minmax(220px,1.6fr)_110px_130px_140px_150px_40px]"
                                : "lg:grid-cols-[minmax(260px,1.8fr)_120px_150px_40px]"
                        }`}
                    >
                        <Field label="Product">
                            <select
                                className="h-9 w-full rounded-md border bg-background px-3"
                                value={item.productId}
                                onChange={(event) => {
                                    const product = products.find(
                                        (candidate) => candidate.id === Number(event.target.value),
                                    );
                                    setItems((rows) =>
                                        rows.map((row, rowIndex) =>
                                            rowIndex === index
                                                ? {
                                                      ...row,
                                                      productId: Number(event.target.value),
                                                      amount: purchase
                                                          ? row.amount
                                                          : (product?.defaultPrice ?? row.amount),
                                                  }
                                                : row,
                                        ),
                                    );
                                }}
                            >
                                <option value={0}>Select product</option>
                                {products.map((product) => (
                                    <option key={product.id} value={product.id}>
                                        {product.name}
                                        {product.barcode ? ` · ${product.barcode}` : ""} · stock{" "}
                                        {product.availableQuantity}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Quantity">
                            <Input
                                type="number"
                                min={0.001}
                                step="0.001"
                                value={item.quantity}
                                onChange={(event) =>
                                    setItems((rows) =>
                                        rows.map((row, rowIndex) =>
                                            rowIndex === index
                                                ? { ...row, quantity: Number(event.target.value) }
                                                : row,
                                        ),
                                    )
                                }
                            />
                        </Field>
                        <Field label={purchase ? "Unit cost" : "Unit price"}>
                            <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={item.amount}
                                onChange={(event) =>
                                    setItems((rows) =>
                                        rows.map((row, rowIndex) =>
                                            rowIndex === index
                                                ? { ...row, amount: Number(event.target.value) }
                                                : row,
                                        ),
                                    )
                                }
                            />
                        </Field>
                        {purchase && (
                            <>
                                <Field label="Lot number">
                                    <Input
                                        value={item.lotNumber ?? ""}
                                        onChange={(event) =>
                                            setItems((rows) =>
                                                rows.map((row, rowIndex) =>
                                                    rowIndex === index
                                                        ? { ...row, lotNumber: event.target.value }
                                                        : row,
                                                ),
                                            )
                                        }
                                    />
                                </Field>
                                <Field label="Expiry">
                                    <Input
                                        type="date"
                                        value={item.expireDate ?? ""}
                                        onChange={(event) =>
                                            setItems((rows) =>
                                                rows.map((row, rowIndex) =>
                                                    rowIndex === index
                                                        ? {
                                                              ...row,
                                                              expireDate: event.target.value || null,
                                                          }
                                                        : row,
                                                ),
                                            )
                                        }
                                    />
                                </Field>
                            </>
                        )}
                        <div className="flex items-end">
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                disabled={items.length === 1}
                                onClick={() =>
                                    setItems((rows) =>
                                        rows.filter((_, rowIndex) => rowIndex !== index),
                                    )
                                }
                            >
                                <Trash2 className="size-4 text-destructive" />
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground lg:col-span-full">
                            Line total: <strong>{money(item.quantity * item.amount)}</strong>
                        </p>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            {children}
        </div>
    );
}
function NumberField({
    label,
    value,
    set,
}: {
    label: string;
    value: number;
    set: (value: number) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <Label>{label}</Label>
            <Input
                className="w-32 text-end"
                type="number"
                min={0}
                step="0.01"
                value={value}
                onChange={(event) => set(Number(event.target.value))}
            />
        </div>
    );
}
function MoneyRow({
    label,
    value,
    strong = false,
}: {
    label: string;
    value: number;
    strong?: boolean;
}) {
    return (
        <div className={`flex justify-between ${strong ? "text-lg font-bold" : "text-sm"}`}>
            <span>{label}</span>
            <span>{money(value)}</span>
        </div>
    );
}
function Loading({ colSpan }: { colSpan: number }) {
    return (
        <TableRow>
            <TableCell colSpan={colSpan} className="h-32 text-center">
                <LoaderCircle className="mx-auto size-5 animate-spin" />
            </TableCell>
        </TableRow>
    );
}
function Empty({ colSpan, text }: { colSpan: number; text: string }) {
    return (
        <TableRow>
            <TableCell colSpan={colSpan} className="h-32 text-center text-muted-foreground">
                {text}
            </TableCell>
        </TableRow>
    );
}
function money(value: number) {
    return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
    }).format(value);
}
function date(value: string) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00Z`));
}
function nullable(value: string) {
    return value.trim() || null;
}
function message(error: unknown) {
    return (
        (error as { response?: { data?: { message?: string } }; message?: string })
            .response?.data?.message ??
        (error as Error).message ??
        "The operation failed."
    );
}
