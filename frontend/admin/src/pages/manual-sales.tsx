import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    CircleDollarSign,
    CreditCard,
    Layers3,
    LoaderCircle,
    Save,
    TrendingDown,
    TrendingUp,
    TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { ListPagination } from "@/components/list-pagination";
import { PageHeader } from "@/components/page-header";
import { ServerSearchCombobox } from "@/components/server-search-combobox";
import { SimpleCombobox } from "@/components/simple-combobox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { useAdminAuth } from "@/features/auth/auth-context";
import { hasPermission, Permissions } from "@/features/auth/permissions";
import { useCompany } from "@/features/company/company-context";
import { ReceiptActions } from "@/features/company/receipt-actions";
import { formatPercent } from "@/lib/numbers";
import { WhatsAppLink } from "@/features/customers/whatsapp-link";
import { useI18n } from "@/i18n/i18n-provider";
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
import {
    operationKeys,
    useOperationQuery,
} from "@/features/operations/operations-hooks";
import { operationsService } from "@/features/operations/operations-service";
import type {
    DocumentItem,
    ManualSale,
    ManualSaleLotMovement,
    OperationCustomer,
} from "@/features/operations/operations-types";

const today = () => new Date().toISOString().slice(0, 10);

export default function ManualSalesPage() {
    const queryClient = useQueryClient();
    const { formatMoney } = useCompany();
    const { locale, t, tr } = useI18n();
    const { user } = useAdminAuth();
    const canManage = hasPermission(user, Permissions.ManualSalesManage);
    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search.trim());
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const { data: salePage, isLoading } = useOperationQuery(
        operationKeys.sales(deferredSearch, page, pageSize),
        () => operationsService.sales(deferredSearch, page, pageSize),
    );
    const sales = salePage?.items;

    useEffect(() => {
        setPage(1);
    }, [deferredSearch]);
    const { data: operationPolicy } = useOperationQuery(
        operationKeys.policy,
        operationsService.policy,
    );
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [lineLimitOverrideEnabled, setLineLimitOverrideEnabled] = useState(false);
    const [selectedSale, setSelectedSale] = useState<ManualSale | null>(null);
    const [lotSale, setLotSale] = useState<ManualSale | null>(null);
    const { data: saleLots, isLoading: saleLotsLoading } = useOperationQuery(
        operationKeys.saleLots(lotSale?.id ?? 0),
        () => operationsService.saleLots(lotSale!.id),
        Boolean(lotSale),
    );

    const [selectedCustomer, setSelectedCustomer] =
        useState<OperationCustomer | null>(null);
    const [items, setItems] = useState<DocumentItem[]>([newDocumentItem()]);
    const [form, setForm] = useState({
        customerName: "",
        customerPhone: "",
        saleDate: today(),
        discount: 0,
        discountPercent: 0,
        secondaryDiscountPercent: 0,
        tax: 0,
        paidAmount: 0,
        paymentMethod: "Cash",
        paymentReferenceNumber: "",
        referenceNumber: "",
        notes: "",
        useCustomerCredit: true,
        debtDueDate: "",
    });

    const subtotal = useMemo(
        () => items.reduce((sum, item) => sum + item.quantity * item.amount, 0),
        [items],
    );
    const linesNet = useMemo(
        () => items.reduce((sum, item) => sum + stackedLineTotal(item), 0),
        [items],
    );
    const effectiveDiscountPercent = form.discountPercent > 0
        ? form.discountPercent
        : operationPolicy?.generalSalesDiscountPercent ?? 0;
    const discountedSubtotal = calculateStackedDiscountNet(linesNet, effectiveDiscountPercent, form.secondaryDiscountPercent);
    const total = Math.max(0, discountedSubtotal - form.discount + form.tax);
    const creditApplied = selectedCustomer && form.useCustomerCredit
        ? Math.min(selectedCustomer.accountCredit, Math.max(0, total - form.paidAmount))
        : 0;
    const remaining = Math.max(0, total - form.paidAmount - creditApplied);
    const profitPreview = useMemo(() => {
        const saleItems = getSubmittableDocumentLines(items);
        if (!saleItems.length || saleItems.some((item) => !isDocumentLineComplete(item))) {
            return null;
        }

        let costOfGoods = 0;
        let missingCostCount = 0;

        for (const item of saleItems) {
            const currentUnitCost = item.product?.currentUnitCost;
            if (currentUnitCost == null || currentUnitCost <= 0) {
                missingCostCount += 1;
                continue;
            }

            const baseQuantity =
                item.quantity * Math.max(item.conversionFactor, 0.000001);
            costOfGoods += baseQuantity * currentUnitCost;
        }

        const netSales = Math.max(0, discountedSubtotal - form.discount);
        const grossProfit = netSales - costOfGoods;
        const profitMargin =
            netSales > 0 ? (grossProfit / netSales) * 100 : 0;

        return {
            costOfGoods,
            netSales,
            grossProfit,
            profitMargin,
            missingCostCount,
        };
    }, [discountedSubtotal, form.discount, items]);
    const negativeStockPreview = useMemo(() => {
        if (!operationPolicy?.allowNegativeStockSales) return [];
        return getSubmittableDocumentLines(items).flatMap((item) => {
            if (!item.product || !isDocumentLineComplete(item)) return [];
            const requested = item.quantity * Math.max(item.conversionFactor, 0.000001);
            const available = item.product.availableQuantity;
            if (requested <= available) return [];
            return [{
                id: item.productId,
                name: item.product.name,
                available,
                afterSale: available - requested,
                unit: item.product.baseUnitName ?? tr("base units"),
            }];
        });
    }, [items, operationPolicy?.allowNegativeStockSales, tr]);

    const reset = () => {
        setSelectedCustomer(null);
        setItems([newDocumentItem()]);
        setLineLimitOverrideEnabled(false);
        setForm({
            customerName: "",
            customerPhone: "",
            saleDate: today(),
            discount: 0,
            discountPercent: 0,
            secondaryDiscountPercent: 0,
            tax: 0,
            paidAmount: 0,
            paymentMethod: "Cash",
            paymentReferenceNumber: "",
            referenceNumber: "",
            notes: "",
            useCustomerCredit: true,
            debtDueDate: "",
        });
    };

    const submit = async () => {
        if (!canManage) return;
        const documentItems = getSubmittableDocumentLines(items);
        const configuredLineLimit = operationPolicy?.maximumManualSaleLines ?? 50;
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
            return toast.error(tr("Complete every sale line."));
        }
        if (
            new Set(documentItems.map((item) => item.productId)).size !==
            documentItems.length
        ) {
            return toast.error(tr("Each product may appear only once."));
        }
        for (const item of documentItems) {
            const product = item.product;
            if (!product) continue;
            const baseQuantity = item.quantity * Math.max(item.conversionFactor, 0.000001);
            if (!operationPolicy?.allowNegativeStockSales && baseQuantity > product.availableQuantity) {
                return toast.error(
                    `${product.name}: ${tr("Available quantity")} ${product.availableQuantity} ${product.baseUnitName ?? tr("base units")}.`,
                );
            }
        }
        if (form.paidAmount < 0 || (!selectedCustomer && form.paidAmount > total)) {
            return toast.error(
                tr("A walk-in payment must be between zero and the sale total. Registered-customer overpayments are saved as account credit."),
            );
        }

        setSaving(true);
        try {
            const response = await operationsService.createSale({
                overrideLineLimit: lineLimitOverrideEnabled,
                customerId: selectedCustomer?.id ?? null,
                customerName: selectedCustomer
                    ? null
                    : nullable(form.customerName),
                customerPhone: selectedCustomer
                    ? null
                    : nullable(form.customerPhone),
                saleDate: form.saleDate,
                discount: form.discount,
                discountPercent: form.discountPercent,
                secondaryDiscountPercent: form.secondaryDiscountPercent,
                tax: form.tax,
                paidAmount: form.paidAmount,
                paymentMethod: form.paymentMethod,
                paymentReferenceNumber: nullable(form.paymentReferenceNumber),
                referenceNumber: nullable(form.referenceNumber),
                notes: nullable(form.notes),
                useCustomerCredit: form.useCustomerCredit,
                debtDueDate: form.debtDueDate || null,
                items: documentItems.map((item) => ({
                    productId: item.productId,
                    unitId: item.unitId,
                    quantity: item.quantity,
                    unitPrice: item.amount,
                    bonusQuantity: item.bonusQuantity,
                    discountPercent: item.discountPercent,
                })),
            });
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: operationKeys.saleRoot }),
                queryClient.invalidateQueries({ queryKey: operationKeys.summary }),
                queryClient.invalidateQueries({ queryKey: ["inventory"] }),
            ]);
            if (response.offlineQueued || !response.data) {
                toast.success(response.message?.trim() || "Sale saved and will sync when the connection returns.");
            } else if (response.data.grossProfit > 0.005) {
                toast.success(
                    `Sale recorded · Gross profit ${formatMoney(response.data.grossProfit)} (${formatPercent(response.data.profitMargin)} margin).`,
                );
            } else if (response.data.grossProfit < -0.005) {
                toast.warning(
                    `Sale recorded with a gross loss of ${formatMoney(Math.abs(response.data.grossProfit))}. Review the selling price and cost.`,
                );
            } else {
                toast.info("Sale recorded at break-even — no gross profit or loss.");
            }
            setOpen(false);
            reset();
            if (!response.offlineQueued && response.data) {
                setLotSale(response.data);
            }
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

            <div className="max-w-xl">
                <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search sale, receipt reference, customer, product or barcode…"
                />
            </div>

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
                                <TableHead>Gross result</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <Loading colSpan={10} />
                            ) : sales?.length ? (
                                sales.map((sale) => (
                                    <TableRow key={sale.id}>
                                        <TableCell className="font-medium">
                                            <p>{sale.saleNumber}</p>
                                            {sale.referenceNumber ? (
                                                <p className="text-xs font-normal text-muted-foreground">
                                                    Reference: {sale.referenceNumber}
                                                </p>
                                            ) : null}
                                        </TableCell>
                                        <TableCell>{date(sale.saleDate)}</TableCell>
                                        <TableCell>
                                            <p>{sale.customerName}</p>
                                            {sale.customerPhone ? (
                                                <p className="text-xs text-muted-foreground">
                                                    {sale.customerPhone}
                                                </p>
                                            ) : null}
                                        </TableCell>
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
                                            <SaleProfitResult sale={sale} formatMoney={formatMoney} />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex justify-end gap-2">
                                                <WhatsAppLink
                                                    url={sale.whatsAppUrl}
                                                    customerName={sale.customerName}
                                                    compact
                                                />
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setLotSale(sale)}
                                                >
                                                    <Layers3 className="me-2 size-4" />
                                                    {t("inventory.lotBatch")}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setSelectedSale(sale)}
                                                >
                                                    <CreditCard className="me-2 size-4" />
                                                    Payments
                                                </Button>
                                                <ReceiptActions source="manual-sales" id={sale.id} compact />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <Empty
                                    colSpan={10}
                                    text="No manual sales have been recorded."
                                />
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
                <ListPagination
                    page={page}
                    pageSize={pageSize}
                    totalCount={salePage?.totalCount ?? 0}
                    totalPages={salePage?.totalPages}
                    disabled={isLoading}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        setPage(1);
                    }}
                />
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

                    <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="min-w-0 space-y-2 sm:col-span-2">
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
                                    } · Debt ${formatMoney(customer.outstandingDebt)} · Credit ${formatMoney(customer.accountCredit)}`
                                }
                                placeholder="Search customer name, phone or email…"
                            />
                            {selectedCustomer ? (
                                <div className="flex flex-wrap items-center gap-2">
                                    <WhatsAppLink
                                        url={selectedCustomer.whatsAppUrl}
                                        customerName={selectedCustomer.name}
                                        className="w-full sm:w-auto"
                                    />
                                    <span className={selectedCustomer.hasOverdueDebt ? "text-xs font-semibold text-destructive" : "text-xs text-muted-foreground"}>
                                        Debt {formatMoney(selectedCustomer.outstandingDebt)} / {formatMoney(selectedCustomer.creditLimit)}
                                    </span>
                                </div>
                            ) : null}
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
                        <Field label="Sale receipt / external reference">
                            <Input
                                value={form.referenceNumber}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        referenceNumber: event.target.value,
                                    }))
                                }
                                placeholder="Optional external receipt or bill number"
                            />
                        </Field>
                    </div>

                    <Separator />
                    <DocumentLines
                        items={items}
                        setItems={setItems}
                        mode="sale"
                        maximumLines={operationPolicy?.maximumManualSaleLines ?? 50}
                        canOverrideLineLimit={operationPolicy?.canOverrideLineLimits ?? false}
                        overrideLineLimit={lineLimitOverrideEnabled}
                        onOverrideLineLimitChange={setLineLimitOverrideEnabled}
                        allowNegativeStock={operationPolicy?.allowNegativeStockSales ?? false}
                    />
                    {negativeStockPreview.length ? (
                        <Alert className="border-amber-500/35 bg-amber-500/5 text-amber-950 dark:text-amber-100">
                            <TriangleAlert className="text-amber-600" />
                            <AlertTitle>Negative stock will be recorded</AlertTitle>
                            <AlertDescription>
                                <p>This sale is allowed. The inventory balance will remain negative until a purchase for the product is received.</p>
                                <ul className="mt-2 space-y-1 text-xs">
                                    {negativeStockPreview.map((item) => <li key={item.id}><strong>{item.name}</strong>: {item.available.toLocaleString()} → {item.afterSale.toLocaleString()} {item.unit}</li>)}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    ) : null}
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
                        <AmountInputRow label={`General discount 1 %${form.discountPercent === 0 && (operationPolicy?.generalSalesDiscountPercent ?? 0) > 0 ? ` (default ${operationPolicy?.generalSalesDiscountPercent}%)` : ""}`} value={form.discountPercent} max={100} onChange={(discountPercent) => setForm((current) => ({ ...current, discountPercent }))} />
                        <AmountInputRow label="General discount 2 %" value={form.secondaryDiscountPercent} max={100} onChange={(secondaryDiscountPercent) => setForm((current) => ({ ...current, secondaryDiscountPercent }))} />
                        <AmountInputRow
                            label="Tax"
                            value={form.tax}
                            onChange={(tax) =>
                                setForm((current) => ({ ...current, tax }))
                            }
                        />
                        {selectedCustomer ? (
                            <label className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                                <Checkbox checked={form.useCustomerCredit} onCheckedChange={(checked) => setForm((current) => ({ ...current, useCustomerCredit: checked === true }))} />
                                <span><strong className="block">Use account credit</strong><span className="text-xs text-muted-foreground">Available {formatMoney(selectedCustomer.accountCredit)} · applying {formatMoney(creditApplied)}</span></span>
                            </label>
                        ) : null}
                        {remaining > 0 && selectedCustomer ? <Field label="Debt due date"><Input type="date" value={form.debtDueDate} onChange={(event) => setForm((current) => ({ ...current, debtDueDate: event.target.value }))} /></Field> : null}
                        <Separator />
                        <MoneySummaryRow label="Sale total" value={total} emphasis />
                        {profitPreview ? (
                            <SaleProfitPreview
                                preview={profitPreview}
                                formatMoney={formatMoney}
                                tr={tr}
                            />
                        ) : null}
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

            <Dialog open={Boolean(lotSale)} onOpenChange={(next) => !next && setLotSale(null)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{t("orders.lotTraceability")}</DialogTitle>
                        <DialogDescription>
                            {lotSale?.saleNumber} · {t("orders.lotTraceabilityHelp")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="overflow-x-auto border">
                        <Table className="min-w-[720px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t("orders.product")}</TableHead>
                                    <TableHead>{t("inventory.lotBatch")}</TableHead>
                                    <TableHead>{t("orders.warehouse")}</TableHead>
                                    <TableHead>{t("orders.expiry")}</TableHead>
                                    <TableHead className="text-end">{t("orders.baseQuantity")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {saleLotsLoading ? <Loading colSpan={5} /> : saleLots?.length ? saleLots.map((movement: ManualSaleLotMovement) => (
                                    <TableRow key={movement.id}>
                                        <TableCell className="font-medium">{movement.productName}</TableCell>
                                        <TableCell>{movement.lotNumber || `${t("inventory.unnumberedLot")} #${movement.inventoryLotId ?? movement.id}`}</TableCell>
                                        <TableCell>{movement.warehouseName}</TableCell>
                                        <TableCell>{movement.expiresAt ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${movement.expiresAt}T00:00:00Z`)) : "—"}</TableCell>
                                        <TableCell className="text-end font-semibold tabular-nums">{movement.quantity.toLocaleString(locale, { maximumFractionDigits: 3 })}</TableCell>
                                    </TableRow>
                                )) : <Empty colSpan={5} text={t("inventory.unassignedLot")} />}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>

            {selectedSale ? (
                <PaymentLedgerDialog<ManualSale>
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
                    onDocumentUpdated={setSelectedSale}
                    invalidate={[operationKeys.saleRoot, operationKeys.summary]}
                    canManage={canManage}
                />
            ) : null}
        </div>
    );
}

function SaleProfitResult({ sale, formatMoney }: { sale: ManualSale; formatMoney: (value: number) => string }) {
    if (sale.grossProfit > 0.005) {
        return (
            <div className="min-w-28">
                <p className="font-semibold text-emerald-600 dark:text-emerald-400">Profit {formatMoney(sale.grossProfit)}</p>
                <p className="text-xs text-muted-foreground">{formatPercent(sale.profitMargin)} gross margin</p>
            </div>
        );
    }
    if (sale.grossProfit < -0.005) {
        return (
            <div className="min-w-28">
                <p className="font-semibold text-destructive">Loss {formatMoney(Math.abs(sale.grossProfit))}</p>
                <p className="text-xs text-muted-foreground">Review price vs. cost</p>
            </div>
        );
    }
    return <span className="text-sm font-medium text-muted-foreground">Break-even</span>;
}

function SaleProfitPreview({
    preview,
    formatMoney,
    tr,
}: {
    preview: {
        costOfGoods: number;
        netSales: number;
        grossProfit: number;
        profitMargin: number;
        missingCostCount: number;
    };
    formatMoney: (value: number) => string;
    tr: (value: string) => string;
}) {
    if (preview.missingCostCount > 0) {
        return (
            <Alert className="rounded-xl border-amber-500/30 bg-amber-500/[0.06] text-amber-950 dark:text-amber-100">
                <TriangleAlert className="text-amber-600 dark:text-amber-400" />
                <AlertTitle>{tr("Profit estimate needs cost data")}</AlertTitle>
                <AlertDescription>
                    {preview.missingCostCount} {tr("selected product(s) have no current inventory cost. The final sale will still be recalculated by the server.")}
                </AlertDescription>
            </Alert>
        );
    }

    const isProfit = preview.grossProfit > 0.005;
    const isLoss = preview.grossProfit < -0.005;

    if (!isProfit && !isLoss) {
        return (
            <Alert className="rounded-xl border-border bg-muted/35">
                <CircleDollarSign className="text-muted-foreground" />
                <AlertTitle>{tr("Expected break-even sale")}</AlertTitle>
                <AlertDescription>
                    {tr("No gross profit or loss is expected at the current price.")}
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <Alert
            variant={isLoss ? "destructive" : "default"}
            className={
                isLoss
                    ? "rounded-xl border-destructive/35 bg-destructive/[0.05]"
                    : "rounded-xl border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-950 dark:text-emerald-100"
            }
        >
            {isLoss ? (
                <TrendingDown className="text-destructive" />
            ) : (
                <TrendingUp className="text-emerald-600 dark:text-emerald-400" />
            )}
            <AlertTitle>
                {isLoss ? tr("Expected gross loss") : tr("Expected gross profit")}
            </AlertTitle>
            <AlertDescription className="space-y-1">
                <p className="font-semibold text-current">
                    {formatMoney(Math.abs(preview.grossProfit))} · {formatPercent(preview.profitMargin)} {tr("margin")}
                </p>
                <p>
                    {tr("Net sales")} {formatMoney(preview.netSales)} · {tr("Cost of goods sold")} {formatMoney(preview.costOfGoods)}
                </p>
                {isLoss ? (
                    <p className="font-medium text-current">
                        {tr("This selling price is below the current inventory cost. Review the price before completing the sale.")}
                    </p>
                ) : null}
            </AlertDescription>
        </Alert>
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
    return (
        (error as { response?: { data?: { message?: string } }; message?: string })
            .response?.data?.message ??
        (error as Error).message ??
        "The operation failed."
    );
}
