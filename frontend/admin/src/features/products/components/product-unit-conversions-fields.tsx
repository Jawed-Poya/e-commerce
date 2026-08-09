import { Boxes, Plus, Trash2 } from "lucide-react";

import { SimpleCombobox } from "@/components/simple-combobox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/i18n-provider";
import { cn } from "@/lib/utils";
import type { ProductUnitConversionInput } from "@/services/product.service";

interface UnitOption {
    id: number;
    name: string;
}

interface ProductUnitConversionsFieldsProps {
    baseUnitId: number | null;
    units: UnitOption[];
    value: ProductUnitConversionInput[];
    onChange: (value: ProductUnitConversionInput[]) => void;
    disabled?: boolean;
    compact?: boolean;
}

export type UnitConversionValidationKey =
    | "productUnits.baseRequired"
    | "productUnits.duplicateError"
    | "productUnits.invalidConversionError"
    | "productUnits.defaultError"
    | "productUnits.defaultActiveError"
    | "productUnits.priceNegativeError"
    | "productUnits.oldPriceError";

export function createEmptyUnitConversion(
    index: number,
): ProductUnitConversionInput {
    return {
        id: null,
        unitId: 0,
        conversionFactor: 1,
        barcode: null,
        priceOverride: null,
        oldPriceOverride: null,
        isDefault: index === 0,
        isActive: true,
        sortOrder: index,
    };
}

export function validateUnitConversions(
    baseUnitId: number | null,
    conversions: ProductUnitConversionInput[],
): UnitConversionValidationKey | null {
    if (!baseUnitId) return "productUnits.baseRequired";

    const selectedUnitIds = conversions
        .map((unit) => unit.unitId)
        .filter((unitId) => unitId > 0);

    if (new Set(selectedUnitIds).size !== selectedUnitIds.length) {
        return "productUnits.duplicateError";
    }

    if (
        conversions.some(
            (unit) =>
                !unit.unitId ||
                unit.unitId === baseUnitId ||
                !Number.isFinite(unit.conversionFactor) ||
                unit.conversionFactor < 1,
        )
    ) {
        return "productUnits.invalidConversionError";
    }

    if (conversions.filter((unit) => unit.isDefault).length > 1) {
        return "productUnits.defaultError";
    }

    if (conversions.some((unit) => unit.isDefault && !unit.isActive)) {
        return "productUnits.defaultActiveError";
    }

    if (
        conversions.some(
            (unit) =>
                (unit.priceOverride != null && unit.priceOverride < 0) ||
                (unit.oldPriceOverride != null && unit.oldPriceOverride < 0),
        )
    ) {
        return "productUnits.priceNegativeError";
    }

    if (
        conversions.some(
            (unit) =>
                unit.priceOverride != null &&
                unit.oldPriceOverride != null &&
                unit.oldPriceOverride < unit.priceOverride,
        )
    ) {
        return "productUnits.oldPriceError";
    }

    return null;
}

