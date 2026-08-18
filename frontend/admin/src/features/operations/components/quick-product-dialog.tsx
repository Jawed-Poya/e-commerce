import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, PackagePlus } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { SimpleCombobox } from "@/components/simple-combobox";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProductLookupsQuery } from "@/features/products/hooks/use-product-mutation";
import { productKeys } from "@/keys/product-keys";
import { getApiErrorMessage } from "@/lib/api-error";
import { useI18n } from "@/i18n/i18n-provider";
import { operationsService } from "../operations-service";
import type { OperationProduct, QuickCreateProduct } from "../operations-types";

const emptyForm: QuickCreateProduct = {
    name: "",
    barcode: "",
    strength: "",
    genericName: "",
    formula: "",
    categoryId: 0,
    unitId: 0,
    defaultSalePrice: null,
};

export function QuickProductDialog({
    disabled,
    mode,
    onCreated,
}: {
    disabled?: boolean;
    mode: "purchase" | "sale";
    onCreated: (product: OperationProduct) => void;
}) {
    const { tr } = useI18n();
    const queryClient = useQueryClient();
    const { data: lookups, isLoading: lookupsLoading } = useProductLookupsQuery();
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<QuickCreateProduct>(emptyForm);

    const update = <K extends keyof QuickCreateProduct>(
        key: K,
        value: QuickCreateProduct[K],
    ) => setForm((current) => ({ ...current, [key]: value }));

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (!form.name.trim()) {
            toast.error(tr("Product name is required."));
            return;
        }
        if (!form.categoryId) {
            toast.error(tr("Product category is required."));
            return;
        }
        if (!form.unitId) {
            toast.error(tr("Base unit is required."));
            return;
        }

        setSaving(true);
        try {
            const response = await operationsService.quickCreateProduct({
                ...form,
                name: form.name.trim(),
                barcode: form.barcode?.trim() || null,
                strength: form.strength?.trim() || null,
                genericName: form.genericName?.trim() || null,
                formula: form.formula?.trim() || null,
            });
            await queryClient.invalidateQueries({ queryKey: productKeys.all });
            onCreated(response.data);
            toast.success(tr("Product created and added to this document."));
            setForm(emptyForm);
            setOpen(false);
        } catch (error) {
            toast.error(getApiErrorMessage(error, tr("The product could not be created.")));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
            <DialogTrigger
                render={
                    <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        disabled={disabled}
                        className="shadow-sm"
                    />
                }
            >
                <PackagePlus className="me-1 size-4" />
                {tr("Quick add new")}
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <form onSubmit={submit} className="space-y-5">
                    <DialogHeader>
                        <DialogTitle>{tr("Quick create product")}</DialogTitle>
                        <DialogDescription>
                            {tr(
                                mode === "purchase"
                                    ? "Create a real catalog product and add it immediately to this purchase. Stock begins at zero and this purchase will receive it."
                                    : "Create a real catalog product and add it immediately to this sale. Its selling price can be entered now or changed on the line.",
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label={tr("Product name *")}>
                            <Input
                                autoFocus
                                maxLength={200}
                                value={form.name}
                                onChange={(event) => update("name", event.target.value)}
                                placeholder={tr("Product name")}
                            />
                        </Field>
                        <Field label={tr("Barcode")}>
                            <Input
                                maxLength={100}
                                value={form.barcode ?? ""}
                                onChange={(event) => update("barcode", event.target.value)}
                                placeholder={tr("Optional barcode")}
                            />
                        </Field>
                        <Field label={tr("Category *")}>
                            <SimpleCombobox<number>
                                value={form.categoryId || null}
                                onValueChange={(value) => update("categoryId", value ?? 0)}
                                options={(lookups?.categories ?? []).map((option) => ({ value: option.id, label: option.name }))}
                                placeholder={lookupsLoading ? tr("Loading categories…") : tr("Select category")}
                                disabled={lookupsLoading || saving}
                            />
                        </Field>
                        <Field label={tr("Base unit *")}>
                            <SimpleCombobox<number>
                                value={form.unitId || null}
                                onValueChange={(value) => update("unitId", value ?? 0)}
                                options={(lookups?.units ?? []).map((option) => ({ value: option.id, label: option.name }))}
                                placeholder={lookupsLoading ? tr("Loading units…") : tr("Select base unit")}
                                disabled={lookupsLoading || saving}
                            />
                        </Field>
                        <Field label={tr("Default selling price")}>
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.defaultSalePrice ?? ""}
                                onChange={(event) => update("defaultSalePrice", event.target.value === "" ? null : Number(event.target.value))}
                                placeholder="0.00"
                            />
                        </Field>
                        <Field label={tr("Strength")}>
                            <Input maxLength={100} value={form.strength ?? ""} onChange={(event) => update("strength", event.target.value)} placeholder={tr("For example, 500 mg")} />
                        </Field>
                        <Field label={tr("Generic name")}>
                            <Input maxLength={200} value={form.genericName ?? ""} onChange={(event) => update("genericName", event.target.value)} />
                        </Field>
                        <Field label={tr("Formula / composition")}>
                            <Input maxLength={500} value={form.formula ?? ""} onChange={(event) => update("formula", event.target.value)} />
                        </Field>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>
                            {tr("Cancel")}
                        </Button>
                        <Button type="submit" disabled={saving || lookupsLoading}>
                            {saving ? <LoaderCircle className="me-2 size-4 animate-spin" /> : <PackagePlus className="me-2 size-4" />}
                            {saving ? tr("Creating…") : tr("Create and add")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            {children}
        </div>
    );
}
