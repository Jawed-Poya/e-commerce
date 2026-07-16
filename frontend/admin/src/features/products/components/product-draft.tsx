import { Controller, useFormContext } from "react-hook-form";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
    ProductBulkFormValues,
    ProductLookupOption,
} from "../types/product-bulk-types";

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

export function ProductDraftCard({
    index,
    previewUrl,
    categories,
    brands,
    units,
    disabled,
    onRemove,
}: ProductDraftCardProps) {
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
                                Product name
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
                                Barcode
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
                                Category
                                <span className="text-destructive"> *</span>
                            </Label>

                            <Controller
                                control={control}
                                name={`products.${index}.categoryId`}
                                render={({ field }) => (
                                    <Select
                                        disabled={disabled}
                                        value={
                                            field.value > 0
                                                ? String(field.value)
                                                : ""
                                        }
                                        onValueChange={(value) =>
                                            field.onChange(Number(value))
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select category" />
                                        </SelectTrigger>

                                        <SelectContent>
                                            {categories.map((category) => (
                                                <SelectItem
                                                    key={category.id}
                                                    value={String(category.id)}
                                                >
                                                    {category.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />

                            <FieldError
                                message={productErrors?.categoryId?.message}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label>Brand</Label>

                            <Controller
                                control={control}
                                name={`products.${index}.brandId`}
                                render={({ field }) => (
                                    <Select
                                        disabled={disabled}
                                        value={
                                            field.value
                                                ? String(field.value)
                                                : "none"
                                        }
                                        onValueChange={(value) =>
                                            field.onChange(
                                                value === "none"
                                                    ? null
                                                    : Number(value),
                                            )
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select brand" />
                                        </SelectTrigger>

                                        <SelectContent>
                                            <SelectItem value="none">
                                                No brand
                                            </SelectItem>

                                            {brands.map((brand) => (
                                                <SelectItem
                                                    key={brand.id}
                                                    value={String(brand.id)}
                                                >
                                                    {brand.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label>Unit</Label>

                            <Controller
                                control={control}
                                name={`products.${index}.unitId`}
                                render={({ field }) => (
                                    <Select
                                        disabled={disabled}
                                        value={
                                            field.value
                                                ? String(field.value)
                                                : "none"
                                        }
                                        onValueChange={(value) =>
                                            field.onChange(
                                                value === "none"
                                                    ? null
                                                    : Number(value),
                                            )
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select unit" />
                                        </SelectTrigger>

                                        <SelectContent>
                                            <SelectItem value="none">
                                                No unit
                                            </SelectItem>

                                            {units.map((unit) => (
                                                <SelectItem
                                                    key={unit.id}
                                                    value={String(unit.id)}
                                                >
                                                    {unit.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Minimum value</Label>

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
                            <Label>Maximum value</Label>

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
                        <Label>Slug</Label>

                        <Input
                            disabled={disabled}
                            placeholder="product-url-slug"
                            {...register(`products.${index}.slug`)}
                        />

                        <FieldError message={productErrors?.slug?.message} />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Short description</Label>

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
                        <Label>Description</Label>

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
                                <div className="flex items-center justify-between rounded-lg border p-4">
                                    <div>
                                        <Label>Active product</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Product can be used in the system.
                                        </p>
                                    </div>

                                    <Switch
                                        disabled={disabled}
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </div>
                            )}
                        />

                        <Controller
                            control={control}
                            name={`products.${index}.isFeatured`}
                            render={({ field }) => (
                                <div className="flex items-center justify-between rounded-lg border p-4">
                                    <div>
                                        <Label>Featured product</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Display this product as featured.
                                        </p>
                                    </div>

                                    <Switch
                                        disabled={disabled}
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
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
