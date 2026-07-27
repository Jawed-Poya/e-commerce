using System.Security.Claims;
using ECommerce.Shared;

namespace ECommerce.Services.Company;

/// <summary>
/// Request-scoped context for the single company installation. The legacy
/// TenantId database columns are retained and always use company id 1 so an
/// existing database can be upgraded without destructive table rewrites.
/// </summary>
public interface ICompanyContext
{
    long CompanyId { get; }
    long? BranchId { get; }
    bool IsResolved { get; }
}

public sealed class CompanyContext : ICompanyContext
{
    public const long SingleCompanyId = 1;

    public long CompanyId { get; private set; } = SingleCompanyId;
    public long? BranchId { get; private set; }
    public bool IsResolved { get; private set; }

    public void Initialize(long? branchId = null)
    {
        BranchId = branchId;
        IsResolved = true;
    }
}

/// <summary>
/// Resolves only the signed branch claim. Workspace headers, storefront keys,
/// custom domains, subscriptions, and company switching are not supported.
/// </summary>
public sealed class CompanyContextMiddleware(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext httpContext, CompanyContext companyContext)
    {
        long? branchId = long.TryParse(
            httpContext.User.FindFirstValue(AuthClaims.BranchId),
            out var parsedBranch)
                ? parsedBranch
                : null;

        companyContext.Initialize(branchId);
        return next(httpContext);
    }
}
