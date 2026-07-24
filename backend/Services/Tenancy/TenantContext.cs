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
        ApplicationDbContext dbContext,
        IStorefrontAccessTokenService previewTokens)
    {
        var principal = httpContext.User;
        var isPlatformAdmin = principal.IsInRole(AppRoles.PlatformAdmin) ||
            string.Equals(
                principal.FindFirstValue(AuthClaims.PlatformAdmin),
                "true",
                StringComparison.OrdinalIgnoreCase);

        // Authenticated admin/customer requests are always isolated by the tenant
        // claim in the signed JWT. Browser headers and URLs cannot override it.
        if (long.TryParse(principal.FindFirstValue(AuthClaims.TenantId), out var claimTenantId))
        {
            // Storefront customer sessions must stay on the same storefront that
            // issued them. Changing /store/{key} or a preview token never switches
            // an authenticated session into another company's data.
            var presentedKeyHeader = httpContext.Request.Headers["X-Storefront-Key"].FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(presentedKeyHeader))
            {
                var presentedKey = NormalizeStorefrontKey(presentedKeyHeader);
                var keyMatchesClaim = presentedKey is not null && await dbContext.Tenants.AsNoTracking()
                    .AnyAsync(item => item.Id == claimTenantId && item.StorefrontKey == presentedKey, httpContext.RequestAborted);
                if (!keyMatchesClaim)
                {
                    await WriteErrorAsync(httpContext, StatusCodes.Status401Unauthorized,
                        "This customer session belongs to a different storefront. Sign in again from the current store.");
                    return;
                }
            }

            var presentedPreview = httpContext.Request.Headers["X-Storefront-Preview"].FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(presentedPreview))
            {
                var previewMatchesClaim = previewTokens.TryValidatePreviewToken(presentedPreview, out var payload) &&
                    payload is not null && payload.TenantId == claimTenantId &&
                    await dbContext.Tenants.AsNoTracking().AnyAsync(
                        item => item.Id == claimTenantId && item.StorefrontKey == payload.StorefrontKey,
                        httpContext.RequestAborted);
                if (!previewMatchesClaim)
                {
                    await WriteErrorAsync(httpContext, StatusCodes.Status401Unauthorized,
                        "This customer session does not belong to the current storefront preview.");
                    return;
                }
            }
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

        // A preview token is signed, tenant-scoped, store-key-scoped, and expires.
        // It is the only way to open a private or unpublished storefront preview.
        var previewToken = httpContext.Request.Headers["X-Storefront-Preview"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(previewToken))
        {
            if (!previewTokens.TryValidatePreviewToken(previewToken, out var preview) || preview is null)
            {
                await WriteErrorAsync(httpContext, StatusCodes.Status401Unauthorized, "The storefront preview link is invalid or expired.");
                return;
            }

            var previewTenant = await dbContext.Tenants.AsNoTracking()
                .Where(item => item.Id == preview.TenantId && item.StorefrontKey == preview.StorefrontKey)
                .Select(item => new { item.Id, item.Slug, item.IsActive })
                .FirstOrDefaultAsync(httpContext.RequestAborted);
            if (previewTenant is null || !previewTenant.IsActive ||
                !await HasUsableSubscriptionAsync(dbContext, previewTenant.Id, httpContext.RequestAborted))
            {
                await WriteErrorAsync(httpContext, StatusCodes.Status404NotFound, "The storefront preview is no longer available.");
                return;
            }

            tenantContext.Initialize(previewTenant.Id, null, previewTenant.Slug, false);
            await next(httpContext);
            return;
        }

        // Public storefront requests use a random opaque key embedded in the path.
        // The company slug is never accepted as public-site authority.
        var storefrontKey = NormalizeStorefrontKey(httpContext.Request.Headers["X-Storefront-Key"].FirstOrDefault());
        if (storefrontKey is not null)
        {
            var storefrontTenant = await dbContext.Tenants.AsNoTracking()
                .Where(item => item.StorefrontKey == storefrontKey && item.IsStorefrontPublished &&
                    item.StorefrontAccessMode == StorefrontAccessMode.Public)
                .Select(item => new { item.Id, item.Slug, item.IsActive })
                .FirstOrDefaultAsync(httpContext.RequestAborted);
            if (storefrontTenant is null)
            {
                await WriteErrorAsync(httpContext, StatusCodes.Status404NotFound, "Storefront not found or not published.");
                return;
            }
            if (!storefrontTenant.IsActive ||
                !await HasUsableSubscriptionAsync(dbContext, storefrontTenant.Id, httpContext.RequestAborted))
            {
                await WriteErrorAsync(httpContext, StatusCodes.Status403Forbidden, "This storefront is currently unavailable.");
                return;
            }

            tenantContext.Initialize(storefrontTenant.Id, null, storefrontTenant.Slug, false);
            await next(httpContext);
            return;
        }

        // One shared admin host still needs a workspace code before login because
        // the JWT does not exist yet. This value is sent in a request header by the
        // login form, not in the URL, and cannot override an authenticated session.
        var workspace = IsWorkspaceSelectionRequest(httpContext.Request.Path)
            ? NormalizeWorkspace(httpContext.Request.Headers["X-Tenant-Slug"].FirstOrDefault())
            : null;
        if (workspace is not null)
        {
            var workspaceTenant = await dbContext.Tenants.AsNoTracking()
                .Where(item => item.Slug == workspace)
                .Select(item => new { item.Id, item.Slug, item.IsActive })
                .FirstOrDefaultAsync(httpContext.RequestAborted);
            if (workspaceTenant is null)
            {
                await WriteErrorAsync(httpContext, StatusCodes.Status404NotFound, "Company workspace not found.");
                return;
            }
            if (!workspaceTenant.IsActive ||
                !await HasUsableSubscriptionAsync(dbContext, workspaceTenant.Id, httpContext.RequestAborted))
            {
                await WriteErrorAsync(httpContext, StatusCodes.Status403Forbidden, "This company workspace is currently unavailable.");
                return;
            }

            tenantContext.Initialize(workspaceTenant.Id, null, workspaceTenant.Slug, false);
            await next(httpContext);
            return;
        }

        // Keep the reserved default workspace for initial setup, health checks,
        // and backward-compatible root access. Production storefront links should
        // always use /store/{opaque-key} or /preview/{signed-token}.
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

    private static bool IsWorkspaceSelectionRequest(PathString path) =>
        path.StartsWithSegments("/api/auth/admin/login") ||
        path.StartsWithSegments("/api/tenant/public-profile");

    private static string? NormalizeStorefrontKey(string? value)
    {
        var clean = value?.Trim().ToLowerInvariant();
        return !string.IsNullOrWhiteSpace(clean) && clean.Length is >= 24 and <= 64 && clean.All(char.IsLetterOrDigit)
            ? clean
            : null;
    }

    private static string? NormalizeWorkspace(string? value)
    {
        var clean = value?.Trim().ToLowerInvariant();
        return !string.IsNullOrWhiteSpace(clean) &&
            System.Text.RegularExpressions.Regex.IsMatch(clean, "^[a-z0-9]+(?:-[a-z0-9]+)*$")
                ? clean
                : null;
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
