import {
    AlertTriangle,
    CalendarClock,
    Layers3,
    LoaderCircle,
    PackageSearch,
    Warehouse,
} from "lucide-react";

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
import { useI18n } from "@/i18n/i18n-provider";
import { toFiniteNumber } from "@/lib/numbers";
import { cn } from "@/lib/utils";

interface InventoryLotsDialogProps {
    item: InventoryListItem | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function InventoryLotsDialog({ item, open, onOpenChange }: InventoryLotsDialogProps) {
    const { locale, t, tf } = useI18n();
    const { data: lots = [], isLoading, isError } = useInventoryLots(
        open ? item?.productId ?? null : null,
    );
    const lotQuantity = lots.reduce((sum, lot) => sum + toFiniteNumber(lot.quantity), 0);
    const unallocatedQuantity = item ? toFiniteNumber(item.quantity) - lotQuantity : 0;
    const hasUnallocatedQuantity = Math.abs(unallocatedQuantity) >= 0.0005;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Layers3 className="size-5" />
                        {t("inventory.lotDialogTitle")}
                    </DialogTitle>
                    <DialogDescription>
                        {item
                            ? `${item.name}${item.strength ? ` · ${item.strength}` : ""}`
                            : t("inventory.lotDialogFallback")}
                        . {t("inventory.lotDialogDescription")}
                    </DialogDescription>
                </DialogHeader>

                {item ? (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <Summary
                            label={t("inventory.activeLots")}
                            value={item.activeLotCount}
                            locale={locale}
                        />
                        <Summary
                            label={t("inventory.onHand")}
                            value={item.quantity}
                            locale={locale}
                        />
                        <Summary
                            label={t("inventory.reserved")}
                            value={item.reservedQuantity}
                            locale={locale}
                        />
                        <Summary
                            label={t("inventory.available")}
                            value={item.availableQuantity}
                            locale={locale}
                            emphasis
                        />
                    </div>
                ) : null}

                {!isLoading && !isError && hasUnallocatedQuantity ? (
                    <div className="flex gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-sm">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
                        <div>
                            <p className="font-medium">{t("inventory.lotMismatchTitle")}</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                {tf(
                                    unallocatedQuantity > 0
                                        ? "inventory.lotUnallocated"
                                        : "inventory.lotOverallocated",
                                    {
                                        count: formatNumber(
                                            Math.abs(unallocatedQuantity),
                                            locale,
                                        ),
                                    },
                                )}
                            </p>
                        </div>
                    </div>
                ) : null}

                {isLoading ? (
                    <div className="grid min-h-48 place-items-center">
                        <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
                    </div>
                ) : isError ? (
                    <div className="grid min-h-48 place-items-center text-sm text-destructive">
                        {t("inventory.lotsLoadError")}
                    </div>
                ) : lots.length === 0 ? (
                    <div className="grid min-h-48 place-items-center rounded-xl border border-dashed text-center text-sm text-muted-foreground">
                        <div>
                            <PackageSearch className="mx-auto mb-2 size-7" />
                            {t("inventory.noActiveLots")}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="grid gap-3 xl:hidden">
                            {lots.map((lot) => (
                                <article
                                    key={lot.id}
                                    className={cn(
                                        "rounded-xl border bg-card p-4",
                                        lot.isExpired && "border-destructive/25 bg-destructive/5",
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate font-medium">
                                                {lot.lotNumber || t("inventory.unnumberedLot")}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {tf("inventory.received", {
                                                    date: formatDateTime(lot.createdAt, locale),
                                                })}
                                            </p>
                                        </div>
                                        <ExpiryBadge
                                            expiresAt={lot.expiresAt}
                                            isExpired={lot.isExpired}
                                            isExpiringSoon={lot.isExpiringSoon}
                                            locale={locale}
                                        />
                                    </div>

                                    <div className="mt-3 flex items-center text-sm text-muted-foreground">
                                        <Warehouse className="me-1.5 size-3.5" />
                                        <span className="truncate">{lot.warehouseName}</span>
                                    </div>

                                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        <Metric
                                            label={t("inventory.onHand")}
                                            value={formatNumber(lot.quantity, locale)}
                                        />
                                        <Metric
                                            label={t("inventory.reserved")}
                                            value={formatNumber(lot.reservedQuantity, locale)}
                                            muted
                                        />
                                        <Metric
                                            label={t("inventory.available")}
                                            value={formatNumber(lot.availableQuantity, locale)}
                                            strong
                                        />
                                        <Metric
                                            label={t("inventory.unitCost")}
                                            value={
                                                lot.unitCost === null
                                                    ? "—"
                                                    : formatNumber(lot.unitCost, locale)
                                            }
                                            muted
                                        />
                                    </div>
                                </article>
                            ))}
                        </div>

                        <div className="hidden overflow-hidden rounded-xl border xl:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t("inventory.lotNumber")}</TableHead>
                                        <TableHead>{t("inventory.warehouse")}</TableHead>
                                        <TableHead>{t("inventory.expiryDate")}</TableHead>
                                        <TableHead className="text-end">
                                            {t("inventory.onHand")}
                                        </TableHead>
                                        <TableHead className="text-end">
                                            {t("inventory.reserved")}
                                        </TableHead>
                                        <TableHead className="text-end">
                                            {t("inventory.available")}
                                        </TableHead>
                                        <TableHead className="text-end">
                                            {t("inventory.unitCost")}
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {lots.map((lot) => (
                                        <TableRow
                                            key={lot.id}
                                            className={cn(lot.isExpired && "bg-destructive/5")}
                                        >
                                            <TableCell>
                                                <p className="font-medium">
                                                    {lot.lotNumber || t("inventory.unnumberedLot")}
                                                </p>
                                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                                    {tf("inventory.received", {
                                                        date: formatDateTime(lot.createdAt, locale),
                                                    })}
                                                </p>
                                            </TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center">
                                                    <Warehouse className="me-1.5 size-3.5 text-muted-foreground" />
                                                    {lot.warehouseName}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <ExpiryBadge
                                                    expiresAt={lot.expiresAt}
                                                    isExpired={lot.isExpired}
                                                    isExpiringSoon={lot.isExpiringSoon}
                                                    locale={locale}
                                                />
                                            </TableCell>
                                            <NumberCell value={lot.quantity} locale={locale} />
                                            <NumberCell
                                                value={lot.reservedQuantity}
                                                locale={locale}
                                                muted
                                            />
                                            <NumberCell
                                                value={lot.availableQuantity}
                                                locale={locale}
                                                strong
                                            />
                                            <NumberCell
                                                value={lot.unitCost}
                                                locale={locale}
                                                muted
                                            />
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function ExpiryBadge({
    expiresAt,
    isExpired,
    isExpiringSoon,
    locale,
}: {
    expiresAt: string | null;
    isExpired: boolean;
    isExpiringSoon: boolean;
    locale: string;
}) {
    const { t } = useI18n();

    if (!expiresAt) {
        return <span className="text-sm text-muted-foreground">{t("inventory.noExpiry")}</span>;
    }

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center text-sm">
                <CalendarClock className="me-1.5 size-3.5" />
                {formatDate(expiresAt, locale)}
            </span>
            {isExpired ? (
                <Badge variant="destructive">{t("inventory.expired")}</Badge>
            ) : isExpiringSoon ? (
                <Badge
                    className="border-amber-500/40 bg-amber-500/10 text-amber-700"
                    variant="outline"
                >
                    {t("inventory.expiringSoon")}
                </Badge>
            ) : null}
        </div>
    );
}

function Summary({
    label,
    value,
    locale,
    emphasis = false,
}: {
    label: string;
    value: number;
    locale: string;
    emphasis?: boolean;
}) {
    return (
        <div className="rounded-xl border bg-muted/25 p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p
                className={cn(
                    "mt-1 text-xl font-semibold tabular-nums",
                    emphasis && "text-primary",
                )}
            >
                {formatNumber(value, locale)}
            </p>
        </div>
    );
}

function Metric({
    label,
    value,
    muted = false,
    strong = false,
}: {
    label: string;
    value: string;
    muted?: boolean;
    strong?: boolean;
}) {
    return (
        <div className="rounded-lg bg-muted/35 p-2.5">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p
                className={cn(
                    "mt-1 font-medium tabular-nums",
                    muted && "text-muted-foreground",
                    strong && "text-primary",
                )}
            >
                {value}
            </p>
        </div>
    );
}

function NumberCell({
    value,
    locale,
    muted = false,
    strong = false,
}: {
    value: number | null;
    locale: string;
    muted?: boolean;
    strong?: boolean;
}) {
    return (
        <TableCell
            className={cn(
                "text-end tabular-nums",
                muted && "text-muted-foreground",
                strong && "font-semibold text-primary",
            )}
        >
            {value === null ? "—" : formatNumber(value, locale)}
        </TableCell>
    );
}

function formatNumber(value: number, locale: string) {
    return toFiniteNumber(value).toLocaleString(locale, { maximumFractionDigits: 4 });
}

function formatDate(value: string, locale: string) {
    return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00Z`));
}

function formatDateTime(value: string, locale: string) {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
}
