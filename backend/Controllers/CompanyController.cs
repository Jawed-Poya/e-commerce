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
    public async Task<ActionResult<ApiResponse<PublicCompanyProfileResponse>>> GetPublic()
    {
        using var operation = ServerOperation.CreateReadScope();
        return Ok(ApiResponse<PublicCompanyProfileResponse>.Ok(await TransientSqlRetry.ExecuteAsync(
            token => company.GetPublicProfileAsync(token),
            operation.Token)));
    }

    [Authorize]
    [HttpGet("profile")]
    public async Task<ActionResult<ApiResponse<CompanyProfileResponse>>> GetProfile()
    {
        using var operation = ServerOperation.CreateReadScope();
        return Ok(ApiResponse<CompanyProfileResponse>.Ok(await TransientSqlRetry.ExecuteAsync(
            token => company.GetProfileAsync(token),
            operation.Token)));
    }

    [Authorize(Policy = AppPermissions.CompanyProfileManage)]
    [HttpPut("profile")]
    public async Task<ActionResult<ApiResponse<CompanyProfileResponse>>> UpdateProfile(UpdateCompanyProfileRequest request)
    {
        using var operation = ServerOperation.CreateWriteScope();
        var updated = await company.UpdateProfileAsync(request, operation.Token);
        return Ok(ApiResponse<CompanyProfileResponse>.Ok(updated, "Company profile updated."));
    }

    [Authorize(Policy = AppPermissions.CompanySettingsManage)]
    [HttpPut("settings")]
    public async Task<ActionResult<ApiResponse<CompanyProfileResponse>>> UpdateSettings(UpdateCompanySettingsRequest request)
    {
        using var operation = ServerOperation.CreateWriteScope();
        var updated = await company.UpdateSettingsAsync(request, operation.Token);
        return Ok(ApiResponse<CompanyProfileResponse>.Ok(updated, "Company settings updated."));
    }

    [Authorize(Policy = AppPermissions.CompanyBranchesManage)]
    [HttpPost("branches")]
    public async Task<ActionResult<ApiResponse<CompanyBranchResponse>>> CreateBranch(UpsertCompanyBranchRequest request)
    {
        using var operation = ServerOperation.CreateWriteScope();
        var created = await company.CreateBranchAsync(request, operation.Token);
        return StatusCode(StatusCodes.Status201Created, ApiResponse<CompanyBranchResponse>.Ok(created, "Branch created."));
    }

    [Authorize(Policy = AppPermissions.CompanyBranchesManage)]
    [HttpPut("branches/{id:long}")]
    public async Task<ActionResult<ApiResponse<CompanyBranchResponse>>> UpdateBranch(long id, UpsertCompanyBranchRequest request)
    {
        using var operation = ServerOperation.CreateWriteScope();
        var updated = await company.UpdateBranchAsync(id, request, operation.Token);
        return Ok(ApiResponse<CompanyBranchResponse>.Ok(updated, "Branch updated."));
    }
}
