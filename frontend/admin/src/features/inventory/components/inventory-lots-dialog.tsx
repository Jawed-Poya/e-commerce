import { AlertTriangle, CalendarClock, Layers3, LoaderCircle, PackageSearch, Warehouse } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useInventoryLots } from "@/features/inventory/hooks/use-inventory";
import type { InventoryListItem } from "@/features/inventory/types/inventory-types";
import { cn } from "@/lib/utils";
import { toFiniteNumber } from "@/lib/numbers";

interface InventoryLotsDialogProps {
    item: InventoryListItem | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function InventoryLotsDialog({ item, open, onOpenChange }: InventoryLotsDialogProps) {
    const { data: lots = [], isLoading, isError } = useInventoryLots(open ? item?.productId ?? null : null);
    const lotQuantity = lots.reduce((sum, lot) => sum + toFiniteNumber(lot.quantity), 0);
    const unallocatedQuantity = item ? toFiniteNumber(item.quantity) - lotQuantity : 0;
    const hasUnallocatedQuantity = Math.abs(unallocatedQuantity) >= 0.0005;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Layers3 className="size-5" />
                        Stock by lot
                    </DialogTitle>
                    <DialogDescription>
                        {item ? `${item.name}${item.strength ? ` · ${item.strength}` : ""}` : "Product lot inventory"}. Quantities are stored in the base inventory unit and ordered by FEFO expiry priority.
                    </DialogDescription>
                </DialogHeader>

                {item ? (
                    <div className="grid gap-3 sm:grid-cols-4">
                        <Summary label="Active lots" value={item.activeLotCount} />
                        <Summary label="On hand" value={item.quantity} />
                        <Summary label="Reserved" value={item.reservedQuantity} />
                        <Summary label="Available" value={item.availableQuantity} emphasis />
                    </div>
                ) : null}

                {!isLoading && !isError && hasUnallocatedQuantity ? (
                    <div className="flex gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-sm">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
                        <div>
                            <p className="font-medium">Lot quantity does not match total inventory.</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                {formatNumber(Math.abs(unallocatedQuantity))} units are {unallocatedQuantity > 0 ? "not assigned to a lot" : "recorded in lots above the product total"}. This usually comes from historical data or a manual stock adjustment.
                            </p>
                        </div>
                    </div>
                ) : null}

                {isLoading ? (
                    <div className="grid min-h-48 place-items-center"><LoaderCircle className="size-6 animate-spin text-muted-foreground" /></div>
                ) : isError ? (
                    <div className="grid min-h-48 place-items-center text-sm text-destructive">Lot inventory could not be loaded.</div>
                ) : lots.length === 0 ? (
                    <div className="grid min-h-48 place-items-center rounded-xl border border-dashed text-center text-sm text-muted-foreground">
                        <div><PackageSearch className="mx-auto mb-2 size-7" />No active lot quantities were found.</div>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border">
                        <Table className="min-w-[820px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Lot number</TableHead>
                                    <TableHead>Warehouse</TableHead>
                                    <TableHead>Expiry</TableHead>
                                    <TableHead className="text-end">On hand</TableHead>
                                    <TableHead className="text-end">Reserved</TableHead>
                                    <TableHead className="text-end">Available</TableHead>
                                    <TableHead className="text-end">Unit cost</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lots.map((lot) => (
                                    <TableRow key={lot.id} className={cn(lot.isExpired && "bg-destructive/5")}>
                                        <TableCell>
                                            <p className="font-medium">{lot.lotNumber || "Unnumbered lot"}</p>
                                            <p className="mt-0.5 text-[11px] text-muted-foreground">Received {formatDateTime(lot.createdAt)}</p>
                                        </TableCell>
                                        <TableCell><span className="inline-flex items-center"><Warehouse className="me-1.5 size-3.5 text-muted-foreground" />{lot.warehouseName}</span></TableCell>
                                        <TableCell>
                                            {lot.expiresAt ? (
                                                <div>
                                                    <span className="inline-flex items-center"><CalendarClock className="me-1.5 size-3.5" />{formatDate(lot.expiresAt)}</span>
                                                    {lot.isExpired ? <Badge className="ms-2" variant="destructive">Expired</Badge> : lot.isExpiringSoon ? <Badge className="ms-2 border-amber-500/40 bg-amber-500/10 text-amber-700" variant="outline">Expiring soon</Badge> : null}
                                                </div>
                                            ) : <span className="text-muted-foreground">No expiry</span>}
                                        </TableCell>
                                        <NumberCell value={lot.quantity} />
                                        <NumberCell value={lot.reservedQuantity} muted />
                                        <NumberCell value={lot.availableQuantity} strong />
                                        <NumberCell value={lot.unitCost} muted />
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function Summary({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) {
    return <div className="rounded-xl border bg-muted/25 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={cn("mt-1 text-xl font-semibold tabular-nums", emphasis && "text-primary")}>{formatNumber(value)}</p></div>;
}

function NumberCell({ value, muted = false, strong = false }: { value: number | null; muted?: boolean; strong?: boolean }) {
    return <TableCell className={cn("text-end tabular-nums", muted && "text-muted-foreground", strong && "font-semibold text-primary")}>{value === null ? "—" : formatNumber(value)}</TableCell>;
}

function formatNumber(value: number) {
    return toFiniteNumber(value).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatDateTime(value: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}
