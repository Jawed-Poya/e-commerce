import { FormProvider } from "react-hook-form";
import { LoaderCircle, PackagePlus, Trash2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProductLookupsQuery } from "../hooks/use-product-mutation";
import { useBulkProductForm } from "../hooks/use-bulk-product-form";
import { ProductBulkUploader } from "./product-bulk-uploader";
import { ProductDraftCard } from "./product-draft";
import { useI18n } from "@/i18n/i18n-provider";
import { PageHeader } from "@/components/page-header";
import { ProductSectionNavigation } from "./product-section-navigation";

export function ProductBulkCreatePage() {
    const { t } = useI18n();
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
            <div className="space-y-5">
                <Skeleton className="h-10 w-72" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div>
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
                className="space-y-6"
            >
                <PageHeader title={t("bulk.title")} description={t("bulk.subtitle")} actions={productCount > 0 ? (
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
                                <Trash2 className="me-2 size-4" />
                                {t("bulk.clear")}
                            </Button>
                        </div>
                    ) : undefined} />

                <ProductSectionNavigation />

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
                            {t("bulk.noProducts")}
                        </h2>

                        <p className="mt-1 text-sm text-muted-foreground">
                            {t("bulk.selectImages")}
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
                                {productCount !== 1 ? "s" : ""} {t("bulk.ready")}
                            </p>

                            <p className="text-xs text-muted-foreground">
                                {t("bulk.submitTogether")}
                            </p>
                        </div>

                        <Button type="submit" size="lg" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <LoaderCircle className="me-2 size-4 animate-spin" />
                                    {t("bulk.creating")}
                                </>
                            ) : (
                                <>
                                    <PackagePlus className="me-2 size-4" />
                                    {t("bulk.create")} {productCount} product
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
