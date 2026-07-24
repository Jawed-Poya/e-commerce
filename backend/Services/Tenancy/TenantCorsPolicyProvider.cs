using ECommerce.Data;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Tenancy;

/// <summary>
/// Builds the API CORS policy for the single hosted platform. The API accepts
/// requests only from configured development origins and the shared admin and
/// storefront deployments stored in PlatformSettings. Tenant selection happens
/// inside those applications and never expands the list of browser origins.
/// </summary>
public sealed class TenantCorsPolicyProvider(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration) : ICorsPolicyProvider
{
    private static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(15);
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
            .SetIsOriginAllowed(origin =>
            {
                var normalized = NormalizeOrigin(origin);
                return normalized is not null && origins.Contains(normalized);
            })
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
            foreach (var origin in configuredOrigins) AddOrigin(refreshed, origin);

            try
            {
                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var settings = await db.PlatformSettings.AsNoTracking()
                    .FirstOrDefaultAsync(item => item.Id == 1, cancellationToken);
                AddOrigin(refreshed, settings?.StorefrontBaseUrl);
                AddOrigin(refreshed, settings?.AdminBaseUrl);
            }
            catch
            {
                // Keep configured development/production origins available while
                // the database is starting or temporarily unavailable.
            }

            exactOrigins = refreshed;
            expiresAt = DateTimeOffset.UtcNow.Add(CacheDuration);
        }
        finally
        {
            refreshLock.Release();
        }
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
