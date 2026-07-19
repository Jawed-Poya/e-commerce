using API.Entities.Common;
using API.Entities.Products;

namespace ECommerce.Entities.Products;

public class ProductVariant : BaseEntity
{
    public long ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string Sku { get; set; } = null!;
    public string? Barcode { get; set; }
    public string? AttributesJson { get; set; }
    public decimal? PriceAdjustment { get; set; }
    public bool IsActive { get; set; } = true;
}
