namespace ECommerce.Services.Customers;

public interface ICurrentCustomerAccessor
{
    string? UserId { get; }
    long? CustomerId { get; }
    bool IsAuthenticated { get; }
    bool IsAdmin { get; }
    Task<long?> GetCustomerTypeIdAsync(CancellationToken cancellationToken = default);
}
