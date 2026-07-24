using ECommerce.Data;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Tenancy;

/// <summary>
/// Builds the named API CORS policy from platform routing settings and tenant
/// custom domains. The short cache keeps preflight requests inexpensive while
/// allowing newly linked domains to become usable without restarting the API.
/// </summary>
public sealed class TenantCorsPolicyProvider(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration) : ICorsPolicyProvider
{
    private static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(5);
    private readonly SemaphoreSlim refreshLock = new(1, 1);
    private DateTimeOffset expiresAt;
    private HashSet<string> exactOrigins = new(StringComparer.OrdinalIgnoreCase);

    public async Task<CorsPolicy?> GetPolicyAsync(HttpContext context, string? policyName)
    {
        if (!string.Equals(policyName, "CorsPolicy", StringComparison.Ordinal))
            return null;

        await EnsureCacheAsync(context.RequestAborted);
        var origins = exactOrigins;

        return new CorsPolicyBuilder()
            .SetIsOriginAllowed(origin => IsAllowedOrigin(origin, origins))
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials()
            .Build();
    }

    private async Task EnsureCacheAsync(CancellationToken cancellationToken)
    {
        if (DateTimeOffset.UtcNow < expiresAt) return;
        await refreshLock.WaitAsync(cancellationToken);
        try
        {
            if (DateTimeOffset.UtcNow < expiresAt) return;

            var refreshed = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var configuredOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ??
                ["http://localhost:5173", "http://localhost:5174", "http://localhost:4173", "http://localhost:4174"];
            foreach (var origin in configuredOrigins)
                AddOrigin(refreshed, origin);

            try
            {
                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var settings = await db.PlatformSettings.AsNoTracking()
                    .FirstOrDefaultAsync(item => item.Id == 1, cancellationToken);
                if (settings is not null)
                {
                    AddOrigin(refreshed, settings.StorefrontBaseUrl);
                    AddOrigin(refreshed, settings.AdminBaseUrl);
                }

                var configuredRoot = TenantSiteUrlBuilder.NormalizeDomain(settings?.RootDomain);
                if (configuredRoot is not null)
                {
                    var tenantSlugs = await db.Tenants.AsNoTracking()
                        .Where(item => item.IsActive && item.SiteRoutingMode == TenantSiteRoutingMode.Subdomain)
                        .Select(item => item.Slug)
                        .ToArrayAsync(cancellationToken);
                    foreach (var slug in tenantSlugs)
                    {
                        refreshed.Add($"https://{slug}.{configuredRoot}");
                        refreshed.Add($"http://{slug}.{configuredRoot}");
                    }
                }

                if (settings?.AllowCustomDomains != false)
                {
                    var customDomains = await db.Tenants.AsNoTracking()
                        .Where(item => item.IsActive && item.SiteRoutingMode == TenantSiteRoutingMode.CustomDomain && item.CustomDomain != null)
                        .Select(item => item.CustomDomain!)
                        .ToArrayAsync(cancellationToken);
                    foreach (var domain in customDomains)
                    {
                        var normalized = TenantSiteUrlBuilder.NormalizeDomain(domain);
                        if (normalized is null) continue;
                        refreshed.Add($"https://{normalized}");
                        refreshed.Add($"http://{normalized}");
                    }
                }
            }
            catch
            {
                // Startup/configured origins remain available if the database is
                // temporarily unavailable during a preflight request.
            }

            exactOrigins = refreshed;
            expiresAt = DateTimeOffset.UtcNow.Add(CacheDuration);
        }
        finally
        {
            refreshLock.Release();
        }
    }

    private static bool IsAllowedOrigin(string origin, IReadOnlySet<string> exact)
    {
        var normalizedOrigin = NormalizeOrigin(origin);
        return normalizedOrigin is not null && exact.Contains(normalizedOrigin);
    }

    private static void AddOrigin(ISet<string> origins, string? value)
    {
        var normalized = NormalizeOrigin(value);
        if (normalized is not null) origins.Add(normalized);
    }

    private static string? NormalizeOrigin(string? value)
    {
        if (!Uri.TryCreate(value?.Trim(), UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            return null;
        return uri.GetLeftPart(UriPartial.Authority).TrimEnd('/').ToLowerInvariant();
    }
}
