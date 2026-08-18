using ECommerce.Entities.Orders;

namespace ECommerce.Entities.Customers.Contracts;

public sealed record UpsertCustomerRequest(
    string FirstName,
    string? LastName,
    string Phone,
    string? Email,
    string? Address,
    long? CustomerTypeId,
    decimal? CreditLimit = null,
    int? DebtDueDays = null
);

public sealed record CustomerListItemResponse(
    long Id,
    string Name,
    string Phone,
    string? WhatsAppUrl,
    string? Email,
    string? CustomerTypeName,
    int OrderCount,
    decimal TotalSpent,
    decimal OutstandingDebt,
    decimal AccountCredit,
    decimal CreditLimit,
    bool HasOverdueDebt,
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

public sealed record CustomerEngagementResponse(
    long CustomerId,
    bool IsOnline,
    int ActiveSessions,
    string? CurrentPath,
    string? PageTitle,
    DateTime? LastSeenAt,
    int VisitsLast30Days,
    int UniqueSessionsLast30Days,
    int ProductViewsLast30Days,
    int SearchesLast30Days,
    string? LastSearchTerm);

public sealed record CustomerDetailsResponse(
    long Id,
    string FirstName,
    string? LastName,
    string Phone,
    string? WhatsAppUrl,
    string? Email,
    string? Address,
    long? CustomerTypeId,
    string? CustomerTypeName,
    decimal OutstandingDebt,
    decimal AccountCredit,
    decimal CreditLimit,
    int DebtDueDays,
    bool HasOverdueDebt,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    IReadOnlyCollection<CustomerAddressResponse> Addresses,
    IReadOnlyCollection<CustomerOrderSummaryResponse> Orders
);
