using System.Security.Claims;
using ECommerce.Shared;

namespace ECommerce.Services.Company;

public interface IBranchContext
{
    long? BranchId { get; }
}

public sealed class BranchContext : IBranchContext
{
    public long? BranchId { get; private set; }

    public void Initialize(long? branchId) => BranchId = branchId;
}

/// <summary>
/// Resolves the optional signed branch claim. It does not select or scope a
/// company; the application has exactly one company installation.
/// </summary>
public sealed class BranchContextMiddleware(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext httpContext, BranchContext branchContext)
    {
        var branchId = long.TryParse(
            httpContext.User.FindFirstValue(AuthClaims.BranchId),
            out var parsedBranch)
                ? parsedBranch
                : (long?)null;

        branchContext.Initialize(branchId);
        return next(httpContext);
    }
}
