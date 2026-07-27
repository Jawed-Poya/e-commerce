namespace ECommerce.Entities.Products;

public class InventoryTransaction : ProductEntity
{
    public decimal Quantity { get; set; }

    public InventoryTransactionType Type { get; set; }

    public decimal QuantityBefore { get; set; }

    public decimal QuantityAfter { get; set; }

    public decimal ReservedBefore { get; set; }

    public decimal ReservedAfter { get; set; }

    public string? ReferenceType { get; set; }

    public long? ReferenceId { get; set; }

    public string? IdempotencyKey { get; set; }

    public string? PerformedByUserId { get; set; }

    public string? Description { get; set; }
}
