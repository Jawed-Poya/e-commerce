import { useNavigate } from "react-router-dom";

import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProductForm } from "../components/product-form";
import { useCreateProduct } from "../hooks/use-create-product";
import type { Product } from "../../../schemas/product-schema";
import { PageHeader } from "@/components/page-header";
import { useI18n } from "@/i18n/i18n-provider";

export default function CreateProductPage() {
    const { mutate, isPending } = useCreateProduct();
    const navigate = useNavigate();
    const { t } = useI18n();

    function handleSubmit(model: Product) {
        mutate(model, {
            onSuccess: () => {
                navigate("/products");
            },
            onError: (err) => {
                console.log(err);
            },
        });
    }

    return (
        <div className="space-y-6">
            <PageHeader title={t("create.title")} description={t("create.subtitle")} actions={
                <Button variant="outline" onClick={() => navigate("/products")}>
                    {t("create.back")}
                    <ArrowRight className="size-4 rtl:rotate-180" />
                </Button>
            } />

            <ProductForm onSubmit={handleSubmit} isLoading={isPending} />
        </div>
    );
}
