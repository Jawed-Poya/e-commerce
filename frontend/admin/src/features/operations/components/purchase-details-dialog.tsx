import { CalendarClock, FileText, LoaderCircle, PackageSearch, Truck, type LucideIcon } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useCompany } from "@/features/company/company-context";
import { PaymentBadge } from "@/features/operations/components/payment-ledger-dialog";
import { operationKeys, useOperationQuery } from "@/features/operations/operations-hooks";
import { operationsService } from "@/features/operations/operations-service";
import type { Purchase } from "@/features/operations/operations-types";

interface PurchaseDetailsDialogProps {
    purchase: Purchase | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function PurchaseDetailsDialog({ purchase, open, onOpenChange }: PurchaseDetailsDialogProps) {
    const { formatMoney } = useCompany();
    const { data, isLoading, isError } = useOperationQuery(
        operationKeys.purchase(purchase?.id ?? 0),
        () => operationsService.purchase(purchase!.id),
        open && Boolean(purchase),
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><FileText className="size-5" />Purchase details</DialogTitle>
                    <DialogDescription>Review the supplier document and every received item, unit, lot number, and expiry date.</DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="grid min-h-64 place-items-center"><LoaderCircle className="size-7 animate-spin text-muted-foreground" /></div>
                ) : isError || !data ? (
                    <div className="grid min-h-64 place-items-center text-sm text-destructive">Purchase details could not be loaded.</div>
                ) : (
                    <div className="space-y-5">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <Info label="Purchase" value={data.purchaseNumber} />
                            <Info label="Purchase date" value={formatDate(data.purchaseDate)} icon={CalendarClock} />
                            <Info label="Supplier" value={data.supplierName ?? "Direct purchase"} icon={Truck} />
                            <div className="rounded-xl border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Payment status</p><div className="mt-2"><PaymentBadge status={data.paymentStatus} /></div></div>
                        </div>

                        <div className="overflow-x-auto rounded-xl border">
                            <Table className="min-w-[1020px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Product</TableHead>
                                        <TableHead>Lot number</TableHead>
                                        <TableHead>Expiry</TableHead>
                                        <TableHead className="text-end">Received quantity</TableHead>
                                        <TableHead>Unit</TableHead>
                                        <TableHead className="text-end">Unit cost</TableHead>
                                        <TableHead className="text-end">Base quantity</TableHead>
                                        <TableHead className="text-end">Line total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.items.length ? data.items.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <p className="font-medium">{item.productName}</p>
                                                <p className="mt-0.5 text-[11px] text-muted-foreground">{[item.strength, item.barcode].filter(Boolean).join(" · ") || "No strength or barcode"}</p>
                                            </TableCell>
                                            <TableCell>{item.lotNumber || "—"}</TableCell>
                                            <TableCell>{item.expireDate ? formatDate(item.expireDate) : "—"}</TableCell>
                                            <TableCell className="text-end font-medium tabular-nums">{number(item.enteredQuantity)}</TableCell>
                                            <TableCell>{item.selectedUnitName || "Base unit"}{item.unitConversionFactor !== 1 ? <p className="text-[11px] text-muted-foreground">1 unit = {number(item.unitConversionFactor)} base</p> : null}</TableCell>
                                            <TableCell className="text-end tabular-nums">{formatMoney(item.enteredUnitCost, data.currencyCode)}</TableCell>
                                            <TableCell className="text-end tabular-nums text-muted-foreground">{number(item.quantity)}</TableCell>
                                            <TableCell className="text-end font-semibold tabular-nums">{formatMoney(item.lineTotal, data.currencyCode)}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow><TableCell colSpan={8} className="h-40 text-center text-muted-foreground"><PackageSearch className="mx-auto mb-2 size-6" />No purchase items were found.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
                            <div className="rounded-xl border bg-muted/20 p-4">
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Supplier bill / reference</p>
                                <p className="mt-1 font-medium">{data.referenceNumber || "—"}</p>
                                <Separator className="my-4" />
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{data.notes || "No notes were added."}</p>
                            </div>
                            <div className="space-y-2 rounded-xl border p-4">
                                <Money label="Subtotal" value={data.subtotal} format={(value) => formatMoney(value, data.currencyCode)} />
                                <Money label="Discount" value={-data.discount} format={(value) => formatMoney(value, data.currencyCode)} />
                                <Money label="Tax" value={data.tax} format={(value) => formatMoney(value, data.currencyCode)} />
                                <Money label="Other cost" value={data.otherCost} format={(value) => formatMoney(value, data.currencyCode)} />
                                <Separator />
                                <Money label="Total" value={data.total} format={(value) => formatMoney(value, data.currencyCode)} strong />
                                <Money label="Paid" value={data.paidAmount} format={(value) => formatMoney(value, data.currencyCode)} />
                                <Money label="Remaining" value={data.remainingAmount} format={(value) => formatMoney(value, data.currencyCode)} strong />
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function Info({ label, value, icon: Icon }: { label: string; value: string; icon?: LucideIcon }) {
    return <div className="rounded-xl border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 flex items-center gap-1.5 font-medium">{Icon ? <Icon className="size-3.5 text-muted-foreground" /> : null}{value}</p></div>;
}

function Money({ label, value, format, strong = false }: { label: string; value: number; format: (value: number) => string; strong?: boolean }) {
    return <div className="flex items-center justify-between gap-4 text-sm"><span className="text-muted-foreground">{label}</span><span className={strong ? "font-semibold" : "font-medium"}>{format(value)}</span></div>;
}

function number(value: number) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}
