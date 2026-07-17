import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateInventorySettings } from "@/features/inventory/hooks/use-inventory";
import type { InventoryListItem } from "@/features/inventory/types/inventory-types";
import { useI18n } from "@/i18n/i18n-provider";

export function InventorySettingsDialog({ item, open, onOpenChange }: { item: InventoryListItem | null; open: boolean; onOpenChange: (open: boolean) => void }) {
    const { t } = useI18n();
    const mutation = useUpdateInventorySettings();
    const [minimumQuantity, setMinimumQuantity] = useState("0");
    const [expireDate, setExpireDate] = useState("");

    useEffect(() => {
        if (!open || !item) return;
        setMinimumQuantity(String(item.minimumQuantity));
        setExpireDate(item.expireDate ?? "");
    }, [open, item]);

    if (!item) return null;
    const minimum = Number(minimumQuantity);
    const valid = Number.isFinite(minimum) && minimum >= 0;

    const submit = async () => {
        if (!valid) return;
        try {
            await mutation.mutateAsync({ productId: item.productId, request: { minimumQuantity: minimum, expireDate: expireDate || null } });
            toast.success(t("inventory.settingsSuccess"));
            onOpenChange(false);
        } catch (error) {
            const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
            toast.error(message ?? t("inventory.settingsError"));
        }
    };

    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader className="pe-10"><DialogTitle className="text-base">{t("inventory.settingsTitle")}</DialogTitle><DialogDescription>{t("inventory.settingsDescription")}</DialogDescription></DialogHeader>
            <div className="border bg-muted/30 p-3"><p className="font-medium text-foreground">{item.name}</p><p className="mt-1 text-muted-foreground">{item.barcode || t("inventory.noBarcode")}</p></div>
            <div className="space-y-2"><Label htmlFor="minimum-stock">{t("inventory.reorderPoint")}</Label><Input id="minimum-stock" type="number" min="0" step="0.001" value={minimumQuantity} onChange={event => setMinimumQuantity(event.target.value)} /><p className="text-xs text-muted-foreground">{t("inventory.reorderHelp")}</p></div>
            <div className="space-y-2"><Label htmlFor="stock-expiry">{t("inventory.expiryDate")}</Label><Input id="stock-expiry" type="date" value={expireDate} onChange={event => setExpireDate(event.target.value)} /><p className="text-xs text-muted-foreground">{t("inventory.expiryHelp")}</p></div>
            <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>{t("form.cancel")}</Button><Button onClick={submit} disabled={!valid || mutation.isPending}>{mutation.isPending && <LoaderCircle className="me-2 size-4 animate-spin" />}{mutation.isPending ? t("inventory.saving") : t("form.save")}</Button></DialogFooter>
        </DialogContent>
    </Dialog>;
}
