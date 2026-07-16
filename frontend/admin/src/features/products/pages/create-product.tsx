import { useNavigate } from "react-router-dom";

import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProductForm } from "../components/product-form";
import { useCreateProduct } from "../hooks/use-create-product";
import type { Product } from "../../../schemas/product-schema";

export default function CreateProductPage() {
    const { mutate, isPending } = useCreateProduct();
    const navigate = useNavigate();

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
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight">
                        Create Product
                    </h1>

                    <p className="text-muted-foreground">
                        Add a new product to your catalog.
                    </p>
                </div>

                <Button variant="outline" onClick={() => navigate("/products")}>
                    Back
                    <ArrowRight className="h-4 w-4" />
                </Button>
            </div>

            <ProductForm onSubmit={handleSubmit} isLoading={isPending} />
        </div>
    );
}
