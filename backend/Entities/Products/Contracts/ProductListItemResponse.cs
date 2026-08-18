namespace ECommerce.Entities.Products.Contracts;

public sealed record ProductListItemResponse(
    long Id,
    string Name,
    string? Barcode,
    string? Strength,
    string? GenericName,
    string? Formula,
    string? ShortDescription,
    string? Description,
    string? Slug,
    long CategoryId,
    string CategoryName,
    long? BrandId,
    long? UnitId,
    string? UnitName,
    int? MinimumValue,
    int? MaximumValue,
    decimal OrderQuantityStep,
    IReadOnlyList<decimal> QuickOrderQuantities,
    bool UsesDisplayStock,
    decimal? DisplayStockQuantity,
    bool IsFeatured,
    bool IsActive,
    decimal Stock,
    decimal InventoryStock,
    decimal? Price,
    decimal? OldPrice,
    string? PriceCustomerTypeName,
    bool IsDefaultPrice,
    long ViewCount,
    double AverageRating,
    int ReviewCount,
    string? PrimaryImageUrl,
    IReadOnlyList<ProductListImageResponse> Images
);

public sealed record ProductListImageResponse(
    long Id,
    string Url,
    bool IsPrimary,
    int SortOrder
);