export function ProductUnitConversionsFields({
    baseUnitId,
    units,
    value,
    onChange,
    disabled = false,
    compact = false,
}: ProductUnitConversionsFieldsProps) {
    const { t } = useI18n();

    const addUnit = () => {
        onChange([...value, createEmptyUnitConversion(value.length)]);
    };

    const updateUnit = (
        index: number,
        patch: Partial<ProductUnitConversionInput>,
    ) => {
        onChange(
            value.map((unit, itemIndex) =>
                itemIndex === index ? { ...unit, ...patch } : unit,
            ),
        );
    };

    const removeUnit = (index: number) => {
        const next = value
            .filter((_, itemIndex) => itemIndex !== index)
            .map((unit, itemIndex) => ({ ...unit, sortOrder: itemIndex }));
        onChange(next);
    };

    const setDefaultUnit = (index: number, checked: boolean) => {
        onChange(
            value.map((unit, itemIndex) => ({
                ...unit,
                isDefault:
                    itemIndex === index
                        ? checked
                        : checked
                          ? false
                          : unit.isDefault,
            })),
        );
    };

    return (
        <section
            className={cn(
                "min-w-0 rounded-xl bg-muted/15 p-4 ring-1 ring-border/70 dark:bg-white/[0.025] dark:ring-white/[0.07]",
                compact ? "space-y-3" : "space-y-4",
            )}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <Boxes className="size-4 shrink-0 text-primary" />
                        {t("productUnits.title")}
                    </h3>
                    <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
                        {t("productUnits.description")}
                    </p>
                </div>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full shrink-0 sm:w-auto"
                    disabled={disabled || !baseUnitId}
                    onClick={addUnit}
                >
                    <Plus className="me-2 size-4" />
                    {t("productUnits.add")}
                </Button>
            </div>

            {!baseUnitId ? (
                <div className="rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs leading-5 text-amber-800 dark:text-amber-300">
                    {t("productUnits.selectBaseHelp")}
                </div>
            ) : (
                <div className="rounded-lg bg-primary/[0.055] px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                    {t("productUnits.example")}
                </div>
            )}

            {value.length === 0 ? (
                <div className="rounded-lg bg-background/60 px-4 py-6 text-center text-xs leading-5 text-muted-foreground ring-1 ring-border/60 dark:bg-white/[0.02] dark:ring-white/[0.06]">
                    {t("productUnits.empty")}
                </div>
            ) : (
                <div className="space-y-4">
                    {value.map((unit, index) => {
                        const availableUnits = units.filter(
                            (option) =>
                                option.id !== baseUnitId &&
                                (option.id === unit.unitId ||
                                    !value.some(
                                        (item, itemIndex) =>
                                            itemIndex !== index &&
                                            item.unitId === option.id,
                                    )),
                        );

                        return (
                            <article
                                key={`${unit.id ?? "new"}-${index}`}
                                className="min-w-0 space-y-4 rounded-xl bg-background/80 p-4 ring-1 ring-border/70 dark:bg-white/[0.025] dark:ring-white/[0.07]"
                            >
                                <div className="flex min-w-0 flex-col items-stretch gap-3 border-b border-border/60 pb-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/[0.06]">
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold uppercase tracking-wide text-primary">
                                            {t("productUnits.sellingUnit").replace(" *", "")} {index + 1}
                                        </p>
                                        <p className="mt-0.5 truncate text-sm font-semibold">
                                            {units.find((option) => option.id === unit.unitId)?.name ?? t("productUnits.selectUnit")}
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        disabled={disabled}
                                        className="w-full shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
                                        onClick={() => removeUnit(index)}
                                    >
                                        <Trash2 className="me-2 size-4" />
                                        {t("productUnits.remove")}
                                    </Button>
                                </div>

                                <div
                                    className={cn(
                                        "grid min-w-0 gap-4",
                                        compact
                                            ? "grid-cols-1 xl:grid-cols-2"
                                            : "grid-cols-1 md:grid-cols-2 2xl:grid-cols-3",
                                    )}
                                >
                                    <Field label={t("productUnits.sellingUnit")}>
                                        <SimpleCombobox<number>
                                            value={unit.unitId || null}
                                            onValueChange={(unitId) =>
                                                updateUnit(index, {
                                                    unitId: unitId ?? 0,
                                                })
                                            }
                                            options={availableUnits.map((option) => ({
                                                value: option.id,
                                                label: option.name,
                                            }))}
                                            placeholder={t("productUnits.selectUnit")}
                                            disabled={disabled}
                                        />
                                    </Field>

                                    <Field label={t("productUnits.factor")}>
                                        <Input
                                            className="w-full"
                                            type="number"
                                            min="1"
                                            step="any"
                                            disabled={disabled}
                                            value={unit.conversionFactor}
                                            onChange={(event) =>
                                                updateUnit(index, {
                                                    conversionFactor:
                                                        event.target.value === ""
                                                            ? 0
                                                            : Number(event.target.value),
                                                })
                                            }
                                        />
                                    </Field>

                                    <Field label={t("productUnits.barcode")}>
                                        <Input
                                            className="w-full"
                                            disabled={disabled}
                                            value={unit.barcode ?? ""}
                                            onChange={(event) =>
                                                updateUnit(index, {
                                                    barcode: event.target.value || null,
                                                })
                                            }
                                            placeholder={t("productUnits.optional")}
                                        />
                                    </Field>

                                    <Field label={t("productUnits.priceOverride")}>
                                        <Input
                                            className="w-full"
                                            type="number"
                                            min="0"
                                            step="any"
                                            disabled={disabled}
                                            value={unit.priceOverride ?? ""}
                                            onChange={(event) =>
                                                updateUnit(index, {
                                                    priceOverride:
                                                        event.target.value === ""
                                                            ? null
                                                            : Number(event.target.value),
                                                })
                                            }
                                            placeholder={t("productUnits.autoPricePlaceholder")}
                                        />
                                    </Field>

                                    <Field label={t("productUnits.oldPriceOverride")}>
                                        <Input
                                            className="w-full"
                                            type="number"
                                            min="0"
                                            step="any"
                                            disabled={disabled}
                                            value={unit.oldPriceOverride ?? ""}
                                            onChange={(event) =>
                                                updateUnit(index, {
                                                    oldPriceOverride:
                                                        event.target.value === ""
                                                            ? null
                                                            : Number(event.target.value),
                                                })
                                            }
                                            placeholder={t("productUnits.optional")}
                                        />
                                    </Field>
                                </div>

                                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                                    <label className="flex min-w-0 cursor-pointer items-start gap-3 rounded-lg bg-muted/30 px-3 py-3 ring-1 ring-border/60 dark:bg-white/[0.025] dark:ring-white/[0.06]">
                                        <Checkbox
                                            className="mt-0.5 shrink-0"
                                            checked={unit.isActive}
                                            disabled={disabled}
                                            onCheckedChange={(checked) =>
                                                updateUnit(index, {
                                                    isActive: checked === true,
                                                    isDefault:
                                                        checked === true
                                                            ? unit.isDefault
                                                            : false,
                                                })
                                            }
                                        />
                                        <span className="min-w-0">
                                            <span className="block text-sm font-medium">
                                                {t("productUnits.active")}
                                            </span>
                                        </span>
                                    </label>

                                    <label className="flex min-w-0 cursor-pointer items-start gap-3 rounded-lg bg-muted/30 px-3 py-3 ring-1 ring-border/60 dark:bg-white/[0.025] dark:ring-white/[0.06]">
                                        <Checkbox
                                            className="mt-0.5 shrink-0"
                                            checked={unit.isDefault}
                                            disabled={disabled || !unit.isActive}
                                            onCheckedChange={(checked) =>
                                                setDefaultUnit(index, checked === true)
                                            }
                                        />
                                        <span className="min-w-0">
                                            <span className="block text-sm font-medium">
                                                {t("productUnits.default")}
                                            </span>
                                        </span>
                                    </label>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="min-w-0 space-y-2">
            <Label className="block leading-5">{label}</Label>
            <div className="min-w-0">{children}</div>
        </div>
    );
}
