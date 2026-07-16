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

public sealed record ProductLookupsResponse(
    IReadOnlyCollection<ProductLookupItemResponse> Categories,
    IReadOnlyCollection<ProductLookupItemResponse> Brands,
    IReadOnlyCollection<ProductLookupItemResponse> Units
);
