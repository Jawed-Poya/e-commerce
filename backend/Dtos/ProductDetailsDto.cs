namespace ECommerce.Dtos;

public sealed class ProductDetailsDto
{
    public long Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Barcode { get; set; }
    public string? Slug { get; set; }
    public string? ShortDescription { get; set; }
    public string? Description { get; set; }
    public int? MinimumValue { get; set; }
    public int? MaximumValue { get; set; }
    public long CategoryId { get; set; }
    public string CategoryName { get; set; } = null!;
    public long? BrandId { get; set; }
    public string? BrandName { get; set; }
    public long? UnitId { get; set; }
    public string? UnitName { get; set; }
    public bool IsFeatured { get; set; }
    public bool IsActive { get; set; }
    public long ViewCount { get; set; }
    public double AverageRating { get; set; }
    public int ReviewCount { get; set; }
    public decimal? Price { get; set; }
    public decimal? OldPrice { get; set; }
    public long? PriceCustomerTypeId { get; set; }
    public string? PriceCustomerTypeName { get; set; }
    public bool IsDefaultPrice { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public ProductInventoryDetailsDto? Inventory { get; set; }
    public List<ProductPriceDetailsDto> Prices { get; set; } = [];
    public List<ProductImageDetailsDto> Images { get; set; } = [];
}

public sealed record ProductInventoryDetailsDto(decimal Quantity, decimal ReservedQuantity, decimal AvailableQuantity, decimal MinimumQuantity, DateOnly? ExpireDate);
public sealed record ProductPriceDetailsDto(long Id, long CustomerTypeId, string CustomerTypeName, decimal RegularPrice, decimal? SalePrice, DateOnly? StartDate, DateOnly? EndDate, bool IsDefault);
public sealed record ProductImageDetailsDto(long Id, string Url, string? OriginalFileName, string ContentType, long Size, bool IsPrimary, int SortOrder);
