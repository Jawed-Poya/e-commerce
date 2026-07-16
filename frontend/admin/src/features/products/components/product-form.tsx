import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProductSchema, type Product } from "@/schemas/product-schema";

interface ProductFormProps {
    defaultValues?: Partial<Product>;
    onSubmit: (data: Product) => void;
    isLoading?: boolean;
}

export function ProductForm({
    defaultValues,
    onSubmit,
    isLoading,
}: ProductFormProps) {
    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        watch,
    } = useForm({
        resolver: zodResolver(ProductSchema),
        defaultValues: {
            isActive: true,
            isFeatured: false,
            images: [],
            ...defaultValues,
        },
    });

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Product Name</Label>
                    <Input {...register("name")} />
                    <p className="text-destructive text-sm">
                        {errors.name?.message}
                    </p>
                </div>

                <div className="space-y-2">
                    <Label>Slug</Label>
                    <Input {...register("slug")} />
                </div>

                <div className="space-y-2">
                    <Label>Barcode</Label>
                    <Input {...register("barcode")} />
                </div>

                <div className="space-y-2">
                    <Label>Category</Label>
                    <Input
                        type="number"
                        {...register("categoryId", {
                            valueAsNumber: true,
                        })}
                    />
                </div>

                <div className="space-y-2">
                    <Label>Brand</Label>
                    <Input
                        type="number"
                        {...register("brandId", {
                            valueAsNumber: true,
                        })}
                    />
                </div>

                <div className="space-y-2">
                    <Label>Unit</Label>
                    <Input
                        type="number"
                        {...register("unitId", {
                            valueAsNumber: true,
                        })}
                    />
                </div>

                <div className="col-span-2 space-y-2">
                    <Label>Short Description</Label>
                    <Textarea rows={3} {...register("shortDescription")} />
                </div>

                <div className="col-span-2 space-y-2">
                    <Label>Description</Label>
                    <Textarea rows={8} {...register("description")} />
                </div>
            </div>

            <div className="flex gap-8">
                <div className="flex items-center gap-2">
                    <Checkbox
                        checked={watch("isFeatured")}
                        onCheckedChange={(v) =>
                            setValue("isFeatured", Boolean(v))
                        }
                    />

                    <Label>Featured Product</Label>
                </div>

                <div className="flex items-center gap-2">
                    <Checkbox
                        checked={watch("isActive")}
                        onCheckedChange={(v) =>
                            setValue("isActive", Boolean(v))
                        }
                    />

                    <Label>Active</Label>
                </div>
            </div>

            <div className="rounded-lg border-2 border-dashed p-10 text-center text-muted-foreground">
                Image uploader goes here
            </div>
            <div className="flex justify-end gap-3">
                <Button variant="outline" type="button">
                    Cancel
                </Button>

                <Button type="submit" disabled={isLoading}>
                    Save Product
                </Button>
            </div>
        </form>
    );
}
