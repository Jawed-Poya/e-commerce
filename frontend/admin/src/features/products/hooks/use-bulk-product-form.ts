import { useCallback, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    useFieldArray,
    useForm,
    type Resolver,
    type SubmitHandler,
} from "react-hook-form";
import { toast } from "sonner";
import type {
    CreateBulkProductsRequest,
    ProductBulkFormValues,
    ProductBulkItemFormValues,
} from "../types/product-bulk-types";
import { useCreateBulkProductsMutation } from "./use-product-mutation";
import { ProductBulkFormSchema } from "../schemas/product-bulk-schema";
import { useNavigate } from "react-router-dom";
import {
    isSupportedImageFile,
    MAXIMUM_IMAGE_FILE_SIZE,
} from "@/lib/image-files";

function getFileSignature(file: File) {
    return `${file.name}-${file.size}-${file.lastModified}`;
}

function getFileNameWithoutExtension(fileName: string) {
    return fileName.replace(/\.[^/.]+$/, "");
}

function slugify(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "");
}

function createClientId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createProductDraft(file: File): ProductBulkItemFormValues {
    const defaultName = getFileNameWithoutExtension(file.name);

    return {
        clientId: createClientId(),

        image: file,
        previewUrl: URL.createObjectURL(file),
        galleryImages: [],

        name: defaultName,
        barcode: "",
        shortDescription: "",
        description: "",

        minimumValue: null,
        maximumValue: null,

        categoryId: 0,
        brandId: null,
        unitId: null,

        isFeatured: false,
        isActive: true,

        slug: slugify(defaultName),
        prices: [],
    };
}

function getErrorMessage(error: unknown) {
    if (typeof error === "object" && error !== null && "response" in error) {
        const apiError = error as {
            response?: {
                data?: {
                    message?: string;
                };
            };
        };

        return apiError.response?.data?.message ?? "Failed to create products.";
    }

    if (error instanceof Error) {
        return error.message;
    }

    return "Failed to create products.";
}

export function useBulkProductForm() {
    const createMutation = useCreateBulkProductsMutation();
    const navigate = useNavigate();

    const form = useForm<ProductBulkFormValues>({
        resolver: zodResolver(ProductBulkFormSchema) as Resolver<ProductBulkFormValues>,
        mode: "onBlur",
        defaultValues: {
            products: [],
        },
    });

    const fieldArray = useFieldArray({
        control: form.control,
        name: "products",
        keyName: "formKey",
    });

    const revokePreviewUrls = useCallback(() => {
        const products = form.getValues("products");

        products.forEach((product) => {
            URL.revokeObjectURL(product.previewUrl);
        });
    }, [form]);

    const resetProducts = useCallback(() => {
        revokePreviewUrls();

        fieldArray.replace([]);

        form.reset({
            products: [],
        });
    }, [fieldArray, form, revokePreviewUrls]);

    const addImages = useCallback(
        (selectedFiles: FileList | File[]) => {
            const files = Array.from(selectedFiles);

            const existingProducts = form.getValues("products");

            const existingSignatures = new Set(
                existingProducts.map((product) =>
                    getFileSignature(product.image),
                ),
            );

            const validFiles: File[] = [];
            let invalidCount = 0;
            let duplicateCount = 0;

            for (const file of files) {
                const isSupported = isSupportedImageFile(file);
                const isValidSize = file.size <= MAXIMUM_IMAGE_FILE_SIZE;
                const signature = getFileSignature(file);

                if (!isSupported || !isValidSize) {
                    invalidCount++;
                    continue;
                }

                if (existingSignatures.has(signature)) {
                    duplicateCount++;
                    continue;
                }

                existingSignatures.add(signature);
                validFiles.push(file);
            }

            if (invalidCount > 0) {
                toast.error(
                    `${invalidCount} image(s) were skipped. Use JPG, PNG, WEBP or AVIF files smaller than 5 MB.`,
                );
            }

            if (duplicateCount > 0) {
                toast.error(
                    `${duplicateCount} duplicate image(s) were skipped.`,
                );
            }

            if (validFiles.length === 0) {
                return;
            }

            const availableSlots = Math.max(0, 50 - existingProducts.length);

            const acceptedFiles = validFiles.slice(0, availableSlots);

            if (acceptedFiles.length < validFiles.length) {
                toast.error("A maximum of 50 products can be created at once.");
            }

            fieldArray.append(acceptedFiles.map(createProductDraft), {
                shouldFocus: false,
            });
        },
        [fieldArray, form],
    );

    const removeProduct = useCallback(
        (index: number) => {
            const product = form.getValues(`products.${index}`);

            if (product?.previewUrl) {
                URL.revokeObjectURL(product.previewUrl);
            }

            fieldArray.remove(index);
        },
        [fieldArray, form],
    );

    const submitProducts: SubmitHandler<ProductBulkFormValues> = useCallback(
        async (values) => {
            const request: CreateBulkProductsRequest = {
                products: values.products.map(
                    ({ clientId, previewUrl, ...product }) => product,
                ),
            };

            const productCount = request.products.length;

            const createPromise = createMutation.mutateAsync(request);

            toast.promise(createPromise, {
                loading: `Creating ${productCount} product(s)...`,
                success: `${productCount} product(s) created successfully.`,
                error: getErrorMessage,
            });

            try {
                await createPromise;
                resetProducts();
                navigate("/products");
            } catch {
                // The toast already displays the API error.
            }
        },
        [createMutation, navigate, resetProducts],
    );

    useEffect(() => {
        return () => {
            revokePreviewUrls();
        };
    }, [revokePreviewUrls]);

    return {
        form,

        fields: fieldArray.fields,
        productCount: fieldArray.fields.length,

        addImages,
        removeProduct,
        resetProducts,

        submit: form.handleSubmit(submitProducts),

        isSubmitting: createMutation.isPending,
    };
}
