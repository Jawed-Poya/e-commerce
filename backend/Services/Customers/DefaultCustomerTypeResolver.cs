using API.Entities.Types;
using ECommerce.Data;
using ECommerce.Entities.Common;
using ECommerce.Options;
using ECommerce.Shared;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace ECommerce.Services.Customers;

public sealed class DefaultCustomerTypeResolver(
    ApplicationDbContext context,
    IOptions<CommerceOptions> options,
    IMemoryCache cache) : IDefaultCustomerTypeResolver
{
    private const string CacheKey = "commerce:default-customer-type";
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(2);
    private readonly CommerceOptions _options = options.Value;

    public async Task<GeneralType> GetAsync(CancellationToken cancellationToken = default)
    {
        if (cache.TryGetValue<GeneralType>(CacheKey, out var cached) && cached is not null)
            return cached;

        var customerType = await TransientSqlRetry.ExecuteAsync(
            async token =>
            {
                GeneralType? resolved = null;

                if (_options.DefaultCustomerTypeId.HasValue)
                {
                    resolved = await context.Types
                        .AsNoTracking()
                        .FirstOrDefaultAsync(type =>
                            type.Id == _options.DefaultCustomerTypeId.Value &&
                            type.Group == GeneralTypeEnum.CustomerType,
                            token);
                }

                resolved ??= await context.Types
                    .AsNoTracking()
                    .Where(type => type.Group == GeneralTypeEnum.CustomerType)
                    .OrderByDescending(type => type.Name == "General" || type.Name == "Default")
                    .ThenBy(type => type.SortOrder ?? int.MaxValue)
                    .ThenBy(type => type.Id)
                    .FirstOrDefaultAsync(token);

                return resolved ?? throw new InvalidOperationException(
                    "No customer type is configured. Create a General customer type first.");
            },
            cancellationToken);

        cache.Set(CacheKey, customerType, CacheDuration);
        return customerType;
    }

    public async Task<long> GetIdAsync(CancellationToken cancellationToken = default) =>
        (await GetAsync(cancellationToken)).Id;

    public void Invalidate() => cache.Remove(CacheKey);
}
