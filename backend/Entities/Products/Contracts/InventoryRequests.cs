namespace ECommerce.Entities.Products.Contracts;

public sealed record AdjustStockRequest(decimal Quantity, InventoryTransactionType Type, string? Description, string? IdempotencyKey);
public sealed record ReserveStockRequest(decimal Quantity, long? OrderId, string? IdempotencyKey);
public sealed record UpdateInventorySettingsRequest(decimal MinimumQuantity, DateOnly? ExpireDate);
public sealed record StockResult(long ProductId, decimal Quantity, decimal ReservedQuantity, decimal AvailableQuantity);
