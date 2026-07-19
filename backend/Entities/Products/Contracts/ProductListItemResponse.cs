namespace ECommerce.Entities.Products.Contracts;

public sealed record ProductListItemResponse(
    long Id,
    string Name,
    string? Barcode,
    string? ShortDescription,
    string? Description,
    string? Slug,
    long CategoryId,
    string CategoryName,
    long? BrandId,
    long? UnitId,
    int? MinimumValue,
    int? MaximumValue,
    bool IsFeatured,
    bool IsActive,
    decimal Stock,
    decimal? Price,
    decimal? OldPrice,
    string? PrimaryImageUrl,
    IReadOnlyList<ProductListImageResponse> Images
);

public sealed record ProductListImageResponse(
    long Id,
    string Url,
    bool IsPrimary,
    int SortOrder
);
