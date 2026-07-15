namespace ECommerce.Entities.Products;

public enum InventoryTransactionType
{
    Purchase = 1,

    Sale = 2,

    SaleReturn = 3,

    StockAdjustment = 4,

    Damaged = 5,

    Expired = 6,

    Transfer = 7
}
