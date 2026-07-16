import { Controller, useFormContext } from "react-hook-form";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
    ProductBulkFormValues,
    ProductLookupOption,
} from "../types/product-bulk-types";
import { useI18n } from "@/i18n/i18n-provider";

interface ProductDraftCardProps {
    index: number;
    previewUrl: string;

    categories: ProductLookupOption[];
    brands: ProductLookupOption[];
    units: ProductLookupOption[];

    disabled?: boolean;
    onRemove: () => void;
}

interface FieldErrorProps {
    message?: string;
}

function FieldError({ message }: FieldErrorProps) {
    if (!message) {
        return null;
    }

    return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

function LookupCombobox({
    options,
    value,
    placeholder,
    disabled,
    required = false,
    onChange,
}: {
    options: ProductLookupOption[];
    value: number | null;
    placeholder: string;
    disabled?: boolean;
    required?: boolean;
    onChange: (value: number | null) => void;
}) {
    const selected = options.find((option) => option.id === value) ?? null;

    return (
        <Combobox
            items={options}
            value={selected}
            disabled={disabled}
            onValueChange={(option) => onChange(option?.id ?? null)}
            itemToStringLabel={(option) => option.name}
        >
            <ComboboxInput
                className="w-full"
                placeholder={placeholder}
                showClear={!required}
            />
            <ComboboxContent>
                <ComboboxEmpty>No matching option.</ComboboxEmpty>
                <ComboboxList>
                    {options.map((option) => (
                        <ComboboxItem key={option.id} value={option}>
                            {option.name}
                        </ComboboxItem>
                    ))}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}

export function ProductDraftCard({
    index,
    previewUrl,
    categories,
    brands,
    units,
    disabled,
    onRemove,
}: ProductDraftCardProps) {
    const { t } = useI18n();
    const {
        register,
        control,
        formState: { errors },
    } = useFormContext<ProductBulkFormValues>();

    const productErrors = errors.products?.[index];

    return (
        <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20">
                <CardTitle className="text-base">
                    Product #{index + 1}
                </CardTitle>

                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    onClick={onRemove}
                >
                    <Trash2 className="size-4 text-destructive" />
                </Button>
            </CardHeader>

            <CardContent className="grid gap-6 p-5 lg:grid-cols-[220px_1fr]">
                <div>
                    <div className="aspect-square overflow-hidden rounded-xl border bg-muted">
                        <img
                            src={previewUrl}
                            alt={`Selected product ${index + 1}`}
                            className="size-full object-cover"
                        />
                    </div>

                    <p className="mt-2 break-all text-xs text-muted-foreground">
                        The image will be uploaded as this product&apos;s
                        primary image.
                    </p>
                </div>

                <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor={`products-${index}-name`}>
                                {t("bulk.productName")}
                                <span className="text-destructive"> *</span>
                            </Label>

                            <Input
                                id={`products-${index}-name`}
                                disabled={disabled}
                                placeholder="Enter product name"
                                {...register(`products.${index}.name`)}
                            />

                            <FieldError
                                message={productErrors?.name?.message}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor={`products-${index}-barcode`}>
                                {t("products.barcode")}
                            </Label>

                            <Input
                                id={`products-${index}-barcode`}
                                disabled={disabled}
                                placeholder="Enter or scan barcode"
                                {...register(`products.${index}.barcode`)}
                            />

                            <FieldError
                                message={productErrors?.barcode?.message}
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-1.5">
                            <Label>
                                {t("products.category")}
                                <span className="text-destructive"> *</span>
                            </Label>

                            <Controller
                                control={control}
                                name={`products.${index}.categoryId`}
                                render={({ field }) => (
                                    <LookupCombobox
                                        options={categories}
                                        value={field.value || null}
                                        placeholder="Search category..."
                                        disabled={disabled}
                                        required
                                        onChange={field.onChange}
                                    />
                                )}
                            />

                            <FieldError
                                message={productErrors?.categoryId?.message}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label>{t("form.brand")}</Label>

                            <Controller
                                control={control}
                                name={`products.${index}.brandId`}
                                render={({ field }) => (
                                    <LookupCombobox
                                        options={brands}
                                        value={field.value}
                                        placeholder="Search brand..."
                                        disabled={disabled}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label>{t("form.unit")}</Label>

                            <Controller
                                control={control}
                                name={`products.${index}.unitId`}
                                render={({ field }) => (
                                    <LookupCombobox
                                        options={units}
                                        value={field.value}
                                        placeholder="Search unit..."
                                        disabled={disabled}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>{t("form.minimum")}</Label>

                            <Controller
                                control={control}
                                name={`products.${index}.minimumValue`}
                                render={({ field }) => (
                                    <Input
                                        type="number"
                                        min={0}
                                        disabled={disabled}
                                        placeholder="0"
                                        value={field.value ?? ""}
                                        onChange={(event) => {
                                            const value = event.target.value;

                                            field.onChange(
                                                value === ""
                                                    ? null
                                                    : Number(value),
                                            );
                                        }}
                                    />
                                )}
                            />

                            <FieldError
                                message={productErrors?.minimumValue?.message}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label>{t("form.maximum")}</Label>

                            <Controller
                                control={control}
                                name={`products.${index}.maximumValue`}
                                render={({ field }) => (
                                    <Input
                                        type="number"
                                        min={0}
                                        disabled={disabled}
                                        placeholder="0"
                                        value={field.value ?? ""}
                                        onChange={(event) => {
                                            const value = event.target.value;

                                            field.onChange(
                                                value === ""
                                                    ? null
                                                    : Number(value),
                                            );
                                        }}
                                    />
                                )}
                            />

                            <FieldError
                                message={productErrors?.maximumValue?.message}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label>{t("form.slug")}</Label>

                        <Input
                            disabled={disabled}
                            placeholder="product-url-slug"
                            {...register(`products.${index}.slug`)}
                        />

                        <FieldError message={productErrors?.slug?.message} />
                    </div>

                    <div className="space-y-1.5">
                        <Label>{t("form.shortDescription")}</Label>

                        <Textarea
                            disabled={disabled}
                            rows={2}
                            placeholder="Short product summary"
                            {...register(`products.${index}.shortDescription`)}
                        />

                        <FieldError
                            message={productErrors?.shortDescription?.message}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>{t("form.description")}</Label>

                        <Textarea
                            disabled={disabled}
                            rows={5}
                            placeholder="Complete product description"
                            {...register(`products.${index}.description`)}
                        />

                        <FieldError
                            message={productErrors?.description?.message}
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Controller
                            control={control}
                            name={`products.${index}.isActive`}
                            render={({ field }) => (
                                <div
                                    role="switch"
                                    aria-checked={field.value}
                                    tabIndex={disabled ? -1 : 0}
                                    onClick={() => !disabled && field.onChange(!field.value)}
                                    onKeyDown={(event) => {
                                        if (!disabled && (event.key === " " || event.key === "Enter")) {
                                            event.preventDefault();
                                            field.onChange(!field.value);
                                        }
                                    }}
                                    className={`flex items-center justify-between rounded-lg border p-4 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${field.value ? "border-primary/50 bg-primary/5" : "hover:bg-muted/50"}`}
                                >
                                    <div>
                                        <Label>{t("bulk.activeProduct")}</Label>
                                        <p className="text-xs text-muted-foreground">
                                            {t("bulk.activeHelp")}
                                        </p>
                                    </div>

                                    <Switch
                                        disabled={disabled}
                                        checked={field.value}
                                        tabIndex={-1}
                                        aria-hidden
                                        className="pointer-events-none"
                                    />
                                </div>
                            )}
                        />

                        <Controller
                            control={control}
                            name={`products.${index}.isFeatured`}
                            render={({ field }) => (
                                <div
                                    role="switch"
                                    aria-checked={field.value}
                                    tabIndex={disabled ? -1 : 0}
                                    onClick={() => !disabled && field.onChange(!field.value)}
                                    onKeyDown={(event) => {
                                        if (!disabled && (event.key === " " || event.key === "Enter")) {
                                            event.preventDefault();
                                            field.onChange(!field.value);
                                        }
                                    }}
                                    className={`flex items-center justify-between rounded-lg border p-4 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${field.value ? "border-primary/50 bg-primary/5" : "hover:bg-muted/50"}`}
                                >
                                    <div>
                                        <Label>{t("bulk.featuredProduct")}</Label>
                                        <p className="text-xs text-muted-foreground">
                                            {t("bulk.featuredHelp")}
                                        </p>
                                    </div>

                                    <Switch
                                        disabled={disabled}
                                        checked={field.value}
                                        tabIndex={-1}
                                        aria-hidden
                                        className="pointer-events-none"
                                    />
                                </div>
                            )}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
