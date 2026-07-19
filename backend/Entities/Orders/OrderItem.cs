using API.Entities.Common;
using API.Entities.Products;
using ECommerce.Entities.Products;

namespace API.Entities.Orders;

public class OrderItem : ProductEntity
{
    public long OrderId { get; set; }

    public Order Order { get; set; } = null!;

    public decimal Quantity { get; set; }

    public decimal UnitPrice { get; set; }

    public decimal Discount { get; set; }

    public string ProductName { get; set; } = null!;

    public string? ProductBarcode { get; set; }

    public string? VariantDescription { get; set; }

    public decimal Tax { get; set; }

    public string Currency { get; set; } = "AFN";

    public decimal Total => (Quantity * UnitPrice) - Discount + Tax;
}
