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
        orderQuantityStep: 1,
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
                unit.conversionFactor < 1 ||
                !Number.isFinite(unit.orderQuantityStep) ||
                unit.orderQuantityStep <= 0,
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
                "rounded-xl bg-muted/15 p-4 ring-1 ring-border/70 dark:bg-white/[0.025] dark:ring-white/[0.07]",
                compact ? "space-y-3" : "space-y-4",
            )}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <Boxes className="size-4 text-primary" />
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
                <div className="space-y-3">
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
                            <div
                                key={`${unit.id ?? "new"}-${index}`}
                                className="grid gap-3 rounded-xl bg-background/75 p-3 ring-1 ring-border/70 dark:bg-white/[0.025] dark:ring-white/[0.07] md:grid-cols-2 xl:grid-cols-5"
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
                                                        : Number(
                                                              event.target.value,
                                                          ),
                                            })
                                        }
                                    />
                                </Field>

                                <Field label={t("productUnits.orderStep")}>
                                    <Input
                                        type="number"
                                        min="0.001"
                                        step="any"
                                        disabled={disabled}
                                        value={unit.orderQuantityStep}
                                        onChange={(event) =>
                                            updateUnit(index, {
                                                orderQuantityStep:
                                                    event.target.value === ""
                                                        ? 0
                                                        : Number(event.target.value),
                                            })
                                        }
                                    />
                                    <p className="text-[10px] leading-4 text-muted-foreground">
                                        {t("productUnits.orderStepHelp")}
                                    </p>
                                </Field>

                                <Field label={t("productUnits.barcode")}>

                                    <Input
                                        disabled={disabled}
                                        value={unit.barcode ?? ""}
                                        onChange={(event) =>
                                            updateUnit(index, {
                                                barcode:
                                                    event.target.value || null,
                                            })
                                        }
                                        placeholder={t("productUnits.optional")}
                                    />
                                </Field>

                                <div className="flex items-end justify-end">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        disabled={disabled}
                                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                        onClick={() => removeUnit(index)}
                                    >
                                        <Trash2 className="me-2 size-4" />
                                        {t("productUnits.remove")}
                                    </Button>
                                </div>

                                <Field label={t("productUnits.priceOverride")}>
                                    <Input
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
                                                        : Number(
                                                              event.target.value,
                                                          ),
                                            })
                                        }
                                        placeholder={t(
                                            "productUnits.autoPricePlaceholder",
                                        )}
                                    />
                                </Field>

                                <Field label={t("productUnits.oldPriceOverride")}>
                                    <Input
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
                                                        : Number(
                                                              event.target.value,
                                                          ),
                                            })
                                        }
                                        placeholder={t("productUnits.optional")}
                                    />
                                </Field>

                                <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-muted/30 px-3 py-2.5 ring-1 ring-border/60 dark:bg-white/[0.025] dark:ring-white/[0.06]">
                                    <Checkbox
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
                                    <span className="text-sm font-medium">
                                        {t("productUnits.active")}
                                    </span>
                                </label>

                                <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-muted/30 px-3 py-2.5 ring-1 ring-border/60 dark:bg-white/[0.025] dark:ring-white/[0.06]">
                                    <Checkbox
                                        checked={unit.isDefault}
                                        disabled={disabled || !unit.isActive}
                                        onCheckedChange={(checked) =>
                                            setDefaultUnit(
                                                index,
                                                checked === true,
                                            )
                                        }
                                    />
                                    <span className="text-sm font-medium">
                                        {t("productUnits.default")}
                                    </span>
                                </label>
                            </div>
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
        <div className="space-y-2">
            <Label>{label}</Label>
            {children}
        </div>
    );
}
