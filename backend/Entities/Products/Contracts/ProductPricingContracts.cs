namespace ECommerce.Entities.Products.Contracts;

public sealed class ReplaceProductPricesRequest
{
    public List<ProductPriceItemRequest> Prices { get; set; } = [];
}

public sealed class ProductPriceItemRequest
{
    public long? Id { get; set; }

    public long CustomerTypeId { get; set; }

    public decimal RegularPrice { get; set; }

    public decimal? SalePrice { get; set; }

    public DateOnly? StartDate { get; set; }

    public DateOnly? EndDate { get; set; }
}

public sealed record ProductPriceResponse(
    long Id,
    long CustomerTypeId,
    string CustomerTypeName,
    decimal RegularPrice,
    decimal? SalePrice,
    DateOnly? StartDate,
    DateOnly? EndDate,
    bool IsDefault
);
