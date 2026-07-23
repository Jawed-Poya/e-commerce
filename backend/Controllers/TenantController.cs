using ECommerce.Dtos.Tenancy;
using ECommerce.Entities;
using ECommerce.Services.Tenancy;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/tenant")]
public sealed class TenantController(ITenantManagementService tenants) : ControllerBase
{
    [AllowAnonymous]
    [HttpGet("public-profile")]
    public async Task<ActionResult<ApiResponse<PublicTenantProfileResponse>>> GetPublic(CancellationToken cancellationToken) =>
        Ok(ApiResponse<PublicTenantProfileResponse>.Ok(await tenants.GetPublicProfileAsync(cancellationToken)));

    [Authorize(Policy = AppPermissions.TenantProfileManage)]
    [HttpGet("profile")]
    public async Task<ActionResult<ApiResponse<TenantProfileResponse>>> GetProfile(CancellationToken cancellationToken) =>
        Ok(ApiResponse<TenantProfileResponse>.Ok(await tenants.GetProfileAsync(cancellationToken)));

    [Authorize(Policy = AppPermissions.TenantProfileManage)]
    [HttpPut("profile")]
    public async Task<ActionResult<ApiResponse<TenantProfileResponse>>> UpdateProfile(UpdateTenantProfileRequest request, CancellationToken cancellationToken) =>
        Ok(ApiResponse<TenantProfileResponse>.Ok(await tenants.UpdateProfileAsync(request, cancellationToken), "Company profile updated."));

    [Authorize(Policy = AppPermissions.TenantSettingsManage)]
    [HttpPut("settings")]
    public async Task<ActionResult<ApiResponse<TenantProfileResponse>>> UpdateSettings(UpdateTenantSettingsRequest request, CancellationToken cancellationToken) =>
        Ok(ApiResponse<TenantProfileResponse>.Ok(await tenants.UpdateSettingsAsync(request, cancellationToken), "Company settings updated."));

    [Authorize(Policy = AppPermissions.TenantBranchesManage)]
    [HttpPost("branches")]
    public async Task<ActionResult<ApiResponse<BranchResponse>>> CreateBranch(UpsertBranchRequest request, CancellationToken cancellationToken) =>
        StatusCode(StatusCodes.Status201Created, ApiResponse<BranchResponse>.Ok(await tenants.CreateBranchAsync(request, cancellationToken), "Branch created."));

    [Authorize(Policy = AppPermissions.TenantBranchesManage)]
    [HttpPut("branches/{id:long}")]
    public async Task<ActionResult<ApiResponse<BranchResponse>>> UpdateBranch(long id, UpsertBranchRequest request, CancellationToken cancellationToken) =>
        Ok(ApiResponse<BranchResponse>.Ok(await tenants.UpdateBranchAsync(id, request, cancellationToken), "Branch updated."));
}
