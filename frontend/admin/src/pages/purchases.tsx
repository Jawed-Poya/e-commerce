import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    CreditCard,
    LoaderCircle,
    FileText, PackagePlus,
    ListTree,
    Pencil,
    Save,
    Truck,
    BookOpen,
    Plus,
    Rows3,
    Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { ListPagination } from "@/components/list-pagination";
import { ServerSearchCombobox } from "@/components/server-search-combobox";
import { SimpleCombobox } from "@/components/simple-combobox";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
    calculateLineNet,
    calculateStackedDiscountNet,
    roundCurrency,
} from "@/features/operations/discount-calculations";
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
import {
    focusDocumentLine,
    focusFirstInvalidSummary,
    focusOperationApiError,
    focusValidationField,
} from "@/lib/focus-validation-error";
import type {
    DocumentItem,
    Purchase,
    Supplier,
    SupplierLedger,
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
    const [searchParams, setSearchParams] = useSearchParams();
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

    const [tab, setTab] = useState<"purchases" | "suppliers">(
        searchParams.get("tab") === "suppliers" ? "suppliers" : "purchases",
    );
    const [purchaseOpen, setPurchaseOpen] = useState(false);
    const purchaseDialogRef = useRef<HTMLDivElement>(null);
    const editPurchaseDialogRef = useRef<HTMLDivElement>(null);
    const [supplierOpen, setSupplierOpen] = useState(false);
    const [supplierBulkOpen, setSupplierBulkOpen] = useState(false);
    const [supplierRows, setSupplierRows] = useState([emptySupplier(), emptySupplier(), emptySupplier()]);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [ledgerSupplier, setLedgerSupplier] = useState<Pick<Supplier, "id" | "name"> | null>(null);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
    const [detailsPurchase, setDetailsPurchase] = useState<Purchase | null>(null);
    const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
    const [deletingPurchase, setDeletingPurchase] = useState<Purchase | null>(null);
    const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
    const [editItems, setEditItems] = useState<DocumentItem[]>([newDocumentItem()]);
    const [editLineLimitOverrideEnabled, setEditLineLimitOverrideEnabled] = useState(false);
    const [editForm, setEditForm] = useState({
        purchaseDate: today(),
        discount: 0,
        discountPercent: 0,
        secondaryDiscountPercent: 0,
        tax: 0,
        otherCost: 0,
        paidAmount: 0,
        referenceNumber: "",
        notes: "",
    });
    const [saving, setSaving] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [lineLimitOverrideEnabled, setLineLimitOverrideEnabled] = useState(false);
    const [items, setItems] = useState<DocumentItem[]>([newDocumentItem()]);
    const [form, setForm] = useState({
        purchaseDate: today(),
        discount: 0,
        discountPercent: 0,
        secondaryDiscountPercent: 0,
        tax: 0,
        otherCost: 0,
        paidAmount: 0,
        paymentMethod: "Cash",
        paymentReferenceNumber: "",
        referenceNumber: "",
        notes: "",
    });
    const [supplier, setSupplier] = useState(emptySupplier);
    const ledgerQuery = useQuery({
        queryKey: ["operations", "supplier-ledger", ledgerSupplier?.id],
        queryFn: async () => (await operationsService.supplierLedger(ledgerSupplier!.id)).data,
        enabled: Boolean(ledgerSupplier),
    });

    useEffect(() => {
        if (searchParams.get("tab") === "suppliers") setTab("suppliers");
        const supplierId = Number(searchParams.get("supplierId"));
        if (Number.isSafeInteger(supplierId) && supplierId > 0) {
            setLedgerSupplier((current) => current?.id === supplierId
                ? current
                : { id: supplierId, name: "Supplier" });
        }
    }, [searchParams]);

    const closeSupplierLedger = () => {
        setLedgerSupplier(null);
        if (!searchParams.has("supplierId")) return;
        const next = new URLSearchParams(searchParams);
        next.delete("supplierId");
        setSearchParams(next, { replace: true });
    };

    const subtotal = useMemo(
        () => roundCurrency(items.reduce((sum, item) => sum + item.quantity * item.amount, 0)),
        [items],
    );
    const linesNet = useMemo(
        () => items.reduce((sum, item) => sum + stackedLineTotal(item), 0),
        [items],
    );
    const discountedSubtotal = calculateStackedDiscountNet(linesNet, form.discountPercent, form.secondaryDiscountPercent);
    const total = roundCurrency(Math.max(
        0,
        discountedSubtotal - form.discount + form.tax + form.otherCost,
    ));
    const remaining = roundCurrency(Math.max(0, total - form.paidAmount));
    const editLinesNet = useMemo(
        () => editItems.reduce((sum, item) => sum + stackedLineTotal(item), 0),
        [editItems],
    );
    const editDiscountedSubtotal = calculateStackedDiscountNet(
        editLinesNet,
        editForm.discountPercent,
        editForm.secondaryDiscountPercent,
    );
    const editTotal = roundCurrency(Math.max(
        0,
        editDiscountedSubtotal - editForm.discount + editForm.tax + editForm.otherCost,
    ));

    const resetPurchase = () => {
        setItems([newDocumentItem()]);
        setLineLimitOverrideEnabled(false);
        setSelectedSupplier(null);
        setForm({
            purchaseDate: today(),
            discount: 0,
            discountPercent: 0,
            secondaryDiscountPercent: 0,
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
        if (focusFirstInvalidSummary(purchaseDialogRef.current)) {
            return toast.error(tr("Correct the highlighted field before saving."));
        }
        const documentItems = getSubmittableDocumentLines(items);
        const configuredLineLimit = operationPolicy?.maximumPurchaseLines ?? 50;
        const effectiveLineLimit = operationPolicy?.canOverrideLineLimits && lineLimitOverrideEnabled
            ? 500
            : configuredLineLimit;
        if (documentItems.length > effectiveLineLimit) {
            focusDocumentLine(purchaseDialogRef.current);
            return toast.error(
                operationPolicy?.canOverrideLineLimits && lineLimitOverrideEnabled
                    ? tr("A document cannot contain more than 500 product lines.")
                    : `${tr("The configured product-line limit is")} ${configuredLineLimit}.`,
            );
        }
        if (!documentItems.length) {
            focusDocumentLine(purchaseDialogRef.current, 0);
            return toast.error(tr("Add at least one product."));
        }
        const incompleteItem = documentItems.find((item) => !isDocumentLineComplete(item));
        if (incompleteItem) {
            focusDocumentLine(purchaseDialogRef.current, items.indexOf(incompleteItem));
            return toast.error(tr("Complete every purchase line."));
        }
        const currentDate = today();
        const expiredItem = documentItems.find(
            (item) => item.expireDate && item.expireDate < currentDate,
        );
        if (expiredItem) {
            focusDocumentLine(purchaseDialogRef.current, items.indexOf(expiredItem));
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
            focusDocumentLine(purchaseDialogRef.current);
            return toast.error(
                tr("The same product, lot number, and expiry date may appear only once."),
            );
        }
        if (form.paidAmount < 0 || form.paidAmount > total) {
            focusValidationField(purchaseDialogRef.current, "purchasePaidAmount");
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
                    bonusQuantity: item.bonusQuantity,
                    discountPercent: item.discountPercent,
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
                    ? response.message?.trim() || "Purchase saved and will sync when the connection returns."
                    : "Purchase received and inventory updated.",
            );
            setPurchaseOpen(false);
            resetPurchase();
        } catch (error) {
            focusOperationApiError(purchaseDialogRef.current, error);
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

    const saveSupplierSheet = async () => {
        const rows = supplierRows.filter((row) => row.name.trim());
        if (!rows.length) return toast.error("Add at least one supplier name.");
        const normalizedNames = rows.map((row) => row.name.trim().toLocaleLowerCase());
        if (new Set(normalizedNames).size !== normalizedNames.length) return toast.error("Supplier names must be unique within the sheet.");
        setSaving(true);
        try {
            await Promise.all(rows.map((row) => operationsService.saveSupplier(null, { name: row.name.trim(), contactPerson: nullable(row.contactPerson), phone: nullable(row.phone), email: nullable(row.email), address: nullable(row.address), taxNumber: nullable(row.taxNumber), isActive: row.isActive })));
            await queryClient.invalidateQueries({ queryKey: operationKeys.suppliers });
            toast.success(`${rows.length} supplier(s) created.`);
            setSupplierBulkOpen(false);
            setSupplierRows([emptySupplier(), emptySupplier(), emptySupplier()]);
        } catch (error) { toast.error(message(error)); } finally { setSaving(false); }
    };

    const exportPdf = async () => {
        setExportingPdf(true);
        try {
            await companyService.exportOperationalPdf("purchases");
            toast.success(tr("Purchase PDF generated."));
        } catch (error) {
            toast.error(message(error));
        } finally {
            setExportingPdf(false);
        }
    };

    const openPurchaseEditor = async (purchase: Purchase) => {
        setSaving(true);
        try {
            const details = (await operationsService.purchase(purchase.id)).data;
            let currentSupplier: Supplier | null = null;
            if (details.supplierId) {
                const matches = await operationsService.suppliers(details.supplierName ?? "", 20);
                currentSupplier = matches.find((item) => item.id === details.supplierId) ?? {
                    id: details.supplierId,
                    name: details.supplierName ?? "Supplier",
                    contactPerson: null,
                    phone: null,
                    email: null,
                    address: null,
                    taxNumber: null,
                    isActive: true,
                    outstandingBalance: 0,
                };
            }
            setEditSupplier(currentSupplier);
            setEditForm({
                purchaseDate: details.purchaseDate,
                discount: details.discount,
                discountPercent: details.discountPercent,
                secondaryDiscountPercent: details.secondaryDiscountPercent,
                tax: details.tax,
                otherCost: details.otherCost,
                paidAmount: details.paidAmount,
                referenceNumber: details.referenceNumber ?? "",
                notes: details.notes ?? "",
            });
            const products = await Promise.all(details.items.map(async (line) => {
                const matches = await operationsService.products(line.barcode ?? line.productName, 50, true);
                return matches.find((product) => product.id === line.productId) ?? null;
            }));
            if (products.some((product) => !product)) {
                throw new Error("One or more purchase products are inactive or unavailable and cannot be corrected.");
            }
            setEditItems(details.items.map((line, index) => ({
                productId: line.productId,
                unitId: line.selectedUnitId,
                unitName: line.selectedUnitName,
                conversionFactor: line.unitConversionFactor,
                quantity: line.enteredQuantity,
                amount: line.enteredUnitCost,
                bonusQuantity: line.bonusQuantity,
                discountPercent: line.discountPercent,
                lotNumber: line.lotNumber ?? "",
                expireDate: line.expireDate,
                product: products[index],
            })));
            setEditLineLimitOverrideEnabled(false);
            setEditingPurchase(purchase);
        } catch (error) {
            toast.error(message(error));
        } finally {
            setSaving(false);
        }
    };

    const savePurchaseEdit = async () => {
        if (!editingPurchase) return;
        if (focusFirstInvalidSummary(editPurchaseDialogRef.current)) {
            return toast.error(tr("Correct the highlighted field before saving."));
        }
        const documentItems = getSubmittableDocumentLines(editItems);
        if (!documentItems.length || documentItems.some((item) => !isDocumentLineComplete(item))) {
            const incompleteIndex = editItems.findIndex((item) =>
                documentItems.includes(item) && !isDocumentLineComplete(item));
            focusDocumentLine(editPurchaseDialogRef.current, incompleteIndex >= 0 ? incompleteIndex : 0);
            return toast.error("Complete at least one purchase product line.");
        }
        const lotKeys = documentItems.map((item) => [
            item.productId,
            (item.lotNumber ?? "").trim().toLocaleUpperCase(),
            item.expireDate ?? "",
        ].join("|"));
        if (new Set(lotKeys).size !== lotKeys.length) {
            focusDocumentLine(editPurchaseDialogRef.current);
            return toast.error("The same product, lot number, and expiry date may appear only once.");
        }
        if (editTotal < editForm.paidAmount) {
            if (!focusValidationField(editPurchaseDialogRef.current, "editPurchaseTotals")) {
                focusDocumentLine(editPurchaseDialogRef.current);
            }
            return toast.error(`The corrected total cannot be below the recorded payments (${formatMoney(editForm.paidAmount)}).`);
        }
        setSaving(true);
        try {
            await operationsService.updatePurchase(editingPurchase.id, {
                overrideLineLimit: editLineLimitOverrideEnabled,
                supplierId: editSupplier?.id ?? null,
                purchaseDate: editForm.purchaseDate,
                discount: editForm.discount,
                discountPercent: editForm.discountPercent,
                secondaryDiscountPercent: editForm.secondaryDiscountPercent,
                tax: editForm.tax,
                otherCost: editForm.otherCost,
                referenceNumber: nullable(editForm.referenceNumber),
                notes: nullable(editForm.notes),
                items: documentItems.map((item) => ({
                    productId: item.productId,
                    unitId: item.unitId,
                    quantity: item.quantity,
                    unitCost: item.amount,
                    bonusQuantity: item.bonusQuantity,
                    discountPercent: item.discountPercent,
                    lotNumber: nullable(item.lotNumber ?? ""),
                    expireDate: item.expireDate || null,
                })),
            });
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: operationKeys.purchaseRoot }),
                queryClient.invalidateQueries({ queryKey: operationKeys.summary }),
                queryClient.invalidateQueries({ queryKey: ["inventory"] }),
            ]);
            setEditingPurchase(null);
            toast.success("Purchase corrected; inventory and accounting were reposted.");
        } catch (error) {
            focusOperationApiError(editPurchaseDialogRef.current, error);
            toast.error(message(error));
        } finally {
            setSaving(false);
        }
    };

    const deletePurchase = async () => {
        if (!deletingPurchase) return;
        setSaving(true);
        try {
            await operationsService.deletePurchase(deletingPurchase.id);
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: operationKeys.purchaseRoot }),
                queryClient.invalidateQueries({ queryKey: operationKeys.summary }),
                queryClient.invalidateQueries({ queryKey: ["inventory"] }),
            ]);
            setDeletingPurchase(null);
            toast.success("Purchase deleted and inventory reversed.");
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
                    <div className="flex flex-wrap gap-2">
                            <Button variant="outline" disabled={exportingPdf} onClick={() => void exportPdf()}>{exportingPdf ? <LoaderCircle className="me-2 size-4 animate-spin" /> : <FileText className="me-2 size-4" />}Export PDF</Button>
                            {canManage ? <>
                            <Button variant="outline" onClick={() => setSupplierBulkOpen(true)}><Rows3 className="me-2 size-4" />Supplier sheet</Button>
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
                                                    {canManage ? (
                                                        <>
                                                            <Button size="icon-sm" variant="ghost" title="Edit purchase details" onClick={() => void openPurchaseEditor(purchase)}>
                                                                <Pencil className="size-4" />
                                                            </Button>
                                                            <Button size="icon-sm" variant="ghost" className="text-destructive hover:text-destructive" title="Delete purchase" onClick={() => setDeletingPurchase(purchase)}>
                                                                <Trash2 className="size-4" />
                                                            </Button>
                                                        </>
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
                                    <TableHead className="text-end">Balance</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {suppliersLoading ? (
                                    <Loading colSpan={7} />
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
                                            <TableCell className="text-end font-semibold">{formatMoney(item.outstandingBalance)}</TableCell>
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
                                                <div className="flex justify-end gap-1"><Button size="icon" variant="ghost" title="Supplier ledger" onClick={() => setLedgerSupplier(item)}><BookOpen className="size-4" /></Button>{canManage ? (
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => openSupplier(item)}
                                                    >
                                                        <Pencil className="size-4" />
                                                    </Button>
                                                ) : null}</div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <Empty
                                        colSpan={7}
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
                <DialogContent ref={purchaseDialogRef} className="max-h-[94vh] overflow-y-auto sm:max-w-6xl">
                    <DialogHeader>
                        <DialogTitle>Receive purchase</DialogTitle>
                        <DialogDescription>
                            Record receiving details and an optional opening supplier
                            payment. Later installments remain available from the purchase
                            table.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                                data-validation-field="purchaseDate"
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
                            inputId="purchaseDiscount"
                            onChange={(discount) =>
                                setForm((current) => ({ ...current, discount }))
                            }
                        />
                        <AmountInputRow inputId="purchaseDiscountPercent" label="General discount 1 %" value={form.discountPercent} max={100} onChange={(discountPercent) => setForm((current) => ({ ...current, discountPercent }))} />
                        <AmountInputRow inputId="purchaseSecondaryDiscountPercent" label="General discount 2 %" value={form.secondaryDiscountPercent} max={100} onChange={(secondaryDiscountPercent) => setForm((current) => ({ ...current, secondaryDiscountPercent }))} />
                        <AmountInputRow
                            label="Tax"
                            value={form.tax}
                            inputId="purchaseTax"
                            onChange={(tax) =>
                                setForm((current) => ({ ...current, tax }))
                            }
                        />
                        <AmountInputRow
                            label="Other cost"
                            value={form.otherCost}
                            inputId="purchaseOtherCost"
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
                            inputId="purchasePaidAmount"
                            invalid={form.paidAmount < 0 || form.paidAmount > total}
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

            <Dialog open={Boolean(editingPurchase)} onOpenChange={(open) => !open && !saving && setEditingPurchase(null)}>
                <DialogContent ref={editPurchaseDialogRef} className="max-h-[94vh] overflow-y-auto sm:max-w-6xl">
                    <DialogHeader>
                        <DialogTitle>Edit {editingPurchase?.purchaseNumber}</DialogTitle>
                        <DialogDescription>
                            Correct products, quantities, costs, lots, or totals. The system safely reverses the old inventory and accounting entries, then posts the corrected purchase. Recorded payments remain unchanged.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="min-w-0 space-y-2 sm:col-span-2">
                            <Label>Supplier</Label>
                            <ServerSearchCombobox<Supplier>
                                value={editSupplier}
                                onValueChange={setEditSupplier}
                                queryKey={["operations", "purchase-edit-supplier-search"]}
                                search={(value) => operationsService.suppliers(value, 20)}
                                getLabel={(item) => item.name}
                                getDescription={(item) => item.phone ?? item.email ?? "Supplier"}
                                placeholder="Search supplier…"
                            />
                        </div>
                        <Field label="Purchase date"><Input data-validation-field="editPurchaseDate" type="date" value={editForm.purchaseDate} onChange={(event) => setEditForm((current) => ({ ...current, purchaseDate: event.target.value }))} /></Field>
                        <Field label="Supplier bill / reference"><Input value={editForm.referenceNumber} onChange={(event) => setEditForm((current) => ({ ...current, referenceNumber: event.target.value }))} /></Field>
                    </div>
                    <Separator />
                    <DocumentLines
                        items={editItems}
                        setItems={setEditItems}
                        mode="purchase"
                        maximumLines={operationPolicy?.maximumPurchaseLines ?? 50}
                        canOverrideLineLimit={operationPolicy?.canOverrideLineLimits ?? false}
                        overrideLineLimit={editLineLimitOverrideEnabled}
                        onOverrideLineLimitChange={setEditLineLimitOverrideEnabled}
                    />
                    <Separator />
                    <div data-validation-field="editPurchaseTotals">
                    <DocumentSettlementLayout
                        notes={editForm.notes}
                        onNotesChange={(notes) => setEditForm((current) => ({ ...current, notes }))}
                        summaryTitle="Corrected purchase totals"
                        summaryDescription="Payments are preserved. The corrected total cannot be less than the amount already paid."
                    >
                        <MoneySummaryRow label="Product lines" value={editLinesNet} />
                        <AmountInputRow inputId="editPurchaseDiscount" label="Discount" value={editForm.discount} onChange={(discount) => setEditForm((current) => ({ ...current, discount }))} />
                        <AmountInputRow inputId="editPurchaseDiscountPercent" label="General discount 1 %" value={editForm.discountPercent} max={100} onChange={(discountPercent) => setEditForm((current) => ({ ...current, discountPercent }))} />
                        <AmountInputRow inputId="editPurchaseSecondaryDiscountPercent" label="General discount 2 %" value={editForm.secondaryDiscountPercent} max={100} onChange={(secondaryDiscountPercent) => setEditForm((current) => ({ ...current, secondaryDiscountPercent }))} />
                        <AmountInputRow inputId="editPurchaseTax" label="Tax" value={editForm.tax} onChange={(tax) => setEditForm((current) => ({ ...current, tax }))} />
                        <AmountInputRow inputId="editPurchaseOtherCost" label="Other cost" value={editForm.otherCost} onChange={(otherCost) => setEditForm((current) => ({ ...current, otherCost }))} />
                        <Separator />
                        <MoneySummaryRow label="Corrected total" value={editTotal} emphasis />
                        <MoneySummaryRow label="Payments preserved" value={editForm.paidAmount} muted />
                        <MoneySummaryRow label="Corrected supplier balance" value={Math.max(0, editTotal - editForm.paidAmount)} muted />
                    </DocumentSettlementLayout>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" disabled={saving} onClick={() => setEditingPurchase(null)}>Cancel</Button>
                        <Button disabled={saving || !editForm.purchaseDate} onClick={() => void savePurchaseEdit()}>{saving ? <LoaderCircle className="animate-spin" /> : <Save />}Apply correction</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={Boolean(deletingPurchase)} onOpenChange={(open) => !open && !saving && setDeletingPurchase(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Delete {deletingPurchase?.purchaseNumber}?</AlertDialogTitle><AlertDialogDescription>The system will reverse its inventory and accounting entries. Deletion is blocked when any received lot has already been sold or reserved.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={saving} onClick={() => void deletePurchase()}>{saving ? <LoaderCircle className="animate-spin" /> : <Trash2 />}Delete purchase</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Sheet open={supplierBulkOpen} onOpenChange={setSupplierBulkOpen}>
                <SheetContent side="right" className="!w-screen !max-w-none border-0">
                    <SheetHeader className="border-b"><SheetTitle>Supplier creation sheet</SheetTitle><SheetDescription>Add several companies/suppliers in one spreadsheet-style entry. Empty rows are ignored.</SheetDescription></SheetHeader>
                    <div className="min-h-0 flex-1 overflow-auto p-4"><div className="min-w-[1150px] overflow-hidden rounded-xl border"><div className="grid grid-cols-[45px_180px_160px_150px_190px_150px_1fr_70px_45px] gap-2 border-b bg-muted/50 p-2 text-xs font-bold"><span>#</span><span>Company *</span><span>Contact</span><span>Phone</span><span>Email</span><span>Tax number</span><span>Address</span><span>Active</span><span /></div>{supplierRows.map((row, index) => <SupplierSheetRow key={index} row={row} index={index} onChange={(next) => setSupplierRows((current) => current.map((item, itemIndex) => itemIndex === index ? next : item))} onRemove={() => setSupplierRows((current) => current.filter((_, itemIndex) => itemIndex !== index))} />)}</div></div>
                    <SheetFooter className="flex-row justify-between border-t"><Button variant="outline" onClick={() => setSupplierRows((current) => [...current, emptySupplier()])}><Plus />Add row</Button><div className="flex gap-2"><Button variant="outline" onClick={() => setSupplierBulkOpen(false)}>Cancel</Button><Button disabled={saving} onClick={() => void saveSupplierSheet()}>{saving ? <LoaderCircle className="animate-spin" /> : <Rows3 />}Save suppliers</Button></div></SheetFooter>
                </SheetContent>
            </Sheet>

            <Dialog open={Boolean(ledgerSupplier)} onOpenChange={(next) => !next && closeSupplierLedger()}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
                    <DialogHeader><DialogTitle>Supplier ledger · {ledgerQuery.data?.supplierName ?? ledgerSupplier?.name}</DialogTitle><DialogDescription>Purchases are debits, payments are credits, and the running balance is the amount still payable.</DialogDescription></DialogHeader>
                    {ledgerQuery.isLoading ? <div className="grid h-40 place-items-center"><LoaderCircle className="size-6 animate-spin" /></div> : ledgerQuery.data ? <SupplierLedgerView ledger={ledgerQuery.data} formatMoney={formatMoney} /> : <p className="p-8 text-center text-destructive">Could not load the supplier ledger.</p>}
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

function SupplierLedgerView({ ledger, formatMoney }: { ledger: SupplierLedger; formatMoney: (value: number, currency?: string) => string }) {
    const money = (value: number) => formatMoney(value, ledger.currencyCode);
    return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Purchases</p><p className="mt-1 text-xl font-bold">{money(ledger.totalPurchases)}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Payments</p><p className="mt-1 text-xl font-bold text-emerald-600">{money(ledger.totalPayments)}</p></div><div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="text-xs text-muted-foreground">Balance payable</p><p className="mt-1 text-xl font-bold text-primary">{money(ledger.closingBalance)}</p></div></div><div className="overflow-x-auto rounded-xl border"><Table className="min-w-[760px]"><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Reference</TableHead><TableHead>Description</TableHead><TableHead className="text-end">Debit</TableHead><TableHead className="text-end">Credit</TableHead><TableHead className="text-end">Balance</TableHead></TableRow></TableHeader><TableBody>{ledger.entries.map((entry, index) => <TableRow key={`${entry.type}-${entry.sourceId}-${index}`}><TableCell>{date(entry.date)}</TableCell><TableCell><Badge variant="outline">{entry.type}</Badge></TableCell><TableCell>{entry.reference}</TableCell><TableCell>{entry.description}</TableCell><TableCell className="text-end">{entry.debit ? money(entry.debit) : "—"}</TableCell><TableCell className="text-end">{entry.credit ? money(entry.credit) : "—"}</TableCell><TableCell className="text-end font-semibold">{money(entry.balance)}</TableCell></TableRow>)}</TableBody></Table></div></div>;
}

function SupplierSheetRow({ row, index, onChange, onRemove }: { row: ReturnType<typeof emptySupplier>; index: number; onChange: (row: ReturnType<typeof emptySupplier>) => void; onRemove: () => void }) { const field = (key: keyof ReturnType<typeof emptySupplier>, value: string | boolean) => onChange({ ...row, [key]: value }); return <div className="grid grid-cols-[45px_180px_160px_150px_190px_150px_1fr_70px_45px] gap-2 border-b p-2 last:border-b-0"><span className="self-center text-center font-semibold text-muted-foreground">{index + 1}</span><Input value={row.name} onChange={(event) => field("name", event.target.value)} /><Input value={row.contactPerson} onChange={(event) => field("contactPerson", event.target.value)} /><Input value={row.phone} onChange={(event) => field("phone", event.target.value)} /><Input type="email" value={row.email} onChange={(event) => field("email", event.target.value)} /><Input value={row.taxNumber} onChange={(event) => field("taxNumber", event.target.value)} /><Input value={row.address} onChange={(event) => field("address", event.target.value)} /><Checkbox checked={row.isActive} onCheckedChange={(checked) => field("isActive", checked === true)} /><Button size="icon" variant="ghost" onClick={onRemove}><Trash2 className="size-4 text-destructive" /></Button></div>; }

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

function stackedLineTotal(item: DocumentItem) {
    return calculateLineNet(item.quantity, item.amount, item.discountPercent);
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
