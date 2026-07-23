import { useEffect, useMemo } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { ImagePlus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

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
import { flattenTree } from "@/lib/utils";
import {
    IMAGE_FILE_ACCEPT,
    isSupportedImageFile,
    MAXIMUM_IMAGE_FILE_SIZE,
} from "@/lib/image-files";

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

function GalleryImagePicker({ files, disabled, onChange }: { files: File[]; disabled?: boolean; onChange: (files: File[]) => void }) {
    const { t } = useI18n();
    const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);

    useEffect(() => () => previews.forEach(({ url }) => URL.revokeObjectURL(url)), [previews]);

    const addFiles = (selected: FileList | null) => {
        if (!selected) return;
        const signatures = new Set(files.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
        const additions = Array.from(selected).filter((file) => isSupportedImageFile(file) && file.size <= MAXIMUM_IMAGE_FILE_SIZE && !signatures.has(`${file.name}-${file.size}-${file.lastModified}`));
        if (files.length + additions.length > 9) toast.error(t("update.galleryLimit"));
        onChange([...files, ...additions].slice(0, 9));
    };

    return (
        <div className="space-y-2 border-t pt-4">
            <div><p className="text-sm font-medium">{t("update.galleryImages")}</p><p className="text-xs text-muted-foreground">{t("update.galleryHelp")}</p></div>
            {previews.length > 0 && <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {previews.map((preview, imageIndex) => <div key={`${preview.file.name}-${preview.file.lastModified}`} className="relative aspect-square overflow-hidden border bg-muted">
                    <img src={preview.url} alt="" className="size-full object-cover" />
                    <Button type="button" variant="destructive" size="icon-xs" disabled={disabled} className="absolute end-1 top-1" aria-label={t("update.removeGalleryImage")} onClick={() => onChange(files.filter((_, index) => index !== imageIndex))}><X className="size-3" /></Button>
                    <span className="absolute inset-x-0 bottom-0 bg-primary/85 px-1 py-0.5 text-center text-[10px] text-primary-foreground">{t("update.newImage")}</span>
                </div>)}
            </div>}
            <Label className="flex cursor-pointer items-center justify-center border px-3 py-2 text-xs aria-disabled:pointer-events-none aria-disabled:opacity-50" aria-disabled={disabled}>
                <ImagePlus className="me-2 size-4" />{t("update.addGalleryImages")}
                <input className="sr-only" type="file" multiple disabled={disabled} accept={IMAGE_FILE_ACCEPT} onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
            </Label>
            <FieldError message={files.length > 9 ? t("update.galleryLimit") : undefined} />
        </div>
    );
}

function LookupCombobox({
    options,
    value,
    placeholder,
    disabled,
    required = false,
    hierarchical = false,
    onChange,
}: {
    options: ProductLookupOption[];
    value: number | null;
    placeholder: string;
    disabled?: boolean;
    required?: boolean;
    hierarchical?: boolean;
    onChange: (value: number | null) => void;
}) {
    const selected = options.find((option) => option.id === value) ?? null;
    const orderedOptions = hierarchical
        ? flattenTree(options)
        : options.map((item) => ({ item, depth: 0 }));

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
                    {orderedOptions.map(({ item, depth }) => (
                        <ComboboxItem key={item.id} value={item}>
                            <span
                                className={
                                    depth === 0 ? "font-medium" : undefined
                                }
                                style={{ paddingInlineStart: depth * 16 }}
                            >
                                {depth > 0 && "↳ "}
                                {item.name}
                            </span>
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

                    <Controller
                        control={control}
                        name={`products.${index}.galleryImages`}
                        render={({ field }) => <GalleryImagePicker files={field.value ?? []} disabled={disabled} onChange={field.onChange} />}
                    />
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
                                        hierarchical
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
