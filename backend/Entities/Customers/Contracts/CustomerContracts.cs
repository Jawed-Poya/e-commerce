using ECommerce.Entities.Orders;

namespace ECommerce.Entities.Customers.Contracts;

public sealed record UpsertCustomerRequest(
    string FirstName,
    string? LastName,
    string Phone,
    string? Email,
    string? Address,
    long? CustomerTypeId
);

public sealed record CustomerListItemResponse(
    long Id,
    string Name,
    string Phone,
    string? Email,
    string? CustomerTypeName,
    int OrderCount,
    decimal TotalSpent,
    DateTime? LastOrderAt,
    DateTime CreatedAt
);

public sealed record CustomerAddressResponse(
    long Id,
    string Label,
    string RecipientName,
    string Phone,
    string AddressLine1,
    string? AddressLine2,
    string City,
    string? State,
    string Country,
    string? PostalCode,
    bool IsDefaultShipping,
    bool IsDefaultBilling
);

public sealed record CustomerOrderSummaryResponse(
    long Id,
    string OrderNumber,
    OrderStatus Status,
    decimal Total,
    string Currency,
    DateTime CreatedAt
);

public sealed record CustomerDetailsResponse(
    long Id,
    string FirstName,
    string? LastName,
    string Phone,
    string? Email,
    string? Address,
    long? CustomerTypeId,
    string? CustomerTypeName,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    IReadOnlyCollection<CustomerAddressResponse> Addresses,
    IReadOnlyCollection<CustomerOrderSummaryResponse> Orders
);
