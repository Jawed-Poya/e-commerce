import apiClient from "@/api/api-client";
import type {
    AdjustStockRequest,
    InventoryFilters,
    InventoryOverview,
    InventoryLot,
    InventoryTransaction,
    InventoryTransactionFilters,
    PagedResult,
    StockResult,
    UpdateInventorySettingsRequest,
} from "@/features/inventory/types/inventory-types";

export const inventoryService = {
    getOverview(params: InventoryFilters) {
        return apiClient.get<InventoryOverview>("/inventory", params);
    },

    getLots(productId: number) {
        return apiClient.get<InventoryLot[]>(`/inventory/${productId}/lots`);
    },

    getTransactions(params: InventoryTransactionFilters) {
        return apiClient.get<PagedResult<InventoryTransaction>>("/inventory/transactions", params);
    },

    adjust(productId: number, request: AdjustStockRequest) {
        return apiClient.post<StockResult>(`/products/${productId}/inventory/adjust`, request);
    },

    updateSettings(productId: number, request: UpdateInventorySettingsRequest) {
        return apiClient.patch<StockResult>(`/inventory/${productId}/settings`, request);
    },
};
