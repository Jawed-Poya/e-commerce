using ECommerce.Dtos.Company;
using ECommerce.Entities;
using ECommerce.Services.Company;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/company")]
public sealed class CompanyController(ICompanyService company) : ControllerBase
{
    [AllowAnonymous]
    [HttpGet("public-profile")]
    public async Task<ActionResult<ApiResponse<PublicCompanyProfileResponse>>> GetPublic(CancellationToken cancellationToken) =>
        Ok(ApiResponse<PublicCompanyProfileResponse>.Ok(await company.GetPublicProfileAsync(cancellationToken)));

    [Authorize(Policy = AppPermissions.CompanyProfileManage)]
    [HttpGet("profile")]
    public async Task<ActionResult<ApiResponse<CompanyProfileResponse>>> GetProfile(CancellationToken cancellationToken) =>
        Ok(ApiResponse<CompanyProfileResponse>.Ok(await company.GetProfileAsync(cancellationToken)));

    [Authorize(Policy = AppPermissions.CompanyProfileManage)]
    [HttpPut("profile")]
    public async Task<ActionResult<ApiResponse<CompanyProfileResponse>>> UpdateProfile(
        UpdateCompanyProfileRequest request,
        CancellationToken cancellationToken) =>
        Ok(ApiResponse<CompanyProfileResponse>.Ok(await company.UpdateProfileAsync(request, cancellationToken), "Company profile updated."));

    [Authorize(Policy = AppPermissions.CompanySettingsManage)]
    [HttpPut("settings")]
    public async Task<ActionResult<ApiResponse<CompanyProfileResponse>>> UpdateSettings(
        UpdateCompanySettingsRequest request,
        CancellationToken cancellationToken) =>
        Ok(ApiResponse<CompanyProfileResponse>.Ok(await company.UpdateSettingsAsync(request, cancellationToken), "Company settings updated."));

    [Authorize(Policy = AppPermissions.CompanyBranchesManage)]
    [HttpPost("branches")]
    public async Task<ActionResult<ApiResponse<CompanyBranchResponse>>> CreateBranch(
        UpsertCompanyBranchRequest request,
        CancellationToken cancellationToken) =>
        StatusCode(StatusCodes.Status201Created,
            ApiResponse<CompanyBranchResponse>.Ok(await company.CreateBranchAsync(request, cancellationToken), "Branch created."));

    [Authorize(Policy = AppPermissions.CompanyBranchesManage)]
    [HttpPut("branches/{id:long}")]
    public async Task<ActionResult<ApiResponse<CompanyBranchResponse>>> UpdateBranch(
        long id,
        UpsertCompanyBranchRequest request,
        CancellationToken cancellationToken) =>
        Ok(ApiResponse<CompanyBranchResponse>.Ok(await company.UpdateBranchAsync(id, request, cancellationToken), "Branch updated."));
}
