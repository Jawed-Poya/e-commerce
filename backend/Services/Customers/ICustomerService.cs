using ECommerce.Entities.Common;
using ECommerce.Entities.Customers.Contracts;
using ECommerce.Entities.Customers.Filters;

namespace ECommerce.Services.Customers;

public interface ICustomerService
{
    Task<PagedResult<CustomerListItemResponse>> GetAsync(
        CustomerFilter filter,
        CancellationToken cancellationToken = default);

    Task<CustomerDetailsResponse?> GetByIdAsync(
        long id,
        CancellationToken cancellationToken = default);

    Task<CustomerDetailsResponse> CreateAsync(
        UpsertCustomerRequest request,
        CancellationToken cancellationToken = default);

    Task<CustomerDetailsResponse> UpdateAsync(
        long id,
        UpsertCustomerRequest request,
        CancellationToken cancellationToken = default);

    Task DeleteAsync(
        long id,
        CancellationToken cancellationToken = default);
}
