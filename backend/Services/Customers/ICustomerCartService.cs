using ECommerce.Entities.Customers.Contracts;

namespace ECommerce.Services.Customers;

public interface ICustomerCartService
{
    Task<CustomerCartResponse> GetAsync(CancellationToken cancellationToken = default);
    Task<CustomerCartResponse> UpdateAsync(
        UpdateCustomerCartRequest request,
        CancellationToken cancellationToken = default);
}

public sealed class CustomerCartConflictException : Exception
{
    public CustomerCartConflictException()
        : base("The cart changed on another device. Refresh and try again.")
    {
    }
}
