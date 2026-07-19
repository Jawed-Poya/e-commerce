using API.Entities.Common;
using ECommerce.Entities.Products;

namespace API.Entities.Products;

public class ProductImage : ProductEntity
{
    public string ImagePath { get; set; } = null!;

    public string FileName { get; set; } = null!;

    public string? OriginalFileName { get; set; }

    public string ContentType { get; set; } = null!;

    public long Size { get; set; }

    public bool IsPrimary { get; set; }

    public int SortOrder { get; set; }
}