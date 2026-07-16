import { FormProvider } from "react-hook-form";
import { LoaderCircle, PackagePlus, Trash2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProductLookupsQuery } from "../hooks/use-product-mutation";
import { useBulkProductForm } from "../hooks/use-bulk-product-form";
import { ProductBulkUploader } from "./product-bulk-uploader";
import { ProductDraftCard } from "./product-draft";

export function ProductBulkCreatePage() {
    const { data, isError, isLoading } = useProductLookupsQuery();

    const {
        form,
        fields,
        productCount,
        addImages,
        removeProduct,
        resetProducts,
        submit,
        isSubmitting,
    } = useBulkProductForm();

    if (isLoading) {
        return (
            <div className="space-y-5 p-6">
                <Skeleton className="h-10 w-72" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="p-6">
                <Alert variant="destructive">
                    <AlertTitle>Unable to load product form</AlertTitle>
                    <AlertDescription>
                        Categories, brands or units could not be loaded.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    const { categories, brands, units } = data;

    console.log("Cat: ", categories);

    return (
        <FormProvider {...form}>
            <form
                onSubmit={submit}
                className="mx-auto max-w-7xl space-y-6 p-4 md:p-6"
            >
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            Bulk product creation
                        </h1>

                        <p className="mt-1 text-sm text-muted-foreground">
                            Select multiple images and enter the information for
                            each product.
                        </p>
                    </div>

                    {productCount > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                                {productCount} product
                                {productCount !== 1 ? "s" : ""}
                            </span>

                            <Button
                                type="button"
                                variant="outline"
                                disabled={isSubmitting}
                                onClick={resetProducts}
                            >
                                <Trash2 className="mr-2 size-4" />
                                Clear all
                            </Button>
                        </div>
                    )}
                </header>

                <ProductBulkUploader
                    disabled={isSubmitting}
                    onImagesSelected={addImages}
                />

                {form.formState.errors.products?.root?.message && (
                    <Alert variant="destructive">
                        <AlertTitle>Validation error</AlertTitle>
                        <AlertDescription>
                            {form.formState.errors.products.root.message}
                        </AlertDescription>
                    </Alert>
                )}

                {fields.length === 0 ? (
                    <div className="rounded-xl border bg-muted/10 py-16 text-center">
                        <PackagePlus className="mx-auto size-10 text-muted-foreground" />

                        <h2 className="mt-4 font-semibold">
                            No products selected
                        </h2>

                        <p className="mt-1 text-sm text-muted-foreground">
                            Select product images to generate the forms.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {fields.map((field, index) => (
                            <ProductDraftCard
                                key={field.formKey}
                                index={index}
                                previewUrl={field.previewUrl}
                                categories={categories}
                                brands={brands}
                                units={units}
                                disabled={isSubmitting}
                                onRemove={() => removeProduct(index)}
                            />
                        ))}
                    </div>
                )}

                {productCount > 0 && (
                    <div className="sticky bottom-4 z-20 flex items-center justify-between rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur">
                        <div>
                            <p className="font-medium">
                                {productCount} product
                                {productCount !== 1 ? "s" : ""} ready
                            </p>

                            <p className="text-xs text-muted-foreground">
                                All products will be submitted together.
                            </p>
                        </div>

                        <Button type="submit" size="lg" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <LoaderCircle className="mr-2 size-4 animate-spin" />
                                    Creating products...
                                </>
                            ) : (
                                <>
                                    <PackagePlus className="mr-2 size-4" />
                                    Create {productCount} product
                                    {productCount !== 1 ? "s" : ""}
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </form>
        </FormProvider>
    );
}
