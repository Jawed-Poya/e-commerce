import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    CreditCard,
    LoaderCircle,
    PackagePlus,
    Pencil,
    Save,
    Truck,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { ServerSearchCombobox } from "@/components/server-search-combobox";
import { SimpleCombobox } from "@/components/simple-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
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
import { useTenant } from "@/features/tenancy/tenant-context";
import {
    DocumentLines,
    newDocumentItem,
} from "@/features/operations/components/document-lines";
import {
    AmountInputRow,
    DocumentSettlementLayout,
    MoneySummaryRow,
} from "@/features/operations/components/document-settlement";
import {
    PaymentBadge,
    PaymentLedgerDialog,
} from "@/features/operations/components/payment-ledger-dialog";
import {
    operationKeys,
    useOperationQuery,
} from "@/features/operations/operations-hooks";
import { operationsService } from "@/features/operations/operations-service";
import type {
    DocumentItem,
    Purchase,
    Supplier,
} from "@/features/operations/operations-types";

const today = () => new Date().toISOString().slice(0, 10);
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
    const { formatMoney } = useTenant();
    const { user } = useAdminAuth();
    const canManage = hasPermission(user, Permissions.PurchasesManage);
    const { data: purchases, isLoading } = useOperationQuery(
        operationKeys.purchases,
        operationsService.purchases,
    );
    const { data: suppliers, isLoading: suppliersLoading } = useOperationQuery(
        operationKeys.suppliers,
        () => operationsService.suppliersResponse("", 100),
    );

    const [tab, setTab] = useState<"purchases" | "suppliers">("purchases");
    const [purchaseOpen, setPurchaseOpen] = useState(false);
    const [supplierOpen, setSupplierOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
    const [saving, setSaving] = useState(false);
    const [items, setItems] = useState<DocumentItem[]>([newDocumentItem()]);
    const [form, setForm] = useState({
        purchaseDate: today(),
        discount: 0,
        tax: 0,
        otherCost: 0,
        paidAmount: 0,
        paymentMethod: "Cash",
        paymentReferenceNumber: "",
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
    const remaining = Math.max(0, total - form.paidAmount);

    const resetPurchase = () => {
        setItems([newDocumentItem()]);
        setSelectedSupplier(null);
        setForm({
            purchaseDate: today(),
            discount: 0,
            tax: 0,
            otherCost: 0,
            paidAmount: 0,
            paymentMethod: "Cash",
            paymentReferenceNumber: "",
            referenceNumber: "",
            notes: "",
        });
    };

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
        if (
            items.some(
                (item) => !item.productId || item.quantity <= 0 || item.amount < 0,
            )
        ) {
            return toast.error("Complete every purchase line.");
        }
        if (new Set(items.map((item) => item.productId)).size !== items.length) {
            return toast.error("Each product may appear only once.");
        }
        if (form.paidAmount < 0 || form.paidAmount > total) {
            return toast.error(
                "Opening payment must be between zero and the purchase total.",
            );
        }

        setSaving(true);
        try {
            await operationsService.createPurchase({
                ...form,
                supplierId: selectedSupplier?.id ?? null,
                paymentReferenceNumber: nullable(form.paymentReferenceNumber),
                referenceNumber: nullable(form.referenceNumber),
                notes: nullable(form.notes),
                items: items.map((item) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    unitCost: item.amount,
                    lotNumber: nullable(item.lotNumber ?? ""),
                    expireDate: item.expireDate || null,
                })),
            });
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: operationKeys.purchases }),
                queryClient.invalidateQueries({ queryKey: operationKeys.summary }),
                queryClient.invalidateQueries({ queryKey: ["inventory"] }),
            ]);
            toast.success("Purchase received and inventory updated.");
            setPurchaseOpen(false);
            resetPurchase();
        } catch (error) {
            toast.error(message(error));
        } finally {
            setSaving(false);
        }
    };

    const saveSupplier = async () => {
        if (!supplier.name.trim()) return toast.error("Supplier name is required.");
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
                description="Receive inventory, track supplier credit, and settle balances with an auditable payment history."
                actions={
                    canManage ? (
                        <div className="flex flex-wrap gap-2">
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
                    Purchases
                </Button>
                <Button
                    size="sm"
                    variant={tab === "suppliers" ? "default" : "ghost"}
                    onClick={() => setTab("suppliers")}
                >
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
                                    <TableHead className="text-end">Balance</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <Loading colSpan={9} />
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
                                                {formatMoney(purchase.total)}
                                            </TableCell>
                                            <TableCell className="text-end">
                                                {formatMoney(purchase.paidAmount)}
                                            </TableCell>
                                            <TableCell className="text-end">
                                                {formatMoney(purchase.remainingAmount)}
                                            </TableCell>
                                            <TableCell>
                                                <PaymentBadge status={purchase.paymentStatus} />
                                            </TableCell>
                                            <TableCell>
                                                {purchase.paymentStatus !== "Paid" ||
                                                purchase.paidAmount > 0 ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            setSelectedPurchase(purchase)
                                                        }
                                                    >
                                                        <CreditCard className="me-2 size-4" />
                                                        Payments
                                                    </Button>
                                                ) : null}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <Empty
                                        colSpan={9}
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
                                    <TableHead />
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
                                                <p className="text-xs text-muted-foreground">
                                                    {item.address ?? "No address"}
                                                </p>
                                            </TableCell>
                                            <TableCell>{item.contactPerson ?? "—"}</TableCell>
                                            <TableCell>
                                                {item.phone ?? "—"}
                                                <p className="text-xs text-muted-foreground">
                                                    {item.email ?? ""}
                                                </p>
                                            </TableCell>
                                            <TableCell>{item.taxNumber ?? "—"}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        item.isActive ? "default" : "outline"
                                                    }
                                                >
                                                    {item.isActive ? "Active" : "Inactive"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {canManage ? (
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => openSupplier(item)}
                                                    >
                                                        <Pencil className="size-4" />
                                                    </Button>
                                                ) : null}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <Empty
                                        colSpan={6}
                                        text="No suppliers have been added."
                                    />
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
                            Record receiving details and an optional opening supplier
                            payment. Later installments remain available from the purchase
                            table.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 md:grid-cols-3">
                        <Field label="Supplier">
                            <ServerSearchCombobox<Supplier>
                                value={selectedSupplier}
                                onValueChange={setSelectedSupplier}
                                queryKey={["operations", "supplier-search"]}
                                search={(search) =>
                                    operationsService.suppliers(search, 20)
                                }
                                getLabel={(item) => item.name}
                                getDescription={(item) =>
                                    [item.contactPerson, item.phone]
                                        .filter(Boolean)
                                        .join(" · ")
                                }
                                placeholder="Search supplier…"
                            />
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
                                placeholder="Invoice or delivery note"
                            />
                        </Field>
                    </div>

                    <Separator />
                    <DocumentLines items={items} setItems={setItems} mode="purchase" />
                    <Separator />

                    <DocumentSettlementLayout
                        notes={form.notes}
                        onNotesChange={(notes) =>
                            setForm((current) => ({ ...current, notes }))
                        }
                        summaryTitle="Purchase totals"
                        summaryDescription="Review costs and record the opening supplier payment."
                    >
                        <MoneySummaryRow label="Subtotal" value={subtotal} />
                        <AmountInputRow
                            label="Discount"
                            value={form.discount}
                            onChange={(discount) =>
                                setForm((current) => ({ ...current, discount }))
                            }
                        />
                        <AmountInputRow
                            label="Tax"
                            value={form.tax}
                            onChange={(tax) =>
                                setForm((current) => ({ ...current, tax }))
                            }
                        />
                        <AmountInputRow
                            label="Other cost"
                            value={form.otherCost}
                            onChange={(otherCost) =>
                                setForm((current) => ({ ...current, otherCost }))
                            }
                        />
                        <Separator />
                        <MoneySummaryRow label="Purchase total" value={total} emphasis />
                        <AmountInputRow
                            label="Opening payment"
                            value={form.paidAmount}
                            onChange={(paidAmount) =>
                                setForm((current) => ({ ...current, paidAmount }))
                            }
                        />
                        <Field label="Payment method">
                            <SimpleCombobox
                                value={form.paymentMethod}
                                onValueChange={(paymentMethod) =>
                                    setForm((current) => ({
                                        ...current,
                                        paymentMethod: paymentMethod ?? "Cash",
                                    }))
                                }
                                options={[
                                    "Cash",
                                    "Bank transfer",
                                    "Card",
                                    "Cheque",
                                    "Credit",
                                ].map((value) => ({ value, label: value }))}
                                placeholder="Select payment method"
                            />
                        </Field>
                        <Field label="Payment reference">
                            <Input
                                value={form.paymentReferenceNumber}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        paymentReferenceNumber: event.target.value,
                                    }))
                                }
                                placeholder="Optional receipt or transfer number"
                            />
                        </Field>
                        <div className="rounded-lg bg-muted/50 p-3">
                            <MoneySummaryRow
                                label="Remaining after save"
                                value={remaining}
                                muted
                            />
                        </div>
                    </DocumentSettlementLayout>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPurchaseOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => void submit()} disabled={saving}>
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
                            Supplier details are available for future purchases and
                            server-side search.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Supplier name">
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
                        <div className="flex items-end">
                            <label className="flex h-9 items-center gap-2">
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
                        <div className="space-y-2 sm:col-span-2">
                            <Label>Address</Label>
                            <Textarea
                                value={supplier.address}
                                onChange={(event) =>
                                    setSupplier((current) => ({
                                        ...current,
                                        address: event.target.value,
                                    }))
                                }
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSupplierOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => void saveSupplier()} disabled={saving}>
                            {saving ? (
                                <LoaderCircle className="me-2 size-4 animate-spin" />
                            ) : (
                                <Save className="me-2 size-4" />
                            )}
                            Save supplier
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {selectedPurchase ? (
                <PaymentLedgerDialog
                    open={Boolean(selectedPurchase)}
                    onOpenChange={(open) => {
                        if (!open) setSelectedPurchase(null);
                    }}
                    title="Purchase payments"
                    description="Record supplier installments without modifying earlier payments"
                    documentNumber={selectedPurchase.purchaseNumber}
                    total={selectedPurchase.total}
                    paidAmount={selectedPurchase.paidAmount}
                    remainingAmount={selectedPurchase.remainingAmount}
                    paymentStatus={selectedPurchase.paymentStatus}
                    queryKey={operationKeys.purchasePayments(selectedPurchase.id)}
                    loadPayments={() =>
                        operationsService.purchasePayments(selectedPurchase.id)
                    }
                    addPayment={(body) =>
                        operationsService.addPurchasePayment(
                            selectedPurchase.id,
                            body,
                        )
                    }
                    invalidate={[operationKeys.purchases, operationKeys.summary]}
                    canManage={canManage}
                />
            ) : null}
        </div>
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
            <TableCell
                colSpan={colSpan}
                className="h-32 text-center text-muted-foreground"
            >
                {text}
            </TableCell>
        </TableRow>
    );
}

function nullable(value: string) {
    const result = value.trim();
    return result || null;
}

function date(value: string) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00Z`));
}

function message(error: unknown) {
    return (
        (error as { response?: { data?: { message?: string } }; message?: string })
            .response?.data?.message ??
        (error as Error).message ??
        "The operation failed."
    );
}
