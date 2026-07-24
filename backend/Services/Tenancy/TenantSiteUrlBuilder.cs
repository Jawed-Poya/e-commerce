using ECommerce.Dtos.Tenancy;
using ECommerce.Entities.Tenancy;

namespace ECommerce.Services.Tenancy;

public static class TenantSiteUrlBuilder
{
    public static TenantSiteLinkResponse Build(Tenant tenant, PlatformSetting platform)
    {
        var routingMode = tenant.SiteRoutingMode;
        var storefrontUrl = routingMode switch
        {
            TenantSiteRoutingMode.CustomDomain when platform.AllowCustomDomains && !string.IsNullOrWhiteSpace(tenant.CustomDomain)
                => WithScheme(tenant.CustomDomain),
            TenantSiteRoutingMode.Subdomain when !string.IsNullOrWhiteSpace(platform.RootDomain)
                => BuildSubdomainUrl(tenant.Slug, platform.RootDomain),
            _ => BuildTenantQueryUrl(tenant.StorefrontBaseUrlOverride ?? platform.StorefrontBaseUrl, tenant.Slug)
        };
        var adminUrl = BuildTenantQueryUrl(platform.AdminBaseUrl, tenant.Slug);
        return new TenantSiteLinkResponse(routingMode, storefrontUrl, adminUrl, tenant.CustomDomain, tenant.StorefrontBaseUrlOverride);
    }

    public static string BuildTenantQueryUrl(string baseUrl, string slug)
    {
        var uri = RequireAbsoluteUrl(baseUrl, "Base URL");
        var builder = new UriBuilder(uri);
        var parameters = builder.Query.TrimStart('?')
            .Split('&', StringSplitOptions.RemoveEmptyEntries)
            .Where(item => !item.StartsWith("tenant=", StringComparison.OrdinalIgnoreCase))
            .ToList();
        parameters.Add($"tenant={Uri.EscapeDataString(slug)}");
        builder.Query = string.Join('&', parameters);
        return builder.Uri.ToString().TrimEnd('/');
    }

    public static string NormalizeBaseUrl(string? value, string field)
    {
        var uri = RequireAbsoluteUrl(value, field);
        return uri.ToString().TrimEnd('/');
    }

    public static string? NormalizeDomain(string? value)
    {
        var clean = value?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(clean)) return null;
        if (Uri.TryCreate(clean, UriKind.Absolute, out var absolute)) clean = absolute.Host;
        clean = clean.Trim().TrimEnd('.');
        if (clean.Contains('/') || clean.Contains(':') || !clean.Contains('.') ||
            Uri.CheckHostName(clean) != UriHostNameType.Dns)
            throw new ArgumentException("Enter a valid domain name without a path or port.");
        return clean;
    }

    private static string BuildSubdomainUrl(string slug, string rootDomain)
    {
        var cleanRoot = NormalizeDomain(rootDomain) ?? throw new ArgumentException("Root domain is required for subdomain routing.");
        return $"https://{slug}.{cleanRoot}";
    }

    private static string WithScheme(string domain) => $"https://{NormalizeDomain(domain)}";

    private static Uri RequireAbsoluteUrl(string? value, string field)
    {
        if (!Uri.TryCreate(value?.Trim(), UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            throw new ArgumentException($"{field} must be a complete http or https URL.");
        return uri;
    }
}
