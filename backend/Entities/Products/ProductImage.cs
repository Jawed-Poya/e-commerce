using API.Entities.Common;
using ECommerce.Entities.Products;

namespace API.Entities.Products;

public class ProductImage : ProductEntity
{
    public string Image { get; set; } = null!;

    public string? Thumbnail { get; set; }

    public string? AltText { get; set; }

    public int SortOrder { get; set; }

    public bool IsPrimary { get; set; }
}
