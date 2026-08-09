using API.Entities.Common;
using API.Entities.Types;

namespace API.Entities.Products;

/// <summary>
/// Defines how a product can be sold or displayed in a unit other than its base inventory unit.
/// Inventory is always stored in the product base unit (Product.UnitId).
/// Example: base unit = Tablet, selling unit = Box, ConversionFactor = 20.
/// </summary>
public sealed class ProductUnitConversion : BaseEntity
{
    public long ProductId { get; set; }
    public Product Product { get; set; } = null!;

    public long UnitId { get; set; }
    public GeneralType Unit { get; set; } = null!;

    /// <summary>Number of base units contained in one selected unit.</summary>
    public decimal ConversionFactor { get; set; } = 1;

    /// <summary>Optional barcode for this packaging/unit.</summary>
    public string? Barcode { get; set; }

    /// <summary>Optional storefront price override for one selected unit.</summary>
    public decimal? PriceOverride { get; set; }

    /// <summary>Optional crossed-out price override for one selected unit.</summary>
    public decimal? OldPriceOverride { get; set; }

    /// <summary>Quantity changed by one storefront + / - action when this selling unit is selected.</summary>
    public decimal OrderQuantityStep { get; set; } = 1;

    /// <summary>Optional quick quantity presets for this selling unit.</summary>
    public string? QuickOrderQuantities { get; set; }

    public bool IsDefault { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
}
