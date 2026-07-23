import { useEffect, useMemo, useState } from "react";
import {
    BadgePercent,
    CircleDollarSign,
    LoaderCircle,
    Plus,
    ShieldCheck,
    Trash2,
    Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useReplaceProductPrices } from "@/features/products/hooks/use-product-pricing";
import type { ProductLookupOption } from "@/features/products/types/product-bulk-types";
import { useI18n } from "@/i18n/i18n-provider";
import { cn } from "@/lib/utils";
import type { ProductPrice } from "@/services/product.service";

type PriceDraft = {
    key: string;
    id?: number;
    customerTypeId: number | null;
    regularPrice: string;
    salePrice: string;
    startDate: string;
    endDate: string;
};

type ProductPricingDialogProps = {
    productId: number;
    productName: string;
    prices: ProductPrice[];
    customerTypes: ProductLookupOption[];
    defaultCustomerTypeId: number | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function ProductPricingDialog({
    productId,
    productName,
    prices,
    customerTypes,
    defaultCustomerTypeId,
    open,
    onOpenChange,
}: ProductPricingDialogProps) {
    const { t } = useI18n();
    const navigate = useNavigate();
    const mutation = useReplaceProductPrices(productId);
    const [drafts, setDrafts] = useState<PriceDraft[]>([]);

    useEffect(() => {
        if (!open) return;

        const mapped = prices.map(toDraft);
        const hasDefault =
            defaultCustomerTypeId != null &&
            mapped.some((draft) => draft.customerTypeId === defaultCustomerTypeId);

        if (defaultCustomerTypeId != null && !hasDefault) {
            mapped.unshift(emptyDraft(defaultCustomerTypeId, "default-price"));
        }

        setDrafts(sortDefaultFirst(mapped, defaultCustomerTypeId));
    }, [defaultCustomerTypeId, open, prices]);

    const selectedIds = drafts
        .map((draft) => draft.customerTypeId)
        .filter((id): id is number => id != null);
    const hasDuplicateCustomerType =
        new Set(selectedIds).size !== selectedIds.length;
    const validations = useMemo(() => drafts.map(validateDraft), [drafts]);
    const hasInvalidRows = validations.some((result) => !result.valid);
    const hasValidDefault =
        defaultCustomerTypeId != null &&
        drafts.some(
            (draft, index) =>
                draft.customerTypeId === defaultCustomerTypeId &&
                validations[index]?.valid,
        );
    const canAdd = customerTypes.some(
        (customerType) => !selectedIds.includes(customerType.id),
    );

    const change = (key: string, values: Partial<PriceDraft>) => {
        setDrafts((current) =>
            sortDefaultFirst(
                current.map((draft) =>
                    draft.key === key ? { ...draft, ...values } : draft,
                ),
                defaultCustomerTypeId,
            ),
        );
    };

    const remove = (draft: PriceDraft) => {
        if (draft.customerTypeId === defaultCustomerTypeId) return;
        setDrafts((current) =>
            current.filter((item) => item.key !== draft.key),
        );
    };

    const add = () => {
        const customerType = customerTypes.find(
            (item) => !selectedIds.includes(item.id),
        );
        if (!customerType) return;
        setDrafts((current) => [
            ...current,
            emptyDraft(customerType.id, crypto.randomUUID()),
        ]);
    };

    const save = async () => {
        if (
            hasDuplicateCustomerType ||
            hasInvalidRows ||
            !hasValidDefault
        ) {
            return;
        }

        try {
            await mutation.mutateAsync(
                drafts.map((draft) => ({
                    id: draft.id,
                    customerTypeId: draft.customerTypeId!,
                    regularPrice: Number(draft.regularPrice),
                    salePrice:
                        draft.salePrice === ""
                            ? null
                            : Number(draft.salePrice),
                    startDate:
                        draft.salePrice === ""
                            ? null
                            : draft.startDate || null,
                    endDate:
                        draft.salePrice === ""
                            ? null
                            : draft.endDate || null,
                })),
            );
            toast.success(t("pricing.success"));
            onOpenChange(false);
        } catch (error) {
            toast.error(getErrorMessage(error, t("pricing.error")));
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="grid max-h-[94vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-4xl">
                <DialogHeader className="pe-10">
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <CircleDollarSign className="size-5 text-primary" />
                        {t("pricing.title")}
                    </DialogTitle>
                    <DialogDescription>
                        {productName} · Customer-specific prices with one required
                        public fallback.
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 space-y-4 overflow-y-auto pe-1">
                    {customerTypes.length === 0 ? (
                        <div className="flex flex-col items-center rounded-2xl border border-dashed px-5 py-10 text-center">
                            <Users className="size-8 text-muted-foreground" />
                            <p className="mt-3 font-medium">
                                {t("pricing.noCustomerTypes")}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {t("pricing.customerTypesHelp")}
                            </p>
                            <Button
                                className="mt-4"
                                variant="outline"
                                onClick={() => {
                                    onOpenChange(false);
                                    navigate("/system/general-types");
                                }}
                            >
                                {t("pricing.openCustomerTypes")}
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                                <div className="flex gap-3">
                                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                                        <ShieldCheck className="size-5" />
                                    </span>
                                    <div>
                                        <p className="text-sm font-black">
                                            Default store price is required
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                            Guests and customers without a matching
                                            tier see the default customer-type price.
                                            The default row cannot be removed.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {drafts.length === 0 && (
                                <div className="flex flex-col items-center rounded-2xl border border-dashed px-5 py-10 text-center">
                                    <BadgePercent className="size-8 text-muted-foreground" />
                                    <p className="mt-3 font-medium">
                                        {t("pricing.noTiers")}
                                    </p>
                                    <Button
                                        className="mt-4"
                                        variant="outline"
                                        onClick={add}
                                    >
                                        <Plus className="me-2 size-4" />
                                        {t("pricing.addTier")}
                                    </Button>
                                </div>
                            )}

                            {drafts.map((draft, index) => {
                                const validation = validations[index];
                                const isDefault =
                                    draft.customerTypeId ===
                                    defaultCustomerTypeId;
                                const regular = Number(draft.regularPrice);
                                const sale = Number(draft.salePrice);
                                const discount =
                                    draft.salePrice !== "" &&
                                    regular > 0 &&
                                    sale >= 0
                                        ? Math.round((1 - sale / regular) * 100)
                                        : null;

                                return (
                                    <section
                                        key={draft.key}
                                        className={cn(
                                            "overflow-hidden rounded-2xl border",
                                            isDefault &&
                                                "border-primary/35 ring-2 ring-primary/10",
                                        )}
                                    >
                                        <header className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-medium">
                                                    {t("pricing.tier")} #{index + 1}
                                                </p>
                                                {isDefault && (
                                                    <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground">
                                                        Default / guests
                                                    </span>
                                                )}
                                                {discount != null && discount > 0 && (
                                                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                        {t("pricing.discount").replace(
                                                            "{count}",
                                                            String(discount),
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                disabled={isDefault}
                                                aria-label={
                                                    isDefault
                                                        ? "Default price cannot be removed"
                                                        : t("pricing.removeTier")
                                                }
                                                onClick={() => remove(draft)}
                                            >
                                                <Trash2
                                                    className={cn(
                                                        "size-4",
                                                        isDefault
                                                            ? "text-muted-foreground"
                                                            : "text-destructive",
                                                    )}
                                                />
                                            </Button>
                                        </header>

                                        <div className="grid gap-4 p-4 md:grid-cols-3">
                                            <div className="space-y-2">
                                                <Label htmlFor={`type-${draft.key}`}>
                                                    {t("pricing.customerType")} *
                                                </Label>
                                                <SimpleCombobox<number>
                                                    value={draft.customerTypeId}
                                                    disabled={isDefault}
                                                    onValueChange={(value) =>
                                                        change(draft.key, { customerTypeId: value })
                                                    }
                                                    options={customerTypes.map((option) => ({
                                                        value: option.id,
                                                        label: option.name,
                                                        description: option.id === defaultCustomerTypeId ? "Default / public price" : undefined,
                                                    }))}
                                                    placeholder="Select customer type"
                                                    className={cn(
                                                        hasDuplicateCustomerType &&
                                                            selectedIds.filter((id) => id === draft.customerTypeId).length > 1 &&
                                                            "ring-1 ring-destructive",
                                                    )}
                                                />
                                            </div>

                                            <MoneyInput
                                                id={`regular-${draft.key}`}
                                                label={`${t("pricing.regularPrice")} *`}
                                                value={draft.regularPrice}
                                                onChange={(value) =>
                                                    change(draft.key, {
                                                        regularPrice: value,
                                                    })
                                                }
                                                invalid={!validation.regularValid}
                                            />
                                            <MoneyInput
                                                id={`sale-${draft.key}`}
                                                label={t("pricing.salePrice")}
                                                value={draft.salePrice}
                                                onChange={(value) =>
                                                    change(draft.key, {
                                                        salePrice: value,
                                                        ...(value === ""
                                                            ? {
                                                                  startDate: "",
                                                                  endDate: "",
                                                              }
                                                            : {}),
                                                    })
                                                }
                                                placeholder={t(
                                                    "pricing.saleOptional",
                                                )}
                                                invalid={!validation.saleValid}
                                            />
                                        </div>

                                        {draft.salePrice !== "" && (
                                            <div className="grid gap-4 border-t bg-muted/10 p-4 sm:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label
                                                        htmlFor={`start-${draft.key}`}
                                                    >
                                                        {t("pricing.startDate")}
                                                    </Label>
                                                    <Input
                                                        id={`start-${draft.key}`}
                                                        type="date"
                                                        value={draft.startDate}
                                                        onChange={(event) =>
                                                            change(draft.key, {
                                                                startDate:
                                                                    event.target
                                                                        .value,
                                                            })
                                                        }
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label
                                                        htmlFor={`end-${draft.key}`}
                                                    >
                                                        {t("pricing.endDate")}
                                                    </Label>
                                                    <Input
                                                        id={`end-${draft.key}`}
                                                        type="date"
                                                        min={
                                                            draft.startDate ||
                                                            undefined
                                                        }
                                                        value={draft.endDate}
                                                        onChange={(event) =>
                                                            change(draft.key, {
                                                                endDate:
                                                                    event.target
                                                                        .value,
                                                            })
                                                        }
                                                        className={cn(
                                                            !validation.datesValid &&
                                                                "ring-1 ring-destructive",
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {!validation.saleValid && (
                                            <p className="border-t px-4 py-2 text-xs text-destructive">
                                                {t("pricing.invalidSale")}
                                            </p>
                                        )}
                                        {!validation.datesValid && (
                                            <p className="border-t px-4 py-2 text-xs text-destructive">
                                                {t("pricing.invalidDates")}
                                            </p>
                                        )}
                                    </section>
                                );
                            })}

                            {hasDuplicateCustomerType && (
                                <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                                    {t("pricing.duplicateType")}
                                </p>
                            )}
                            {!hasValidDefault && (
                                <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                                    Enter a valid price for the default customer
                                    type before saving.
                                </p>
                            )}
                            {drafts.length > 0 && (
                                <Button
                                    variant="outline"
                                    onClick={add}
                                    disabled={!canAdd}
                                >
                                    <Plus className="me-2 size-4" />
                                    {t("pricing.addTier")}
                                </Button>
                            )}
                        </>
                    )}
                </div>

                <DialogFooter className="border-t pt-4">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={mutation.isPending}
                    >
                        {t("form.cancel")}
                    </Button>
                    <Button
                        onClick={save}
                        disabled={
                            customerTypes.length === 0 ||
                            hasDuplicateCustomerType ||
                            hasInvalidRows ||
                            !hasValidDefault ||
                            mutation.isPending
                        }
                    >
                        {mutation.isPending && (
                            <LoaderCircle className="me-2 size-4 animate-spin" />
                        )}
                        {mutation.isPending
                            ? t("pricing.saving")
                            : t("pricing.save")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function toDraft(price: ProductPrice): PriceDraft {
    return {
        key: `saved-${price.id}`,
        id: price.id,
        customerTypeId: price.customerTypeId,
        regularPrice: String(price.regularPrice),
        salePrice: price.salePrice == null ? "" : String(price.salePrice),
        startDate: price.startDate ?? "",
        endDate: price.endDate ?? "",
    };
}

function emptyDraft(customerTypeId: number, key: string): PriceDraft {
    return {
        key,
        customerTypeId,
        regularPrice: "",
        salePrice: "",
        startDate: "",
        endDate: "",
    };
}

function sortDefaultFirst(
    drafts: PriceDraft[],
    defaultCustomerTypeId: number | null,
) {
    return [...drafts].sort((left, right) => {
        const leftDefault = left.customerTypeId === defaultCustomerTypeId;
        const rightDefault = right.customerTypeId === defaultCustomerTypeId;
        return Number(rightDefault) - Number(leftDefault);
    });
}

function MoneyInput({
    id,
    label,
    value,
    onChange,
    placeholder,
    invalid,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    invalid: boolean;
}) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <div className="relative">
                <span className="absolute start-3 top-2.5 text-xs text-muted-foreground">
                    $
                </span>
                <Input
                    id={id}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder ?? "0.00"}
                    className={cn(
                        "ps-7",
                        invalid && "ring-1 ring-destructive",
                    )}
                />
            </div>
        </div>
    );
}

function validateDraft(draft: PriceDraft) {
    const regular = Number(draft.regularPrice);
    const sale = Number(draft.salePrice);
    const regularValid =
        draft.regularPrice !== "" &&
        Number.isFinite(regular) &&
        regular >= 0;
    const saleValid =
        draft.salePrice === "" ||
        (Number.isFinite(sale) && sale >= 0 && regularValid && sale < regular);
    const datesValid =
        !draft.startDate ||
        !draft.endDate ||
        draft.endDate >= draft.startDate;

    return {
        regularValid,
        saleValid,
        datesValid,
        valid:
            draft.customerTypeId != null &&
            regularValid &&
            saleValid &&
            datesValid,
    };
}

function getErrorMessage(error: unknown, fallback: string) {
    const data = (
        error as {
            response?: {
                data?: {
                    message?: string;
                    errors?: Record<string, string[]>;
                };
            };
        }
    ).response?.data;

    return data?.errors
        ? Object.values(data.errors).flat()[0] ?? data.message ?? fallback
        : data?.message ?? fallback;
}
