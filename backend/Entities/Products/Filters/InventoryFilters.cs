using ECommerce.Shared.Filters;

namespace ECommerce.Entities.Products.Filters;

public enum InventoryStockStatus
{
    Healthy = 1,
    LowStock = 2,
    OutOfStock = 3
}

public sealed class InventoryFilter : PaginationFilter
{
    public InventoryStockStatus? Status { get; set; }

    public long? CategoryId { get; set; }

    public bool? IsActive { get; set; }
}

public sealed class InventoryTransactionFilter : PaginationFilter
{
    public long? ProductId { get; set; }

    public InventoryTransactionType? Type { get; set; }

    public DateTime? From { get; set; }

    public DateTime? To { get; set; }
}
