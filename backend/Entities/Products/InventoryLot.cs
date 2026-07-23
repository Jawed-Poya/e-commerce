using API.Entities.Common;
using API.Entities.Products;

namespace ECommerce.Entities.Products;

public class InventoryLot : BaseEntity
{
    public long ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public long? ProductVariantId { get; set; }
    public ProductVariant? ProductVariant { get; set; }
    public long WarehouseId { get; set; }
    public Warehouse Warehouse { get; set; } = null!;
    public string? LotNumber { get; set; }
    public decimal Quantity { get; set; }
    public decimal ReservedQuantity { get; set; }
    public decimal? UnitCost { get; set; }
    public DateOnly? ManufacturedAt { get; set; }
    public DateOnly? ExpiresAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}
