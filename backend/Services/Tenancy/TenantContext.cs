using System.Security.Claims;
using ECommerce.Data;
using ECommerce.Entities.Tenancy;
using ECommerce.Shared;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Tenancy;

public interface ITenantContext
{
    long TenantId { get; }
    long? BranchId { get; }
    string TenantSlug { get; }
    bool IsPlatformAdmin { get; }
    bool IsResolved { get; }
}

public sealed class TenantContext : ITenantContext
{
    public long TenantId { get; private set; } = 1;
    public long? BranchId { get; private set; }
    public string TenantSlug { get; private set; } = "default";
    public bool IsPlatformAdmin { get; private set; }
    public bool IsResolved { get; private set; }

    public void Initialize(long tenantId, long? branchId, string slug, bool isPlatformAdmin)
    {
        TenantId = tenantId <= 0 ? 1 : tenantId;
        BranchId = branchId;
        TenantSlug = string.IsNullOrWhiteSpace(slug) ? "default" : slug;
        IsPlatformAdmin = isPlatformAdmin;
        IsResolved = true;
    }
}

public sealed class TenantResolutionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(
        HttpContext httpContext,
        TenantContext tenantContext,
        ApplicationDbContext dbContext)
    {
        var principal = httpContext.User;
        var isPlatformAdmin = principal.IsInRole(AppRoles.PlatformAdmin) ||
            string.Equals(
                principal.FindFirstValue(AuthClaims.PlatformAdmin),
                "true",
                StringComparison.OrdinalIgnoreCase);

        if (long.TryParse(principal.FindFirstValue(AuthClaims.TenantId), out var claimTenantId))
        {
            long? branchId = long.TryParse(
                principal.FindFirstValue(AuthClaims.BranchId),
                out var parsedBranch)
                    ? parsedBranch
                    : null;
            var slug = principal.FindFirstValue(AuthClaims.TenantSlug) ?? "default";

            if (!isPlatformAdmin && !await CanUseTenantAsync(dbContext, claimTenantId, httpContext.RequestAborted))
            {
                await WriteErrorAsync(
                    httpContext,
                    StatusCodes.Status403Forbidden,
                    "This company workspace is inactive or its subscription has expired.");
                return;
            }

            tenantContext.Initialize(claimTenantId, branchId, slug, isPlatformAdmin);
            await next(httpContext);
            return;
        }

        var requestedSlug = httpContext.Request.Headers["X-Tenant-Slug"].FirstOrDefault()
            ?? httpContext.Request.Query["tenant"].FirstOrDefault();

        if (string.IsNullOrWhiteSpace(requestedSlug))
        {
            var host = httpContext.Request.Host.Host;
            var labels = host.Split('.', StringSplitOptions.RemoveEmptyEntries);
            if (labels.Length > 2 && !string.Equals(labels[0], "www", StringComparison.OrdinalIgnoreCase))
                requestedSlug = labels[0];
        }

        if (!string.IsNullOrWhiteSpace(requestedSlug))
        {
            var requestedTenant = await dbContext.Tenants.AsNoTracking()
                .Where(item => item.Slug == requestedSlug)
                .Select(item => new { item.Id, item.Slug, item.IsActive })
                .FirstOrDefaultAsync(httpContext.RequestAborted);

            if (requestedTenant is null)
            {
                await WriteErrorAsync(httpContext, StatusCodes.Status404NotFound, "Company workspace not found.");
                return;
            }

            if (!requestedTenant.IsActive ||
                !await HasUsableSubscriptionAsync(dbContext, requestedTenant.Id, httpContext.RequestAborted))
            {
                await WriteErrorAsync(httpContext, StatusCodes.Status403Forbidden, "This company workspace is currently unavailable.");
                return;
            }

            tenantContext.Initialize(requestedTenant.Id, null, requestedTenant.Slug, isPlatformAdmin);
            await next(httpContext);
            return;
        }

        var fallback = await dbContext.Tenants.AsNoTracking()
            .Where(item => item.IsActive)
            .OrderBy(item => item.Id)
            .Select(item => new { item.Id, item.Slug })
            .FirstOrDefaultAsync(httpContext.RequestAborted);
        tenantContext.Initialize(fallback?.Id ?? 1, null, fallback?.Slug ?? "default", isPlatformAdmin);
        await next(httpContext);
    }

    private static async Task<bool> CanUseTenantAsync(
        ApplicationDbContext dbContext,
        long tenantId,
        CancellationToken cancellationToken)
    {
        var active = await dbContext.Tenants.AsNoTracking()
            .AnyAsync(item => item.Id == tenantId && item.IsActive, cancellationToken);
        return active && await HasUsableSubscriptionAsync(dbContext, tenantId, cancellationToken);
    }

    private static async Task<bool> HasUsableSubscriptionAsync(
        ApplicationDbContext dbContext,
        long tenantId,
        CancellationToken cancellationToken)
    {
        var subscription = await dbContext.TenantSubscriptions.AsNoTracking()
            .Where(item => item.TenantId == tenantId)
            .OrderByDescending(item => item.StartsAt)
            .Select(item => new { item.Status, item.EndsAt })
            .FirstOrDefaultAsync(cancellationToken);

        if (subscription is null)
            return false;
        if (subscription.Status is SubscriptionStatus.Suspended or
            SubscriptionStatus.Cancelled or SubscriptionStatus.Expired)
            return false;
        return !subscription.EndsAt.HasValue || subscription.EndsAt.Value >= DateTime.UtcNow;
    }

    private static async Task WriteErrorAsync(
        HttpContext context,
        int statusCode,
        string message)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new
        {
            success = false,
            message
        }, context.RequestAborted);
    }
}
