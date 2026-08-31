namespace ECommerce.Entities.Customers.Contracts;

public sealed record CustomerCartItemContract(
    long ProductId,
    string Name,
    string? Image,
    decimal Price,
    decimal Stock,
    long? UnitId,
    string? UnitName,
    decimal QuantityStep,
    IReadOnlyList<decimal> QuickOrderQuantities,
    decimal? MinimumValue,
    decimal? MaximumValue,
    decimal Quantity);

public sealed record CustomerCartResponse(
    long Revision,
    DateTime? UpdatedAt,
    IReadOnlyList<CustomerCartItemContract> Items);

public sealed record UpdateCustomerCartRequest(
    long? BaseRevision,
    bool Merge,
    IReadOnlyList<CustomerCartItemContract> Items);
