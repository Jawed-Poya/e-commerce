using ECommerce.Shared.Filters;

namespace ECommerce.Entities.Products.Filters;

public class ProductFilter : PaginationFilter
{
    public long? CategoryId { get; set; }

    public long? BrandId { get; set; }

    public long? UnitId { get; set; }

    public bool? IsFeatured { get; set; }

    public bool? IsActive { get; set; }

    public decimal? MinPrice { get; set; }

    public decimal? MaxPrice { get; set; }
}
