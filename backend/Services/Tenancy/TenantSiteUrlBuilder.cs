using ECommerce.Dtos.Tenancy;
using ECommerce.Entities.Tenancy;

namespace ECommerce.Services.Tenancy;

public static class TenantSiteUrlBuilder
{
    public static TenantSiteLinkResponse Build(Tenant tenant, PlatformSetting platform)
    {
        var storefrontUrl = tenant.IsStorefrontPublished && tenant.StorefrontAccessMode == StorefrontAccessMode.Public
            ? BuildStorefrontUrl(platform.StorefrontBaseUrl, tenant.StorefrontKey)
            : null;
        var adminUrl = BuildAdminUrl(platform.AdminBaseUrl, tenant.Slug);
        return new TenantSiteLinkResponse(
            TenantSiteRoutingMode.PlatformPath,
            tenant.StorefrontAccessMode,
            tenant.IsStorefrontPublished,
            tenant.StorefrontKey,
            storefrontUrl,
            adminUrl,
            tenant.Slug,
            tenant.CustomDomain,
            tenant.StorefrontBaseUrlOverride);
    }

    public static string BuildStorefrontUrl(string baseUrl, string storefrontKey) =>
        AppendPath(baseUrl, $"store/{Uri.EscapeDataString(storefrontKey)}");

    public static string BuildPreviewUrl(string baseUrl, string token) =>
        AppendPath(baseUrl, $"preview/{Uri.EscapeDataString(token)}");

    public static string BuildAdminUrl(string baseUrl, string workspaceCode) =>
        AppendPath(baseUrl, $"workspace/{Uri.EscapeDataString(workspaceCode)}/login");

    public static string NormalizeBaseUrl(string? value, string field)
    {
        var uri = RequireAbsoluteUrl(value, field);
        return uri.ToString().TrimEnd('/');
    }

    // Retained for backward-compatible migrations and old database values. The
    // active single-host platform no longer resolves tenants by domain.
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

    private static string AppendPath(string baseUrl, string path)
    {
        var uri = RequireAbsoluteUrl(baseUrl, "Base URL");
        var builder = new UriBuilder(uri);
        var basePath = builder.Path.TrimEnd('/');
        builder.Path = $"{basePath}/{path.TrimStart('/')}";
        builder.Query = string.Empty;
        builder.Fragment = string.Empty;
        return builder.Uri.ToString().TrimEnd('/');
    }

    private static Uri RequireAbsoluteUrl(string? value, string field)
    {
        if (!Uri.TryCreate(value?.Trim(), UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            throw new ArgumentException($"{field} must be a complete http or https URL.");
        return uri;
    }
}
