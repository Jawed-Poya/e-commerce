using API.Entities.Types;

namespace ECommerce.Services.Customers;

public interface IDefaultCustomerTypeResolver
{
    Task<GeneralType> GetAsync(CancellationToken cancellationToken = default);
    Task<long> GetIdAsync(CancellationToken cancellationToken = default);
    void Invalidate();
}
