using API.Entities.Common;
using API.Entities.Products;
using ECommerce.Entities.Products;

namespace API.Entities.Orders;

public class OrderItem : ProductEntity
{
    public long OrderId { get; set; }

    public Order Order { get; set; } = null!;

    /// <summary>Quantity in the product base inventory unit.</summary>
    public decimal Quantity { get; set; }

    /// <summary>Quantity entered by the customer in the selected selling unit.</summary>
    public decimal OrderedQuantity { get; set; }

    /// <summary>General type id of the selected unit; null for legacy rows.</summary>
    public long? SelectedUnitId { get; set; }

    public string? SelectedUnitName { get; set; }

    /// <summary>Base units contained in one selected unit.</summary>
    public decimal UnitConversionFactor { get; set; } = 1;

    /// <summary>Price for one selected unit, kept as an immutable order snapshot.</summary>
    public decimal SellingUnitPrice { get; set; }

    /// <summary>Price per base inventory unit. Existing reports continue to use this value.</summary>
    public decimal UnitPrice { get; set; }

    public decimal UnitCost { get; set; }

    /// <summary>
    /// Snapshot captured when the order is created. False for display-stock products.
    /// </summary>
    public bool AffectsInventory { get; set; } = true;

    public decimal Discount { get; set; }

    public string ProductName { get; set; } = null!;

    public string? ProductBarcode { get; set; }

    public string? VariantDescription { get; set; }

    public decimal Tax { get; set; }

    public string Currency { get; set; } = "AFN";

    public decimal Total => ((OrderedQuantity > 0 ? OrderedQuantity * SellingUnitPrice : Quantity * UnitPrice) - Discount + Tax);

    public decimal CostTotal => Quantity * UnitCost;
}
