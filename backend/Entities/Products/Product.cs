using API.Entities.Common;
using API.Entities.Types;

namespace API.Entities.Products;

public class Product : BaseEntity
{
    public string Name { get; set; } = null!;

    public string? Barcode { get; set; }

    public string? ShortDescription { get; set; }

    public string? Description { get; set; }

    public int? MinimumValue { get; set; }

    public int? MaximumValue { get; set; }

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

    public ProductInventory Inventory { get; set; } = null!;
}