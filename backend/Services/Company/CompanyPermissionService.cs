using System.Security.Claims;
using ECommerce.Data;
using ECommerce.Shared;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Company;

public interface ICompanyPermissionService
{
    Task<IReadOnlyCollection<string>> GetCompanyPermissionsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<string>> GetAssignablePermissionsAsync(ClaimsPrincipal user, CancellationToken cancellationToken = default);
    Task ValidateAssignableAsync(ClaimsPrincipal user, IEnumerable<string> requested, CancellationToken cancellationToken = default);
}

public sealed class CompanyPermissionService(ApplicationDbContext context) : ICompanyPermissionService
{
    public Task<IReadOnlyCollection<string>> GetCompanyPermissionsAsync(
        CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyCollection<string>>(
            AppPermissions.All.OrderBy(value => value).ToArray());

    public async Task<IReadOnlyCollection<string>> GetAssignablePermissionsAsync(
        ClaimsPrincipal user,
        CancellationToken cancellationToken = default)
    {
        var claimManagementEnabled = await context.TenantSettings
            .AsNoTracking()
            .Where(item => item.TenantId == ECommerce.Services.Company.CompanyContext.SingleCompanyId)
            .Select(item => item.AllowTenantUserClaimManagement)
            .FirstOrDefaultAsync(cancellationToken);

        if (!claimManagementEnabled)
            return Array.Empty<string>();

        var ownPermissions = user.Claims
            .Where(claim => claim.Type == AuthClaims.Permission)
            .Select(claim => claim.Value)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return AppPermissions.All
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
