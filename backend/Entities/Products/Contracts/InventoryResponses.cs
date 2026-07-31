using ECommerce.Entities.Common;
using ECommerce.Entities.Products.Filters;

namespace ECommerce.Entities.Products.Contracts;

public sealed record InventoryOverviewResponse(
    InventorySummaryResponse Summary,
    PagedResult<InventoryListItemResponse> Products
);

public sealed record InventorySummaryResponse(
    int TotalProducts,
    int ActiveProducts,
    int HealthyProducts,
    int LowStockProducts,
    int OutOfStockProducts,
    int ExpiringSoonProducts,
    decimal TotalQuantity,
    decimal ReservedQuantity,
    decimal AvailableQuantity
);

public sealed record InventoryListItemResponse(
    long ProductId,
    string Name,
    string? Strength,
    string? Barcode,
    string CategoryName,
    string? UnitName,
    bool IsActive,
    decimal Quantity,
    decimal ReservedQuantity,
    decimal AvailableQuantity,
    decimal MinimumQuantity,
    DateOnly? ExpireDate,
    int ActiveLotCount,
    InventoryStockStatus Status,
    bool IsExpiringSoon,
    string? PrimaryImageUrl,
    DateTime UpdatedAt
);

public sealed record InventoryLotResponse(
    long Id,
    long ProductId,
    string ProductName,
    string? Strength,
    string? Barcode,
    long WarehouseId,
    string WarehouseName,
    string? LotNumber,
    decimal Quantity,
    decimal ReservedQuantity,
    decimal AvailableQuantity,
    decimal? UnitCost,
    DateOnly? ManufacturedAt,
    DateOnly? ExpiresAt,
    bool IsExpired,
    bool IsExpiringSoon,
    DateTime CreatedAt
);

public sealed record InventoryTransactionResponse(
    long Id,
    long ProductId,
    string ProductName,
    string? ProductBarcode,
    InventoryTransactionType Type,
    decimal Quantity,
    decimal QuantityBefore,
    decimal QuantityAfter,
    decimal ReservedBefore,
    decimal ReservedAfter,
    string? ReferenceType,
    long? ReferenceId,
    string? PerformedByUserId,
    string? Description,
    DateTime CreatedAt
);
