import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    CircleDollarSign,
    CreditCard,
    LoaderCircle,
    Save,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { ServerSearchCombobox } from "@/components/server-search-combobox";
import { SimpleCombobox } from "@/components/simple-combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    ManualSale,
    OperationCustomer,
} from "@/features/operations/operations-types";

const today = () => new Date().toISOString().slice(0, 10);

export default function ManualSalesPage() {
    const queryClient = useQueryClient();
    const { formatMoney } = useTenant();
    const { user } = useAdminAuth();
    const canManage = hasPermission(user, Permissions.ManualSalesManage);
    const { data: sales, isLoading } = useOperationQuery(
        operationKeys.sales,
        operationsService.sales,
    );

    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedSale, setSelectedSale] = useState<ManualSale | null>(null);
    const [selectedCustomer, setSelectedCustomer] =
        useState<OperationCustomer | null>(null);
    const [items, setItems] = useState<DocumentItem[]>([newDocumentItem()]);
    const [form, setForm] = useState({
        customerName: "",
        customerPhone: "",
        saleDate: today(),
        discount: 0,
        tax: 0,
        paidAmount: 0,
        paymentMethod: "Cash",
        paymentReferenceNumber: "",
        notes: "",
    });

    const subtotal = useMemo(
        () => items.reduce((sum, item) => sum + item.quantity * item.amount, 0),
        [items],
    );
    const total = Math.max(0, subtotal - form.discount + form.tax);
    const remaining = Math.max(0, total - form.paidAmount);

    const reset = () => {
        setSelectedCustomer(null);
        setItems([newDocumentItem()]);
        setForm({
            customerName: "",
            customerPhone: "",
            saleDate: today(),
            discount: 0,
            tax: 0,
            paidAmount: 0,
            paymentMethod: "Cash",
            paymentReferenceNumber: "",
            notes: "",
        });
    };

    const submit = async () => {
        if (!canManage) return;
        if (
            items.some(
                (item) => !item.productId || item.quantity <= 0 || item.amount < 0,
            )
        ) {
            return toast.error("Complete every sale line.");
        }
        if (new Set(items.map((item) => item.productId)).size !== items.length) {
            return toast.error("Each product may appear only once.");
        }

        const unavailable = items.find(
            (item) =>
                item.product && item.quantity > item.product.availableQuantity,
        );
        if (unavailable?.product) {
            return toast.error(
                `${unavailable.product.name} has only ${unavailable.product.availableQuantity} available.`,
            );
        }
        if (form.paidAmount < 0 || form.paidAmount > total) {
            return toast.error(
                "Opening payment must be between zero and the sale total.",
            );
        }

        setSaving(true);
        try {
            await operationsService.createSale({
                customerId: selectedCustomer?.id ?? null,
                customerName: selectedCustomer
                    ? null
                    : nullable(form.customerName),
                customerPhone: selectedCustomer
                    ? null
                    : nullable(form.customerPhone),
                saleDate: form.saleDate,
                discount: form.discount,
                tax: form.tax,
                paidAmount: form.paidAmount,
                paymentMethod: form.paymentMethod,
                paymentReferenceNumber: nullable(form.paymentReferenceNumber),
                notes: nullable(form.notes),
                items: items.map((item) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.amount,
                })),
            });
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: operationKeys.sales }),
                queryClient.invalidateQueries({ queryKey: operationKeys.summary }),
                queryClient.invalidateQueries({ queryKey: ["inventory"] }),
            ]);
            toast.success("Sale recorded and stock deducted.");
            setOpen(false);
            reset();
        } catch (error) {
            toast.error(message(error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Manual sales"
                description="Record counter sales, link registered customers when useful, and track credit payments without changing storefront orders."
                actions={
                    canManage ? (
                        <Button onClick={() => setOpen(true)}>
                            <CircleDollarSign className="me-2 size-4" />
                            New sale
                        </Button>
                    ) : undefined
                }
            />

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Sale</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Customer</TableHead>
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
                            ) : sales?.length ? (
                                sales.map((sale) => (
                                    <TableRow key={sale.id}>
                                        <TableCell className="font-medium">
                                            {sale.saleNumber}
                                        </TableCell>
                                        <TableCell>{date(sale.saleDate)}</TableCell>
                                        <TableCell>{sale.customerName}</TableCell>
                                        <TableCell>{sale.itemCount}</TableCell>
                                        <TableCell className="text-end">
                                            {formatMoney(sale.total)}
                                        </TableCell>
                                        <TableCell className="text-end">
                                            {formatMoney(sale.paidAmount)}
                                        </TableCell>
                                        <TableCell className="text-end">
                                            {formatMoney(sale.remainingAmount)}
                                        </TableCell>
                                        <TableCell>
                                            <PaymentBadge status={sale.paymentStatus} />
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setSelectedSale(sale)}
                                            >
                                                <CreditCard className="me-2 size-4" />
                                                Payments
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <Empty
                                    colSpan={9}
                                    text="No manual sales have been recorded."
                                />
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-6xl">
                    <DialogHeader>
                        <DialogTitle>Record manual sale</DialogTitle>
                        <DialogDescription>
                            Choose a registered customer for clean history, or leave it
                            empty and enter walk-in details. The server rechecks stock
                            before saving.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 md:grid-cols-4">
                        <div className="space-y-2 md:col-span-2">
                            <Label>Registered customer (optional)</Label>
                            <ServerSearchCombobox<OperationCustomer>
                                value={selectedCustomer}
                                onValueChange={(customer) => {
                                    setSelectedCustomer(customer);
                                    if (customer) {
                                        setForm((current) => ({
                                            ...current,
                                            customerName: customer.name,
                                            customerPhone: customer.phone,
                                        }));
                                    }
                                }}
                                queryKey={["operations", "customer-search"]}
                                search={(search) =>
                                    operationsService.customers(search, 20)
                                }
                                getLabel={(customer) => customer.name}
                                getDescription={(customer) =>
                                    `${customer.phone}${
                                        customer.customerTypeName
                                            ? ` · ${customer.customerTypeName}`
                                            : ""
                                    }`
                                }
                                placeholder="Search customer name, phone or email…"
                            />
                        </div>
                        <Field label="Sale date">
                            <Input
                                type="date"
                                value={form.saleDate}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        saleDate: event.target.value,
                                    }))
                                }
                            />
                        </Field>
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
                                    "Card",
                                    "Bank transfer",
                                    "Credit",
                                    "Other",
                                ].map((value) => ({ value, label: value }))}
                                placeholder="Select payment method"
                            />
                        </Field>
                        <Field label="Walk-in customer">
                            <Input
                                disabled={Boolean(selectedCustomer)}
                                value={form.customerName}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        customerName: event.target.value,
                                    }))
                                }
                                placeholder="Walk-in customer"
                            />
                        </Field>
                        <Field label="Walk-in phone">
                            <Input
                                disabled={Boolean(selectedCustomer)}
                                value={form.customerPhone}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        customerPhone: event.target.value,
                                    }))
                                }
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
                    </div>

                    <Separator />
                    <DocumentLines items={items} setItems={setItems} mode="sale" />
                    <Separator />

                    <DocumentSettlementLayout
                        notes={form.notes}
                        onNotesChange={(notes) =>
                            setForm((current) => ({ ...current, notes }))
                        }
                        summaryTitle="Sale totals"
                        summaryDescription="Review pricing and record the opening customer payment."
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
                        <Separator />
                        <MoneySummaryRow label="Sale total" value={total} emphasis />
                        <AmountInputRow
                            label="Opening payment"
                            value={form.paidAmount}
                            onChange={(paidAmount) =>
                                setForm((current) => ({ ...current, paidAmount }))
                            }
                        />
                        <div className="rounded-lg bg-muted/50 p-3">
                            <MoneySummaryRow
                                label="Remaining after save"
                                value={remaining}
                                muted
                            />
                        </div>
                    </DocumentSettlementLayout>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => void submit()} disabled={saving}>
                            {saving ? (
                                <LoaderCircle className="me-2 size-4 animate-spin" />
                            ) : (
                                <Save className="me-2 size-4" />
                            )}
                            Complete sale
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {selectedSale ? (
                <PaymentLedgerDialog
                    open={Boolean(selectedSale)}
                    onOpenChange={(next) => {
                        if (!next) setSelectedSale(null);
                    }}
                    title="Sale payments"
                    description="Record customer installments and preserve previous receipts"
                    documentNumber={selectedSale.saleNumber}
                    total={selectedSale.total}
                    paidAmount={selectedSale.paidAmount}
                    remainingAmount={selectedSale.remainingAmount}
                    paymentStatus={selectedSale.paymentStatus}
                    queryKey={operationKeys.salePayments(selectedSale.id)}
                    loadPayments={() =>
                        operationsService.salePayments(selectedSale.id)
                    }
                    addPayment={(body) =>
                        operationsService.addSalePayment(selectedSale.id, body)
                    }
                    invalidate={[operationKeys.sales, operationKeys.summary]}
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
