using System.Security.Claims;
using ECommerce.Data;
using ECommerce.Shared;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Tenancy;

public interface ITenantPermissionService
{
    Task<IReadOnlyCollection<string>> GetTenantPermissionsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<string>> GetAssignablePermissionsAsync(ClaimsPrincipal user, CancellationToken cancellationToken = default);
    Task ValidateAssignableAsync(ClaimsPrincipal user, IEnumerable<string> requested, CancellationToken cancellationToken = default);
}

public sealed class TenantPermissionService(
    ApplicationDbContext context,
    ITenantContext tenantContext) : ITenantPermissionService
{
    public async Task<IReadOnlyCollection<string>> GetTenantPermissionsAsync(CancellationToken cancellationToken = default)
    {
        if (tenantContext.IsPlatformAdmin)
            return AppPermissions.All.OrderBy(value => value).ToArray();

        var granted = await context.TenantPermissionGrants.AsNoTracking()
            .Where(item => item.TenantId == tenantContext.TenantId && item.IsEnabled)
            .Select(item => item.Permission)
            .Where(permission => AppPermissions.All.Contains(permission))
            .Distinct()
            .ToArrayAsync(cancellationToken);

        var planId = await context.TenantSubscriptions.AsNoTracking()
            .Where(item => item.TenantId == tenantContext.TenantId)
            .OrderByDescending(item => item.StartsAt)
            .Select(item => item.SubscriptionPlanId)
            .FirstOrDefaultAsync(cancellationToken);
        if (!planId.HasValue)
            return granted.OrderBy(value => value).ToArray();

        var planPermissions = await context.SubscriptionPlanPermissions.AsNoTracking()
            .Where(item => item.SubscriptionPlanId == planId.Value && item.IsEnabled)
            .Select(item => item.Permission)
            .ToArrayAsync(cancellationToken);
        var allowed = planPermissions.ToHashSet(StringComparer.OrdinalIgnoreCase);
        return granted.Where(allowed.Contains).OrderBy(value => value).ToArray();
    }

    public async Task<IReadOnlyCollection<string>> GetAssignablePermissionsAsync(
        ClaimsPrincipal user,
        CancellationToken cancellationToken = default)
    {
        var tenantPermissions = (await GetTenantPermissionsAsync(cancellationToken))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (tenantContext.IsPlatformAdmin)
            return tenantPermissions.OrderBy(value => value).ToArray();

        var claimManagementEnabled = await context.TenantSettings.AsNoTracking()
            .Where(item => item.TenantId == tenantContext.TenantId)
            .Select(item => item.AllowTenantUserClaimManagement)
            .FirstOrDefaultAsync(cancellationToken);
        if (!claimManagementEnabled)
            return Array.Empty<string>();

        var ownPermissions = user.Claims
            .Where(claim => claim.Type == AuthClaims.Permission)
            .Select(claim => claim.Value)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return tenantPermissions
            .Where(ownPermissions.Contains)
            .OrderBy(value => value)
            .ToArray();
    }

    public async Task ValidateAssignableAsync(
        ClaimsPrincipal user,
        IEnumerable<string> requested,
        CancellationToken cancellationToken = default)
    {
        var allowed = (await GetAssignablePermissionsAsync(user, cancellationToken))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var invalid = requested
            .Where(value => !allowed.Contains(value))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (invalid.Length > 0)
            throw new UnauthorizedAccessException(
                $"You cannot assign these permissions: {string.Join(", ", invalid)}.");
    }
}
