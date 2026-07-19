using API.Entities.Common;
using ECommerce.Entities.Products;
using System.ComponentModel.DataAnnotations.Schema;

namespace API.Entities.Products;

public class ProductInventory : ProductEntity
{
    public byte[] RowVersion { get; set; } = [];
    public decimal Quantity { get; set; }

    public decimal ReservedQuantity { get; set; }

    public decimal MinimumQuantity { get; set; }

    public DateOnly? ExpireDate { get; set; }

    [NotMapped]
    public decimal AvailableQuantity =>
    Quantity - ReservedQuantity;
}
