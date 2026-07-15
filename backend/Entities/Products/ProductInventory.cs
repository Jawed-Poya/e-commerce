using API.Entities.Common;
using ECommerce.Entities.Products;

namespace API.Entities.Products;

public class ProductInventory : ProductEntity
{
    public decimal Quantity { get; set; }

    public decimal ReservedQuantity { get; set; }

    public decimal MinimumQuantity { get; set; }

    public DateOnly? ExpireDate { get; set; }
}
