import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";

import { addTrackedProduct } from "../notifications/tracked-products";

const storageKey = "store-pinned-products";
const maximumPins = 50;

type ProductPinsValue = {
    pinnedIds: number[];
    isPinned: (id: number) => boolean;
    togglePinned: (id: number) => void;
};

const ProductPinsContext = createContext<ProductPinsValue | null>(null);

function normalizePinnedIds(value: unknown) {
    if (!Array.isArray(value)) return [];

    // Older releases stored complete product snapshots. Reading both formats
    // keeps existing pins while moving the source of product data back to the API.
    const ids = value.flatMap((item) => {
        if (typeof item === "number") return [item];
        if (item && typeof item === "object" && "id" in item) {
            return [Number((item as { id?: unknown }).id)];
        }
        return [];
    });

    return [...new Set(ids.filter((id) => Number.isSafeInteger(id) && id > 0))]
        .slice(0, maximumPins);
}

function readPinnedIds() {
    try {
        return normalizePinnedIds(JSON.parse(localStorage.getItem(storageKey) ?? "[]"));
    } catch {
        return [];
    }
}

export function ProductPinsProvider({ children }: { children: ReactNode }) {
    const [pinnedIds, setPinnedIds] = useState<number[]>(readPinnedIds);

    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify(pinnedIds));
        pinnedIds.forEach(addTrackedProduct);
    }, [pinnedIds]);

    useEffect(() => {
        const synchronize = (event: StorageEvent) => {
            if (event.key !== storageKey) return;
            try {
                setPinnedIds(normalizePinnedIds(JSON.parse(event.newValue ?? "[]")));
            } catch {
                setPinnedIds([]);
            }
        };

        window.addEventListener("storage", synchronize);
        return () => window.removeEventListener("storage", synchronize);
    }, []);

    const togglePinned = useCallback((id: number) => {
        if (!Number.isSafeInteger(id) || id <= 0) return;

        setPinnedIds((current) => {
            if (current.includes(id)) return current.filter((item) => item !== id);

            // A pin also means the customer is interested in this product, so
            // price and restock notifications should follow it.
            addTrackedProduct(id);
            return [id, ...current].slice(0, maximumPins);
        });
    }, []);

    const value = useMemo<ProductPinsValue>(() => {
        const pinnedSet = new Set(pinnedIds);
        return {
            pinnedIds,
            isPinned: (id) => pinnedSet.has(id),
            togglePinned,
        };
    }, [pinnedIds, togglePinned]);

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
