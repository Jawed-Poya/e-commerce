import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { inventoryService } from "@/features/inventory/services/inventory-service";
import type {
    AdjustStockRequest,
    InventoryFilters,
    InventoryTransactionFilters,
    UpdateInventorySettingsRequest,
} from "@/features/inventory/types/inventory-types";
import { productKeys } from "@/keys/product-keys";

export const inventoryKeys = {
    all: ["inventory"] as const,
    overview: (filters: InventoryFilters) => [...inventoryKeys.all, "overview", filters] as const,
    transactions: (filters: InventoryTransactionFilters) => [...inventoryKeys.all, "transactions", filters] as const,
};

export function useInventoryOverview(filters: InventoryFilters) {
    return useQuery({
        queryKey: inventoryKeys.overview(filters),
        queryFn: async () => (await inventoryService.getOverview(filters)).data,
        placeholderData: previous => previous,
        staleTime: 30_000,
    });
}

export function useInventoryTransactions(filters: InventoryTransactionFilters) {
    return useQuery({
        queryKey: inventoryKeys.transactions(filters),
        queryFn: async () => (await inventoryService.getTransactions(filters)).data,
        placeholderData: previous => previous,
        staleTime: 15_000,
    });
}

export function useAdjustInventory() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ productId, request }: { productId: number; request: AdjustStockRequest }) => inventoryService.adjust(productId, request),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: inventoryKeys.all }),
                queryClient.invalidateQueries({ queryKey: productKeys.all }),
            ]);
        },
    });
}

export function useUpdateInventorySettings() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ productId, request }: { productId: number; request: UpdateInventorySettingsRequest }) => inventoryService.updateSettings(productId, request),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: inventoryKeys.all }),
                queryClient.invalidateQueries({ queryKey: productKeys.all }),
            ]);
        },
    });
}
