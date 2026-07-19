namespace ECommerce.Entities.Products.Contracts;

public sealed record CreateBulkProductsResponse(
    int CreatedCount,
    IReadOnlyCollection<CreatedProductResponse> Products
);

public sealed record CreatedProductResponse(
    long Id,
    string Name,
    string? Barcode,
    string Slug,
    string PrimaryImageUrl
);

public sealed record ProductLookupItemResponse(
    long Id,
    string Name
);

public sealed record ProductCategoryLookupItemResponse(
    long Id,
    string Name,
    long? ParentId,
    int ProductCount,
    string? ImageUrl
);

public sealed record ProductLookupsResponse(
    IReadOnlyCollection<ProductCategoryLookupItemResponse> Categories,
    IReadOnlyCollection<ProductLookupItemResponse> Brands,
    IReadOnlyCollection<ProductLookupItemResponse> Units,
    IReadOnlyCollection<ProductLookupItemResponse> CustomerTypes,
    long DefaultCustomerTypeId,
    decimal MinimumPrice,
    decimal MaximumPrice
);
