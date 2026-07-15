using API.Entities.Products;

namespace ECommerce.Dtos;

public class ProductDetailsDto
{
    public long Id { get; set; }

    public string Name { get; set; } = null!;

    public string? Barcode { get; set; }

    public string? Slug { get; set; }

    public string? ShortDescription { get; set; }

    public string? Description { get; set; }


    public long CategoryId { get; set; }

    public string CategoryName { get; set; } = null!;


    public long? BrandId { get; set; }

    public string? BrandName { get; set; }


    public long? UnitId { get; set; }

    public string? UnitName { get; set; } = null!;


    public bool IsFeatured { get; set; }

    public bool IsActive { get; set; }


    public decimal AverageRating { get; set; }

    public int ReviewCount { get; set; }

    public long ViewCount { get; set; }

    public ProductInventory Inventory { get; set; } = null!;

    public List<ProductPrice> Prices { get; set; } = [];

    public List<ProductImage> Images { get; set; } = [];
}
