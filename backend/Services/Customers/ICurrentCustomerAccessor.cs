namespace ECommerce.Services.Customers;

public interface ICurrentCustomerAccessor
{
    string? UserId { get; }
    long? CustomerId { get; }
    bool IsAuthenticated { get; }
    bool IsAdmin { get; }
    Task<long?> ResolveCustomerIdAsync(CancellationToken cancellationToken = default);
    Task<long?> GetCustomerTypeIdAsync(CancellationToken cancellationToken = default);
}
