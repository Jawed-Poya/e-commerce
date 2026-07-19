using API.Entities.Types;
using ECommerce.Data;
using ECommerce.Entities.Common;
using ECommerce.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ECommerce.Services.Customers;

public sealed class DefaultCustomerTypeResolver(
    ApplicationDbContext context,
    IOptions<CommerceOptions> options) : IDefaultCustomerTypeResolver
{
    private readonly CommerceOptions _options = options.Value;

    public async Task<GeneralType> GetAsync(CancellationToken cancellationToken = default)
    {
        GeneralType? customerType = null;

        if (_options.DefaultCustomerTypeId.HasValue)
        {
            customerType = await context.Types
                .AsNoTracking()
                .FirstOrDefaultAsync(type =>
                    type.Id == _options.DefaultCustomerTypeId.Value &&
                    type.Group == GeneralTypeEnum.CustomerType,
                    cancellationToken);
        }

        customerType ??= await context.Types
            .AsNoTracking()
            .Where(type => type.Group == GeneralTypeEnum.CustomerType)
            .OrderByDescending(type => type.Name == "General" || type.Name == "Default")
            .ThenBy(type => type.SortOrder ?? int.MaxValue)
            .ThenBy(type => type.Id)
            .FirstOrDefaultAsync(cancellationToken);

        return customerType ?? throw new InvalidOperationException(
            "No customer type is configured. Create a General customer type first.");
    }

    public async Task<long> GetIdAsync(CancellationToken cancellationToken = default) =>
        (await GetAsync(cancellationToken)).Id;
}
