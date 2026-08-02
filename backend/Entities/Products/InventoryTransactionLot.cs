using API.Entities.Common;

namespace ECommerce.Entities.Products;

/// <summary>
/// Immutable lot-level audit detail for an inventory transaction. Snapshot
/// fields keep the batch trace readable even when the source lot is later
/// renamed, depleted, archived, or soft-deleted.
/// </summary>
public sealed class InventoryTransactionLot : BaseEntity
{
    public long InventoryTransactionId { get; set; }
    public InventoryTransaction InventoryTransaction { get; set; } = null!;

    public long? InventoryLotId { get; set; }
    public InventoryLot? InventoryLot { get; set; }

    public string? LotNumber { get; set; }
    public long WarehouseId { get; set; }
    public string WarehouseName { get; set; } = null!;
    public DateOnly? ExpiresAt { get; set; }
    public decimal QuantityDelta { get; set; }
    public decimal ReservedDelta { get; set; }
    public decimal? UnitCost { get; set; }
}
