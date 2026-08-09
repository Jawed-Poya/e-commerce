import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    CreditCard,
    LoaderCircle,
    FileText, PackagePlus,
    ListTree,
    Pencil,
    Save,
    Truck,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { ListPagination } from "@/components/list-pagination";
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
import { useCompany } from "@/features/company/company-context";
import {
    DocumentLines,
    newDocumentItem,
} from "@/features/operations/components/document-lines";
import {
    getSubmittableDocumentLines,
    isDocumentLineComplete,
} from "@/features/operations/document-line-state";
import {
    AmountInputRow,
    DocumentSettlementLayout,
    MoneySummaryRow,
} from "@/features/operations/components/document-settlement";
import {
    PaymentBadge,
    PaymentLedgerDialog,
} from "@/features/operations/components/payment-ledger-dialog";
import { PurchaseDetailsDialog } from "@/features/operations/components/purchase-details-dialog";
import {
    operationKeys,
    useOperationQuery,
} from "@/features/operations/operations-hooks";
import { operationsService } from "@/features/operations/operations-service";
import { companyService } from "@/features/company/company-service";
import { useI18n } from "@/i18n/i18n-provider";
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
    const { formatMoney } = useCompany();
    const { tr } = useI18n();
    const { user } = useAdminAuth();
    const canManage = hasPermission(user, Permissions.PurchasesManage);
    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search.trim());
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [supplierPage, setSupplierPage] = useState(1);
    const [supplierPageSize, setSupplierPageSize] = useState(20);
    const { data: purchasePage, isLoading, isFetching } = useOperationQuery(
        operationKeys.purchases(deferredSearch, page, pageSize),
        () => operationsService.purchases(deferredSearch, page, pageSize),
    );
    const purchases = purchasePage?.items;
    const { data: supplierPageData, isLoading: suppliersLoading, isFetching: suppliersFetching } = useOperationQuery(
        operationKeys.supplierPage("", supplierPage, supplierPageSize),
        () => operationsService.supplierPage("", supplierPage, supplierPageSize),
    );
    const suppliers = supplierPageData?.items;
    useEffect(() => setPage(1), [deferredSearch]);
    const { data: operationPolicy } = useOperationQuery(
        operationKeys.policy,
        operationsService.policy,
    );

    const [tab, setTab] = useState<"purchases" | "suppliers">("purchases");
    const [purchaseOpen, setPurchaseOpen] = useState(false);
    const [supplierOpen, setSupplierOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
    const [detailsPurchase, setDetailsPurchase] = useState<Purchase | null>(null);
    const [saving, setSaving] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [lineLimitOverrideEnabled, setLineLimitOverrideEnabled] = useState(false);
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
        setLineLimitOverrideEnabled(false);
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
        const documentItems = getSubmittableDocumentLines(items);
        const configuredLineLimit = operationPolicy?.maximumPurchaseLines ?? 50;
        const effectiveLineLimit = operationPolicy?.canOverrideLineLimits && lineLimitOverrideEnabled
            ? 500
            : configuredLineLimit;
        if (documentItems.length > effectiveLineLimit) {
            return toast.error(
                operationPolicy?.canOverrideLineLimits && lineLimitOverrideEnabled
                    ? tr("A document cannot contain more than 500 product lines.")
                    : `${tr("The configured product-line limit is")} ${configuredLineLimit}.`,
            );
        }
        if (!documentItems.length) {
            return toast.error(tr("Add at least one product."));
        }
        if (documentItems.some((item) => !isDocumentLineComplete(item))) {
            return toast.error(tr("Complete every purchase line."));
        }
        const currentDate = today();
        const expiredItem = documentItems.find(
            (item) => item.expireDate && item.expireDate < currentDate,
        );
        if (expiredItem) {
            return toast.error(
                tr("Expired stock cannot be received. Return it to the supplier or record it through quarantine documentation."),
            );
        }
        const lotKeys = documentItems.map((item) =>
            [
                item.productId,
                (item.lotNumber ?? "").trim().toLocaleUpperCase(),
                item.expireDate ?? "",
            ].join("|"),
        );
        if (new Set(lotKeys).size !== lotKeys.length) {
            return toast.error(
                tr("The same product, lot number, and expiry date may appear only once."),
            );
        }
        if (form.paidAmount < 0 || form.paidAmount > total) {
            return toast.error(
                tr("Opening payment must be between zero and the purchase total."),
            );
        }

        setSaving(true);
        try {
            const response = await operationsService.createPurchase({
                ...form,
                overrideLineLimit: lineLimitOverrideEnabled,
                supplierId: selectedSupplier?.id ?? null,
                paymentReferenceNumber: nullable(form.paymentReferenceNumber),
                referenceNumber: nullable(form.referenceNumber),
                notes: nullable(form.notes),
                items: documentItems.map((item) => ({
                    productId: item.productId,
                    unitId: item.unitId,
                    quantity: item.quantity,
                    unitCost: item.amount,
                    lotNumber: nullable(item.lotNumber ?? ""),
                    expireDate: item.expireDate || null,
                })),
            });
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: operationKeys.purchaseRoot }),
                queryClient.invalidateQueries({ queryKey: operationKeys.summary }),
                queryClient.invalidateQueries({ queryKey: ["inventory"] }),
            ]);
            toast.success(
                response.offlineQueued
                    ? response.message
                    : "Purchase received and inventory updated.",
            );
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

    const exportPdf = async () => {
        setExportingPdf(true);
        try {
            await companyService.exportOperationalPdf("purchases");
        } catch (error) {
            toast.error(message(error));
        } finally {
            setExportingPdf(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Purchases"
                description="Receive inventory, track supplier credit, and settle balances with an auditable payment history."
                actions={
                    <div className="flex flex-wrap gap-2">
                            <Button variant="outline" disabled={exportingPdf} onClick={() => void exportPdf()}>{exportingPdf ? <LoaderCircle className="me-2 size-4 animate-spin" /> : <FileText className="me-2 size-4" />}Export PDF</Button>
                            {canManage ? <>
                            <Button variant="outline" onClick={() => openSupplier()}>
                                <Truck className="me-2 size-4" />
                                New supplier
                            </Button>
                            <Button onClick={() => setPurchaseOpen(true)}>
                                <PackagePlus className="me-2 size-4" />
                                New purchase
                            </Button>
                            </> : null}
                        </div>
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
                <div className="space-y-3">
                    <div className="max-w-xl">
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search purchase, supplier bill, supplier, product, barcode or lot…"
                        />
                    </div>
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
                                                <p>{purchase.purchaseNumber}</p>
                                                {purchase.referenceNumber ? (
                                                    <p className="text-xs font-normal text-muted-foreground">
                                                        Bill: {purchase.referenceNumber}
                                                    </p>
                                                ) : null}
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
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => setDetailsPurchase(purchase)}
                                                    >
                                                        <ListTree className="me-2 size-4" />
                                                        Details
                                                    </Button>
                                                    {purchase.paymentStatus !== "Paid" || purchase.paidAmount > 0 ? (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setSelectedPurchase(purchase)}
                                                        >
                                                            <CreditCard className="me-2 size-4" />
                                                            Payments
                                                        </Button>
                                                    ) : null}
                                                </div>
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
                {purchasePage ? (
                    <ListPagination
                        page={purchasePage.page}
                        pageSize={purchasePage.pageSize}
                        totalCount={purchasePage.totalCount}
                        totalPages={purchasePage.totalPages}
                        disabled={isFetching}
                        onPageChange={setPage}
                        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                    />
                ) : null}
                </div>
            ) : (
                <div className="space-y-3">
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
                {supplierPageData ? (
                    <ListPagination
                        page={supplierPageData.page}
                        pageSize={supplierPageData.pageSize}
                        totalCount={supplierPageData.totalCount}
                        totalPages={supplierPageData.totalPages}
                        disabled={suppliersFetching}
                        onPageChange={setSupplierPage}
                        onPageSizeChange={(size) => { setSupplierPageSize(size); setSupplierPage(1); }}
                    />
                ) : null}
                </div>
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
                        <Field label="Supplier bill / invoice number">
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
                    <DocumentLines
                        items={items}
                        setItems={setItems}
                        mode="purchase"
                        maximumLines={operationPolicy?.maximumPurchaseLines ?? 50}
                        canOverrideLineLimit={operationPolicy?.canOverrideLineLimits ?? false}
                        overrideLineLimit={lineLimitOverrideEnabled}
                        onOverrideLineLimitChange={setLineLimitOverrideEnabled}
                    />
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
                        <MoneySummaryRow
                            label="Purchase total"
                            value={total}
                            emphasis
                            actionHint="Click to pay the full amount"
                            onClick={() =>
                                setForm((current) => ({
                                    ...current,
                                    paidAmount: total,
                                }))
                            }
                        />
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

            <PurchaseDetailsDialog
                purchase={detailsPurchase}
                open={Boolean(detailsPurchase)}
                onOpenChange={(open) => !open && setDetailsPurchase(null)}
            />

            {selectedPurchase ? (
                <PaymentLedgerDialog<Purchase>
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
                    onDocumentUpdated={setSelectedPurchase}
                    invalidate={[operationKeys.purchaseRoot, operationKeys.summary]}
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
    const responseMessage = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
    if (typeof responseMessage === "string" && responseMessage.trim()) return responseMessage.trim();
    if (error instanceof Error && error.message.trim()) return error.message.trim();
    return "The operation failed.";
}
