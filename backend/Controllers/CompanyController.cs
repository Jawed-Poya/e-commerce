using ECommerce.Dtos.Company;
using ECommerce.Entities;
using ECommerce.Services.Company;
using ECommerce.Services.Products;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/company")]
public sealed class CompanyController(
    ICompanyService companyService,
    IProductImageStorage imageStorage) : ControllerBase
{
    [AllowAnonymous]
    [HttpGet("public-profile")]
    public async Task<ActionResult<ApiResponse<PublicCompanyProfileResponse>>> GetPublic()
    {
        using var operation = ServerOperation.CreateReadScope();
        return Ok(ApiResponse<PublicCompanyProfileResponse>.Ok(await TransientSqlRetry.ExecuteAsync(
            token => companyService.GetPublicProfileAsync(token),
            operation.Token)));
    }


    [AllowAnonymous]
    [HttpGet("manifest.webmanifest")]
    public async Task<IActionResult> GetManifest([FromQuery] string? app = null)
    {
        using var operation = ServerOperation.CreateReadScope();
        PublicCompanyProfileResponse profile = await TransientSqlRetry.ExecuteAsync<PublicCompanyProfileResponse>(
            token => companyService.GetPublicProfileAsync(token),
            operation.Token);

        var requestOrigin = Request.Headers.Origin.FirstOrDefault();
        Uri? clientOrigin = Uri.TryCreate(requestOrigin, UriKind.Absolute, out var parsedOrigin)
            ? parsedOrigin
            : null;
        if (clientOrigin is null)
        {
            var refererValue = Request.Headers.Referer.FirstOrDefault();
            if (Uri.TryCreate(refererValue, UriKind.Absolute, out var referer))
                clientOrigin = new Uri(referer.GetLeftPart(UriPartial.Authority));
        }
        clientOrigin ??= new Uri($"{Request.Scheme}://{Request.Host}");

        var appRoot = clientOrigin.ToString().TrimEnd('/') + "/";
        var isAdmin = string.Equals(app, "admin", StringComparison.OrdinalIgnoreCase);
        var appName = isAdmin ? $"{profile.Name} Admin" : profile.Name;

        // PWA installability requires real 192x192 and 512x512 icons. Company
        // logo/favicon uploads are intentionally flexible and can be any image size,
        // so declaring one of those files as both required sizes can make Chromium
        // reject the manifest. Both frontends ship these guaranteed-size icons.
        var pwaIcon192 = $"{appRoot}pwa-192.png";
        var pwaIcon512 = $"{appRoot}pwa-512.png";
        var icons = new object[]
        {
            new { src = pwaIcon192, sizes = "192x192", type = "image/png", purpose = "any" },
            new { src = pwaIcon512, sizes = "512x512", type = "image/png", purpose = "any" },
            new { src = pwaIcon512, sizes = "512x512", type = "image/png", purpose = "maskable" }
        };

        Response.Headers["Cache-Control"] = "no-cache, max-age=0";
        return new JsonResult(new
        {
            // URL fragments are ignored for manifest identity, so use a stable
            // same-origin query value to keep admin/storefront identities distinct.
            id = isAdmin ? $"{appRoot}?pwa=admin" : $"{appRoot}?pwa=storefront",
            name = appName,
            short_name = appName.Length > 24 ? appName[..24] : appName,
            description = isAdmin
                ? $"Manage {profile.Name} products, inventory, sales, purchases, and reports."
                : $"Shop from {profile.Name} and track orders from any device.",
            start_url = appRoot,
            scope = appRoot,
            display = "standalone",
            orientation = "any",
            background_color = "#ffffff",
            theme_color = isAdmin
                ? profile.Settings.AdminPrimaryColor
                : profile.Settings.StorefrontPrimaryColor,
            categories = isAdmin
                ? new[] { "business", "productivity" }
                : new[] { "shopping", "business", "medical" },
            icons
        })
        {
            ContentType = "application/manifest+json"
        };
    }

    [Authorize]
    [HttpGet("profile")]
    public async Task<ActionResult<ApiResponse<CompanyProfileResponse>>> GetProfile()
    {
        using var operation = ServerOperation.CreateReadScope();
        return Ok(ApiResponse<CompanyProfileResponse>.Ok(await TransientSqlRetry.ExecuteAsync(
            token => companyService.GetProfileAsync(token),
            operation.Token)));
    }

    [Authorize(Policy = AppPermissions.CompanyProfileManage)]
    [HttpPut("profile")]
    public async Task<ActionResult<ApiResponse<CompanyProfileResponse>>> UpdateProfile(UpdateCompanyProfileRequest request)
    {
        using var operation = ServerOperation.CreateWriteScope();
        var updated = await companyService.UpdateProfileAsync(request, operation.Token);
        return Ok(ApiResponse<CompanyProfileResponse>.Ok(updated, "Company profile updated."));
    }

    [Authorize(Policy = AppPermissions.CompanyProfileManage)]
    [HttpPost("assets/{assetType}")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<ActionResult<ApiResponse<object>>> UploadBrandAsset(
        string assetType,
        IFormFile image)
    {
        var normalizedType = assetType.Trim().ToLowerInvariant();
        if (normalizedType is not ("logo" or "favicon"))
            return BadRequest(ApiResponse<object>.Fail("The company asset type must be logo or favicon."));

        using var operation = ServerOperation.CreateWriteScope();
        try
        {
            var stored = await imageStorage.SaveAsync(image, "company", operation.Token);
            return Ok(ApiResponse<object>.Ok(
                new { assetType = normalizedType, imageUrl = stored.PublicUrl },
                normalizedType == "logo"
                    ? "Company logo uploaded."
                    : "Company favicon uploaded."));
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [Authorize(Policy = AppPermissions.CompanySettingsManage)]
    [HttpPut("settings")]
    public async Task<ActionResult<ApiResponse<CompanyProfileResponse>>> UpdateSettings(UpdateCompanySettingsRequest request)
    {
        using var operation = ServerOperation.CreateWriteScope();
        var updated = await companyService.UpdateSettingsAsync(request, operation.Token);
        return Ok(ApiResponse<CompanyProfileResponse>.Ok(updated, "Company settings updated."));
    }

    [Authorize(Policy = AppPermissions.OperationLineLimitsManage)]
    [HttpPut("operation-limits")]
    public async Task<ActionResult<ApiResponse<CompanyProfileResponse>>> UpdateOperationLimits(
        UpdateOperationLimitsRequest request)
    {
        using var operation = ServerOperation.CreateWriteScope();
        var updated = await companyService.UpdateOperationLimitsAsync(request, operation.Token);
        return Ok(ApiResponse<CompanyProfileResponse>.Ok(updated, "Operation line limits updated."));
    }

    [Authorize(Policy = AppPermissions.CompanyBranchesManage)]
    [HttpPost("branches")]
    public async Task<ActionResult<ApiResponse<CompanyBranchResponse>>> CreateBranch(UpsertCompanyBranchRequest request)
    {
        using var operation = ServerOperation.CreateWriteScope();
        var created = await companyService.CreateBranchAsync(request, operation.Token);
        return StatusCode(StatusCodes.Status201Created, ApiResponse<CompanyBranchResponse>.Ok(created, "Branch created."));
    }

    [Authorize(Policy = AppPermissions.CompanyBranchesManage)]
    [HttpPut("branches/{id:long}")]
    public async Task<ActionResult<ApiResponse<CompanyBranchResponse>>> UpdateBranch(long id, UpsertCompanyBranchRequest request)
    {
        using var operation = ServerOperation.CreateWriteScope();
        var updated = await companyService.UpdateBranchAsync(id, request, operation.Token);
        return Ok(ApiResponse<CompanyBranchResponse>.Ok(updated, "Branch updated."));
    }
}
