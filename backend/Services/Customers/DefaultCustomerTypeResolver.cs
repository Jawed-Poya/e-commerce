using API.Entities.Types;
using ECommerce.Data;
using ECommerce.Entities.Common;
using ECommerce.Options;
using ECommerce.Services.Tenancy;
using ECommerce.Shared;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace ECommerce.Services.Customers;

public sealed class DefaultCustomerTypeResolver(
    ApplicationDbContext context,
    ITenantContext tenantContext,
    IOptions<CommerceOptions> options,
    IMemoryCache cache) : IDefaultCustomerTypeResolver
{
    private const string CacheKeyPrefix = "commerce:default-customer-type";
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(2);
    private readonly CommerceOptions _options = options.Value;

    public async Task<GeneralType> GetAsync(CancellationToken cancellationToken = default)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId <= 0)
            throw new InvalidOperationException("A company workspace must be resolved before customer pricing can be loaded.");

        var cacheKey = CacheKey(tenantId);
        if (cache.TryGetValue<GeneralType>(cacheKey, out var cached) && cached is not null)
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

                if (resolved is not null)
                    return resolved;

                var archivedGeneral = await context.Types
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(type =>
                        type.TenantId == tenantId &&
                        type.Group == GeneralTypeEnum.CustomerType &&
                        type.Name == "General",
                        token);
                if (archivedGeneral is not null)
                {
                    archivedGeneral.IsDeleted = false;
                    archivedGeneral.DeletedAt = null;
                    archivedGeneral.UpdatedAt = DateTime.UtcNow;
                    await context.SaveChangesAsync(token);
                    return archivedGeneral;
                }

                var branchId = await context.Branches
                    .Where(branch => branch.TenantId == tenantId && branch.IsActive)
                    .OrderByDescending(branch => branch.IsMain)
                    .ThenBy(branch => branch.Id)
                    .Select(branch => (long?)branch.Id)
                    .FirstOrDefaultAsync(token);

                var general = new GeneralType
                {
                    TenantId = tenantId,
                    BranchId = branchId,
                    Name = "General",
                    Group = GeneralTypeEnum.CustomerType,
                    SortOrder = 0
                };
                context.Types.Add(general);
                try
                {
                    await context.SaveChangesAsync(token);
                    return general;
                }
                catch (DbUpdateException)
                {
                    context.Entry(general).State = EntityState.Detached;
                    var concurrent = await context.Types
                        .AsNoTracking()
                        .Where(type => type.Group == GeneralTypeEnum.CustomerType && type.Name == "General")
                        .OrderBy(type => type.Id)
                        .FirstOrDefaultAsync(token);
                    if (concurrent is not null)
                        return concurrent;
                    throw;
                }
            },
            cancellationToken);

        cache.Set(cacheKey, customerType, CacheDuration);
        return customerType;
    }

    public async Task<long> GetIdAsync(CancellationToken cancellationToken = default) =>
        (await GetAsync(cancellationToken)).Id;

    public void Invalidate()
    {
        if (tenantContext.TenantId > 0)
            cache.Remove(CacheKey(tenantContext.TenantId));
    }

    private static string CacheKey(long tenantId) => $"{CacheKeyPrefix}:{tenantId}";
}
