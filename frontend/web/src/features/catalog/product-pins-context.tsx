import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";

import type { Product } from "../../shared/types/product";

const storageKey = "store-pinned-products";

type ProductPinsValue = {
    pinnedProducts: Product[];
    pinnedIds: number[];
    isPinned: (id: number) => boolean;
    togglePinned: (product: Product) => void;
};

const ProductPinsContext = createContext<ProductPinsValue | null>(null);

function readPinnedProducts() {
    try {
        const stored = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
        return Array.isArray(stored)
            ? stored.filter(
                  (product): product is Product =>
                      typeof product === "object" &&
                      product !== null &&
                      typeof product.id === "number",
              )
            : [];
    } catch {
        return [];
    }
}

export function ProductPinsProvider({ children }: { children: ReactNode }) {
    const [pinnedProducts, setPinnedProducts] = useState<Product[]>(
        readPinnedProducts,
    );

    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify(pinnedProducts));
    }, [pinnedProducts]);

    const value = useMemo<ProductPinsValue>(() => {
        const pinnedIds = pinnedProducts.map((product) => product.id);

        return {
            pinnedProducts,
            pinnedIds,
            isPinned: (id) => pinnedIds.includes(id),
            togglePinned: (product) =>
                setPinnedProducts((current) => {
                    if (current.some((item) => item.id === product.id)) {
                        return current.filter((item) => item.id !== product.id);
                    }

                    return [product, ...current];
                }),
        };
    }, [pinnedProducts]);

    return (
        <ProductPinsContext.Provider value={value}>
            {children}
        </ProductPinsContext.Provider>
    );
}

export function useProductPins() {
    const value = useContext(ProductPinsContext);
    if (!value) {
        throw new Error("useProductPins must be used inside ProductPinsProvider");
    }
    return value;
}
