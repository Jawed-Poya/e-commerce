namespace ECommerce.Entities.Products;

public class InventoryTransaction : ProductEntity
{
    public decimal Quantity { get; set; }

    public InventoryTransactionType Type { get; set; }

    public string? Description { get; set; }
}
