using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Routing;

namespace ECommerce.Shared;

/// <summary>
/// Fails fast when a new admin API endpoint is accidentally exposed without
/// authorization metadata. Source-specific checks (for example receipts) can
/// still perform a stricter permission check inside the action.
/// </summary>
public static class AdminEndpointSecurityValidator
{
    public static void ValidateAdminEndpointAuthorization(this WebApplication app)
    {
        var dataSource = app.Services.GetRequiredService<EndpointDataSource>();
        var unsecured = dataSource.Endpoints
            .OfType<RouteEndpoint>()
            .Where(endpoint =>
                endpoint.RoutePattern.RawText?.StartsWith("api/admin", StringComparison.OrdinalIgnoreCase) == true)
            .Where(endpoint => endpoint.Metadata.GetMetadata<IAllowAnonymous>() is null)
            .Where(endpoint => endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>().Count == 0)
            .Select(endpoint => endpoint.RoutePattern.RawText)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(route => route)
            .ToArray();

        if (unsecured.Length > 0)
        {
            throw new InvalidOperationException(
                "Admin API endpoints must declare authorization metadata: " +
                string.Join(", ", unsecured));
        }
    }
}
