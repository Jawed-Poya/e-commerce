import { useEffect, useMemo, useState } from "react";
import { Boxes, LoaderCircle, PackageMinus, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Combobox,
    ComboboxContent,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox";
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
import { Textarea } from "@/components/ui/textarea";
import { useAdjustInventory, useInventoryLots } from "@/features/inventory/hooks/use-inventory";
import type {
    InventoryListItem,
    InventoryLot,
    InventoryTransactionType,
} from "@/features/inventory/types/inventory-types";
import { useI18n } from "@/i18n/i18n-provider";

type AdjustmentAction = {
    id: string;
    type: InventoryTransactionType;
    direction: 1 | -1;
    label: string;
    description: string;
};

export function InventoryAdjustDialog({
    item,
    open,
    onOpenChange,
}: {
    item: InventoryListItem | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { locale, t } = useI18n();
    const mutation = useAdjustInventory();
    const lotsQuery = useInventoryLots(open ? item?.productId ?? null : null);
    const actions = useMemo<AdjustmentAction[]>(() => [
        { id: "purchase", type: "Purchase", direction: 1, label: t("inventory.action.purchase"), description: t("inventory.action.purchaseHelp") },
        { id: "return", type: "SaleReturn", direction: 1, label: t("inventory.action.return"), description: t("inventory.action.returnHelp") },
        { id: "correction-add", type: "StockAdjustment", direction: 1, label: t("inventory.action.addCorrection"), description: t("inventory.action.addCorrectionHelp") },
        { id: "correction-remove", type: "StockAdjustment", direction: -1, label: t("inventory.action.removeCorrection"), description: t("inventory.action.removeCorrectionHelp") },
        { id: "damaged", type: "Damaged", direction: -1, label: t("inventory.action.damaged"), description: t("inventory.action.damagedHelp") },
        { id: "expired", type: "Expired", direction: -1, label: t("inventory.action.expired"), description: t("inventory.action.expiredHelp") },
    ], [t]);
    const [actionId, setActionId] = useState(actions[0].id);
    const [selectedLotId, setSelectedLotId] = useState<number | null>(null);
    const [quantity, setQuantity] = useState("");
    const [description, setDescription] = useState("");

    const action = actions.find(option => option.id === actionId) ?? actions[0];
    const requiresLot = action.direction < 0;
    const lotOptions = useMemo(
        () => (lotsQuery.data ?? []).filter(lot =>
            lot.availableQuantity > 0 && (action.type !== "Expired" || lot.isExpired)),
        [action.type, lotsQuery.data],
    );
    const selectedLot = lotOptions.find(lot => lot.id === selectedLotId) ?? null;
    const numericQuantity = Number(quantity);
    const delta = Number.isFinite(numericQuantity) ? numericQuantity * action.direction : 0;
    const projectedQuantity = (item?.quantity ?? 0) + delta;
    const aggregateValid = numericQuantity > 0 && projectedQuantity >= (item?.reservedQuantity ?? 0);
    const lotValid = !requiresLot || (
        selectedLot !== null &&
        numericQuantity <= selectedLot.availableQuantity
    );
    const isValid = aggregateValid && lotValid;

    useEffect(() => {
        if (!open) return;
        setActionId("purchase");
        setSelectedLotId(null);
        setQuantity("");
        setDescription("");
    }, [open, item?.productId]);

    useEffect(() => {
        setSelectedLotId(null);
        setQuantity("");
    }, [actionId]);

    const submit = async () => {
        if (!item || !isValid) return;
        try {
            await mutation.mutateAsync({
                productId: item.productId,
                request: {
                    quantity: delta,
                    type: action.type,
                    description: description.trim() || undefined,
                    idempotencyKey: crypto.randomUUID(),
                    lotId: selectedLot?.id,
                },
            });
            toast.success(t("inventory.adjustSuccess"));
            onOpenChange(false);
        } catch (error) {
            toast.error(getErrorMessage(error, t("inventory.adjustError")));
        }
    };

    if (!item) return null;
    const selectedAction = actions.find(option => option.id === actionId) ?? actions[0];
    const lotError = getLotError({
        requiresLot,
        actionType: action.type,
        selectedLot,
        numericQuantity,
        lotsLoading: lotsQuery.isLoading,
        lotOptions,
        t,
    });

    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader className="pe-10">
                <DialogTitle className="text-base">{t("inventory.adjustTitle")}</DialogTitle>
                <DialogDescription>{t("inventory.adjustDescription")}</DialogDescription>
            </DialogHeader>

            <div className="border bg-muted/30 p-3">
                <p className="font-medium text-foreground">{item.name}</p>
                <p className="mt-1 text-muted-foreground">{item.barcode || t("inventory.noBarcode")}</p>
            </div>

            <div className="space-y-2">
                <Label>{t("inventory.movementType")}</Label>
                <Combobox items={actions} value={selectedAction} onValueChange={option => option && setActionId(option.id)} itemToStringLabel={option => option.label}>
                    <ComboboxInput className="w-full" />
                    <ComboboxContent>
                        <ComboboxList>{actions.map(option => <ComboboxItem key={option.id} value={option}>
                            <span className={`flex size-7 items-center justify-center border ${option.direction > 0 ? "text-emerald-600" : "text-destructive"}`}>
                                {option.direction > 0 ? <PackagePlus className="size-4" /> : <PackageMinus className="size-4" />}
                            </span>
                            <span><span className="block font-medium">{option.label}</span><span className="block text-[11px] text-muted-foreground">{option.description}</span></span>
                        </ComboboxItem>)}</ComboboxList>
                    </ComboboxContent>
                </Combobox>
                <p className="text-xs text-muted-foreground">{action.description}</p>
            </div>

            {requiresLot ? <div className="space-y-2">
                <Label>{t("inventory.lotBatch")}</Label>
                <Combobox
                    items={lotOptions}
                    value={selectedLot}
                    onValueChange={lot => setSelectedLotId(lot?.id ?? null)}
                    itemToStringLabel={lot => lotLabel(lot, t)}
                >
                    <ComboboxInput className="w-full" placeholder={t("inventory.selectLot")} disabled={lotsQuery.isLoading} />
                    <ComboboxContent>
                        <ComboboxList>
                            {lotOptions.map(lot => <ComboboxItem key={lot.id} value={lot}>
                                <span className="flex size-8 shrink-0 items-center justify-center border bg-muted/40 text-muted-foreground">
                                    <Boxes className="size-4" />
                                </span>
                                <span className="min-w-0">
                                    <span className="block truncate font-medium">{lotLabel(lot, t)}</span>
                                    <span className="block text-[11px] text-muted-foreground">
                                        {lot.warehouseName} · {t("inventory.lotAvailable")}: {formatNumber(lot.availableQuantity)}
                                        {lot.expiresAt ? ` · ${formatDate(lot.expiresAt, locale)}` : ""}
                                    </span>
                                </span>
                            </ComboboxItem>)}
                        </ComboboxList>
                    </ComboboxContent>
                </Combobox>
                <p className="text-xs text-muted-foreground">{t("inventory.lotHelp")}</p>
                {lotError ? <p className="text-xs text-destructive">{lotError}</p> : null}
            </div> : null}

            <div className="space-y-2">
                <Label htmlFor="inventory-adjust-quantity">{t("inventory.quantity")}</Label>
                <Input
                    id="inventory-adjust-quantity"
                    type="number"
                    min="0.001"
                    max={selectedLot?.availableQuantity}
                    step="0.001"
                    inputMode="decimal"
                    value={quantity}
                    onChange={event => setQuantity(event.target.value)}
                    placeholder="0"
                />
            </div>

            <div className="grid grid-cols-3 border text-center">
                <StockPreview label={t("inventory.currentStock")} value={item.quantity} />
                <StockPreview label={t("inventory.change")} value={delta} signed className="border-x" />
                <StockPreview label={t("inventory.newStock")} value={projectedQuantity} />
            </div>
            {!aggregateValid && numericQuantity > 0 ? <p className="text-xs text-destructive">{t("inventory.reservedGuard")}</p> : null}

            <div className="space-y-2">
                <Label htmlFor="inventory-adjust-note">{t("inventory.note")}</Label>
                <Textarea id="inventory-adjust-note" rows={3} maxLength={500} value={description} onChange={event => setDescription(event.target.value)} placeholder={t("inventory.notePlaceholder")} />
                <p className="text-end text-[11px] text-muted-foreground">{description.length}/500</p>
            </div>

            <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>{t("form.cancel")}</Button>
                <Button onClick={submit} disabled={!isValid || mutation.isPending || lotsQuery.isLoading}>
                    {(mutation.isPending || lotsQuery.isLoading) && <LoaderCircle className="me-2 size-4 animate-spin" />}
                    {mutation.isPending ? t("inventory.saving") : t("inventory.confirmAdjustment")}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>;
}

function getLotError({
    requiresLot,
    actionType,
    selectedLot,
    numericQuantity,
    lotsLoading,
    lotOptions,
    t,
}: {
    requiresLot: boolean;
    actionType: InventoryTransactionType;
    selectedLot: InventoryLot | null;
    numericQuantity: number;
    lotsLoading: boolean;
    lotOptions: InventoryLot[];
    t: ReturnType<typeof useI18n>["t"];
}) {
    if (!requiresLot || lotsLoading) return null;
    if (lotOptions.length === 0)
        return actionType === "Expired" ? t("inventory.noExpiredLots") : t("inventory.noAvailableLots");
    if (!selectedLot) return t("inventory.lotRequired");
    if (numericQuantity > selectedLot.availableQuantity) return t("inventory.lotQuantityGuard");
    return null;
}

function lotLabel(lot: InventoryLot, t: ReturnType<typeof useI18n>["t"]) {
    return lot.lotNumber || `${t("inventory.unnumberedLot")} #${lot.id}`;
}

function formatDate(value: string, locale: string) {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" })
        .format(new Date(`${value}T00:00:00Z`));
}

function formatNumber(value: number) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function StockPreview({ label, value, signed = false, className = "" }: { label: string; value: number; signed?: boolean; className?: string }) {
    const formatted = `${signed && value > 0 ? "+" : ""}${formatNumber(value)}`;
    return <div className={`p-3 ${className}`}><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold tabular-nums">{formatted}</p></div>;
}

function getErrorMessage(error: unknown, fallback: string) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? fallback;
}
