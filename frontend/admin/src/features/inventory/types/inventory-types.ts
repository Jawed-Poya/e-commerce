export type InventoryStatus = "Healthy" | "LowStock" | "OutOfStock";

export type InventoryTransactionType =
    | "Purchase"
    | "Sale"
    | "SaleReturn"
    | "StockAdjustment"
    | "Damaged"
    | "Expired"
    | "Transfer"
    | "Reservation"
    | "ReservationRelease";

export interface InventorySummary {
    totalProducts: number;
    activeProducts: number;
    healthyProducts: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    expiringSoonProducts: number;
    totalQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
}

export interface InventoryListItem {
    productId: number;
    name: string;
    strength: string | null;
    barcode: string | null;
    categoryName: string;
    unitName: string | null;
    isActive: boolean;
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    minimumQuantity: number;
    expireDate: string | null;
    activeLotCount: number;
    status: InventoryStatus;
    isExpiringSoon: boolean;
    primaryImageUrl: string | null;
    updatedAt: string;
}


export interface InventoryLot {
    id: number;
    productId: number;
    productName: string;
    strength: string | null;
    barcode: string | null;
    warehouseId: number;
    warehouseName: string;
    lotNumber: string | null;
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    unitCost: number | null;
    manufacturedAt: string | null;
    expiresAt: string | null;
    isExpired: boolean;
    isExpiringSoon: boolean;
    createdAt: string;
}

export interface InventoryTransactionLot {
    id: number;
    inventoryLotId: number | null;
    lotNumber: string | null;
    warehouseId: number;
    warehouseName: string;
    expiresAt: string | null;
    quantityDelta: number;
    reservedDelta: number;
    unitCost: number | null;
}

export interface InventoryTransaction {
    id: number;
    productId: number;
    productName: string;
    productBarcode: string | null;
    type: InventoryTransactionType;
    quantity: number;
    quantityBefore: number;
    quantityAfter: number;
    reservedBefore: number;
    reservedAfter: number;
    referenceType: string | null;
    referenceId: number | null;
    performedByUserId: string | null;
    description: string | null;
    lots: InventoryTransactionLot[];
    createdAt: string;
}

export interface PagedResult<T> {
    items: T[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
}

export interface InventoryOverview {
    summary: InventorySummary;
    products: PagedResult<InventoryListItem>;
}

export interface InventoryFilters {
    search?: string;
    page?: number;
    pageSize?: number;
    status?: InventoryStatus;
    categoryId?: number;
    isActive?: boolean;
    sortBy?: "name" | "quantity" | "available" | "expiry" | "updatedAt";
    sortDescending?: boolean;
}

export interface InventoryTransactionFilters {
    search?: string;
    page?: number;
    pageSize?: number;
    productId?: number;
    type?: InventoryTransactionType;
    from?: string;
    to?: string;
}

export interface StockResult {
    productId: number;
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
}

export interface AdjustStockRequest {
    quantity: number;
    type: InventoryTransactionType;
    description?: string;
    idempotencyKey: string;
    lotId?: number;
}

export interface UpdateInventorySettingsRequest {
    minimumQuantity: number;
    expireDate: string | null;
}
