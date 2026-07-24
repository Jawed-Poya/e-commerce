using System.Net;
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

        var requestHost = httpContext.Request.Host.Host;
        var forwardedTenantHost = NormalizeHost(httpContext.Request.Headers["X-Tenant-Host"].FirstOrDefault());
        var host = forwardedTenantHost ?? NormalizeHost(requestHost) ?? "localhost";
        var isLocalHost = string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase);
        var isIpAddress = IPAddress.TryParse(host, out _);
        string? customDomainSlug = null;
        TenantSiteRoutingMode? requiredHostRoutingMode = null;
        PlatformSetting? platformSettings = null;

        if (!isLocalHost && !isIpAddress)
        {
            platformSettings = await dbContext.PlatformSettings.AsNoTracking()
                .FirstOrDefaultAsync(item => item.Id == 1, httpContext.RequestAborted);
            if (platformSettings?.AllowCustomDomains != false)
            {
                customDomainSlug = await dbContext.Tenants.AsNoTracking()
                    .Where(item => item.CustomDomain == host && item.SiteRoutingMode == TenantSiteRoutingMode.CustomDomain)
                    .Select(item => item.Slug)
                    .FirstOrDefaultAsync(httpContext.RequestAborted);
                if (customDomainSlug is not null)
                    requiredHostRoutingMode = TenantSiteRoutingMode.CustomDomain;
            }
        }

        // A registered custom domain is authoritative. Query/header selection is
        // used by shared storefront/admin hosts, and subdomains are resolved only
        // under the configured root domain (never from an arbitrary hostname).
        var requestedSlug = customDomainSlug
            ?? httpContext.Request.Headers["X-Tenant-Slug"].FirstOrDefault()
            ?? httpContext.Request.Query["tenant"].FirstOrDefault();

        if (string.IsNullOrWhiteSpace(requestedSlug) && !isLocalHost && !isIpAddress)
        {
            platformSettings ??= await dbContext.PlatformSettings.AsNoTracking()
                .FirstOrDefaultAsync(item => item.Id == 1, httpContext.RequestAborted);
            var rootDomain = platformSettings?.RootDomain?.Trim().TrimEnd('.').ToLowerInvariant();
            var storefrontHost = TryGetHost(platformSettings?.StorefrontBaseUrl);
            var adminHost = TryGetHost(platformSettings?.AdminBaseUrl);
            if (!string.IsNullOrWhiteSpace(rootDomain) &&
                !string.Equals(host, storefrontHost, StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(host, adminHost, StringComparison.OrdinalIgnoreCase) &&
                host.EndsWith($".{rootDomain}", StringComparison.OrdinalIgnoreCase))
            {
                var prefix = host[..^(rootDomain.Length + 1)];
                if (!string.IsNullOrWhiteSpace(prefix) && !prefix.Contains('.'))
                {
                    requestedSlug = prefix;
                    requiredHostRoutingMode = TenantSiteRoutingMode.Subdomain;
                }
            }
        }

        if (!string.IsNullOrWhiteSpace(requestedSlug))
        {
            var requestedTenant = await dbContext.Tenants.AsNoTracking()
                .Where(item => item.Slug == requestedSlug &&
                    (!requiredHostRoutingMode.HasValue || item.SiteRoutingMode == requiredHostRoutingMode.Value))
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
            .Where(item => item.IsActive && item.Slug == "default")
            .Select(item => new { item.Id, item.Slug })
            .FirstOrDefaultAsync(httpContext.RequestAborted)
            ?? await dbContext.Tenants.AsNoTracking()
                .Where(item => item.IsActive)
                .OrderBy(item => item.Id)
                .Select(item => new { item.Id, item.Slug })
                .FirstOrDefaultAsync(httpContext.RequestAborted);

        if (fallback is null || !await HasUsableSubscriptionAsync(dbContext, fallback.Id, httpContext.RequestAborted))
        {
            await WriteErrorAsync(httpContext, StatusCodes.Status404NotFound, "No active company workspace is available.");
            return;
        }

        tenantContext.Initialize(fallback.Id, null, fallback.Slug, isPlatformAdmin);
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

    private static string? NormalizeHost(string? value)
    {
        var host = value?.Trim().TrimEnd('.').ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(host)) return null;
        if (host.StartsWith('[') && host.EndsWith(']')) host = host[1..^1];
        if (host.Contains('/') || host.Contains('\\')) return null;
        if (host.Contains(':') && !IPAddress.TryParse(host, out _)) return null;
        return host;
    }

    private static string? TryGetHost(string? value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri)
            ? uri.Host.Trim().TrimEnd('.').ToLowerInvariant()
            : null;

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
