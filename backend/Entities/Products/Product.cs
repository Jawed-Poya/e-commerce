using API.Entities.Common;
using API.Entities.Types;

namespace API.Entities.Products;

public class Product : BaseEntity
{
    public string Name { get; set; } = null!;

    public string? Barcode { get; set; }

    /// <summary>
    /// Pharmaceutical strength such as 100 mg, 500 mg, 5 mg/5 ml, or 1%.
    /// Strength is a product identity attribute, not a selling-unit conversion.
    /// Different strengths should use separate products/SKUs and inventories.
    /// </summary>
    public string? Strength { get; set; }

    /// <summary>Generic or scientific name used for professional product lookup.</summary>
    public string? GenericName { get; set; }

    /// <summary>Composition/formula shown during purchasing and selling.</summary>
    public string? Formula { get; set; }

    public string? ShortDescription { get; set; }

    public string? Description { get; set; }

    public int? MinimumValue { get; set; }

    public int? MaximumValue { get; set; }

    /// <summary>
    /// Quantity changed by one storefront + / - action for the base selling unit.
    /// Keep at 1 for normal retail, or use values such as 20, 30, or 50 for case/wholesale ordering.
    /// </summary>
    public decimal OrderQuantityStep { get; set; } = 1;

    /// <summary>Optional customer-facing quick quantity presets, stored as canonical comma-separated decimals.</summary>
    public string? QuickOrderQuantities { get; set; }

    /// <summary>
    /// Uses a storefront-only quantity that never reserves or reduces physical inventory.
    /// Useful for supplier-backed, made-to-order, or display catalog products.
    /// </summary>
    public bool UsesDisplayStock { get; set; }

    public decimal? DisplayStockQuantity { get; set; }

    public long CategoryId { get; set; }

    public GeneralType Category { get; set; } = null!;

    public long? BrandId { get; set; }

    public GeneralType? Brand { get; set; }

    public long? UnitId { get; set; }

    public GeneralType? Unit { get; set; }

    public bool IsFeatured { get; set; }

    public bool IsActive { get; set; } = true;

    public string? Slug { get; set; }

    public long ViewCount { get; set; }

    public ICollection<ProductImage> Images { get; set; } = [];

    public ICollection<ProductPrice> Prices { get; set; } = [];

    public ICollection<ProductUnitConversion> UnitConversions { get; set; } = [];

    public ProductInventory Inventory { get; set; } = null!;

    public ICollection<ECommerce.Entities.Products.ProductVariant> Variants { get; set; } = [];
}
